-- AXB Ranked Matchmaking: authenticated RPC surface and transactional workflows.

create or replace function public.ranked_normalize_username(p_username text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_username text;
begin
  v_username := regexp_replace(btrim(coalesce(p_username, '')), '[[:space:]]+', ' ', 'g');

  if char_length(v_username) not between 3 and 24 then
    raise exception using errcode = '22023', message = 'O nome ranked deve ter entre 3 e 24 caracteres.';
  end if;

  if v_username ~ '[[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'O nome ranked contém caracteres inválidos.';
  end if;

  return v_username;
end;
$$;

create or replace function public.ranked_check_rate_limit(
  p_action_key text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit public.ranked_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;
  if p_max_attempts < 1 or p_window_seconds < 1 then
    raise exception using errcode = '22023', message = 'Configuração de limite inválida.';
  end if;

  select * into v_limit
  from public.ranked_rate_limits
  where actor_id = v_user_id and action_key = p_action_key
  for update;

  if not found then
    insert into public.ranked_rate_limits (actor_id, action_key, window_started_at, attempts)
    values (v_user_id, p_action_key, v_now, 1);
    return;
  end if;

  if v_limit.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    update public.ranked_rate_limits
    set window_started_at = v_now, attempts = 1
    where actor_id = v_user_id and action_key = p_action_key;
    return;
  end if;

  if v_limit.attempts >= p_max_attempts then
    raise exception using
      errcode = 'P0001',
      message = 'Muitas tentativas. Aguarde alguns instantes e tente novamente.';
  end if;

  update public.ranked_rate_limits
  set attempts = attempts + 1
  where actor_id = v_user_id and action_key = p_action_key;
end;
$$;

create or replace function public.ranked_no_accept_penalty_seconds(p_level integer)
returns integer
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select case p_level
    when 1 then 60
    when 2 then 600
    when 3 then 1800
    when 4 then 3600
    when 5 then 21600
    when 6 then 86400
    when 7 then 129600
    when 8 then 172800
    when 9 then 216000
    else null
  end;
$$;

create or replace function public.ranked_record_no_accept(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_profile public.ranked_profiles%rowtype;
  v_next_level integer;
  v_seconds integer;
  v_ends_at timestamptz;
begin
  select * into v_profile
  from public.ranked_profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Perfil ranked não encontrado.';
  end if;

  if v_profile.queue_strike_count < 2 then
    update public.ranked_profiles
    set queue_strike_count = queue_strike_count + 1
    where id = p_profile_id;
    return;
  end if;

  v_next_level := least(v_profile.no_accept_penalty_level + 1, 9);
  v_seconds := public.ranked_no_accept_penalty_seconds(v_next_level);
  v_ends_at := clock_timestamp() + make_interval(secs => v_seconds);

  update public.ranked_profiles
  set queue_strike_count = 0,
      no_accept_penalty_level = v_next_level
  where id = p_profile_id;

  insert into public.ranked_penalties (
    profile_id, kind, level, reason, ends_at
  ) values (
    p_profile_id,
    'no_accept',
    v_next_level,
    'Três partidas encontradas sem aceite.',
    v_ends_at
  );

  insert into public.ranked_notifications (
    audience, recipient_profile_id, kind, title, body, payload
  ) values (
    'profile',
    p_profile_id,
    'penalty_applied',
    'Fila temporariamente bloqueada',
    'A conta recebeu uma punição progressiva por não aceitar partidas.',
    jsonb_build_object('level', v_next_level, 'endsAt', v_ends_at)
  );
end;
$$;

create or replace function public.ranked_requeue_after_failed_acceptance(
  p_match_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.ranked_queue_entries
  set status = 'waiting',
      match_id = null,
      matched_at = null,
      joined_at = clock_timestamp(),
      heartbeat_at = clock_timestamp(),
      left_at = null
  where profile_id = p_profile_id
    and match_id = p_match_id
    and status = 'matched';
end;
$$;

create or replace function public.ranked_reset_no_accept_progress(p_profile_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.ranked_profiles
  set queue_strike_count = 0, no_accept_penalty_level = 0
  where id = p_profile_id;
$$;

create or replace function public.ranked_finalize_match_internal(
  p_match_id uuid,
  p_source public.ranked_resolution_source,
  p_support_user_id uuid default null
)
returns public.ranked_matches
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_match public.ranked_matches%rowtype;
  v_winner public.ranked_profiles%rowtype;
  v_loser public.ranked_profiles%rowtype;
  v_winner_effective integer;
  v_loser_effective integer;
  v_nominal_delta integer;
  v_winner_new_mmr integer;
  v_loser_new_mmr integer;
  v_winner_new_matches integer;
  v_loser_new_matches integer;
  v_winner_new_placement_wins integer;
begin
  select * into v_match
  from public.ranked_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Partida ranked não encontrada.';
  end if;

  if v_match.status = 'confirmed' then
    return v_match;
  end if;

  if v_match.status not in ('awaiting_confirmation', 'frozen', 'disputed') then
    raise exception using errcode = 'P0001', message = 'A partida não está pronta para confirmação.';
  end if;

  if v_match.winner_profile_id is null or v_match.loser_profile_id is null then
    raise exception using errcode = '23514', message = 'O vencedor e o perdedor precisam estar definidos.';
  end if;

  if exists (
    select 1 from public.ranked_mmr_ledger where match_id = p_match_id
  ) then
    raise exception using errcode = '23505', message = 'Esta partida já foi contabilizada.';
  end if;

  perform 1
  from public.ranked_profiles
  where id in (v_match.winner_profile_id, v_match.loser_profile_id)
  order by id
  for update;

  select * into strict v_winner
  from public.ranked_profiles where id = v_match.winner_profile_id;
  select * into strict v_loser
  from public.ranked_profiles where id = v_match.loser_profile_id;

  v_winner_effective := case
    when v_winner.placement_matches < 5 then v_winner.provisional_mmr
    else v_winner.mmr
  end;
  v_loser_effective := case
    when v_loser.placement_matches < 5 then v_loser.provisional_mmr
    else v_loser.mmr
  end;
  v_nominal_delta := greatest(
    10,
    least(
      40,
      round(
        40 * (
          1 - (1 / (1 + power(10::numeric, (v_loser_effective - v_winner_effective)::numeric / 400)))
        )
      )::integer
    )
  );

  if v_winner.placement_matches < 5 then
    v_winner_new_matches := v_winner.placement_matches + 1;
    v_winner_new_placement_wins := v_winner.placement_wins + 1;
    v_winner_new_mmr := public.ranked_placement_mmr(v_winner_new_placement_wins);

    update public.ranked_profiles
    set wins = wins + 1,
        placement_matches = v_winner_new_matches,
        placement_wins = v_winner_new_placement_wins,
        provisional_mmr = v_winner_new_mmr,
        mmr = case when v_winner_new_matches = 5 then v_winner_new_mmr else mmr end,
        mmr_reached_at = case
          when v_winner_new_matches = 5 then clock_timestamp()
          else mmr_reached_at
        end
    where id = v_winner.id;

    insert into public.ranked_mmr_ledger (
      profile_id, match_id, reason, old_mmr, new_mmr, delta, is_placement, created_by
    ) values (
      v_winner.id,
      p_match_id,
      case when v_winner_new_matches = 5
        then 'placement_complete'::public.ranked_mmr_reason
        else 'ranked_result'::public.ranked_mmr_reason
      end,
      null, null, null, true, p_support_user_id
    );
  else
    v_winner_new_mmr := v_winner.mmr + v_nominal_delta;
    update public.ranked_profiles
    set wins = wins + 1,
        mmr = v_winner_new_mmr,
        provisional_mmr = v_winner_new_mmr,
        mmr_reached_at = clock_timestamp()
    where id = v_winner.id;

    insert into public.ranked_mmr_ledger (
      profile_id, match_id, reason, old_mmr, new_mmr, delta, is_placement, created_by
    ) values (
      v_winner.id, p_match_id, 'ranked_result', v_winner.mmr,
      v_winner_new_mmr, v_winner_new_mmr - v_winner.mmr, false, p_support_user_id
    );
  end if;

  if v_loser.placement_matches < 5 then
    v_loser_new_matches := v_loser.placement_matches + 1;
    v_loser_new_mmr := public.ranked_placement_mmr(v_loser.placement_wins);

    update public.ranked_profiles
    set losses = losses + 1,
        placement_matches = v_loser_new_matches,
        provisional_mmr = v_loser_new_mmr,
        mmr = case when v_loser_new_matches = 5 then v_loser_new_mmr else mmr end,
        mmr_reached_at = case
          when v_loser_new_matches = 5 then clock_timestamp()
          else mmr_reached_at
        end
    where id = v_loser.id;

    insert into public.ranked_mmr_ledger (
      profile_id, match_id, reason, old_mmr, new_mmr, delta, is_placement, created_by
    ) values (
      v_loser.id,
      p_match_id,
      case when v_loser_new_matches = 5
        then 'placement_complete'::public.ranked_mmr_reason
        else 'ranked_result'::public.ranked_mmr_reason
      end,
      null, null, null, true, p_support_user_id
    );
  else
    v_loser_new_mmr := greatest(800, v_loser.mmr - v_nominal_delta);
    update public.ranked_profiles
    set losses = losses + 1,
        mmr = v_loser_new_mmr,
        provisional_mmr = v_loser_new_mmr,
        mmr_reached_at = case
          when v_loser_new_mmr <> v_loser.mmr then clock_timestamp()
          else mmr_reached_at
        end
    where id = v_loser.id;

    insert into public.ranked_mmr_ledger (
      profile_id, match_id, reason, old_mmr, new_mmr, delta, is_placement, created_by
    ) values (
      v_loser.id, p_match_id, 'ranked_result', v_loser.mmr,
      v_loser_new_mmr, v_loser_new_mmr - v_loser.mmr, false, p_support_user_id
    );
  end if;

  update public.ranked_matches
  set status = 'confirmed',
      resolution_source = p_source,
      confirmed_at = clock_timestamp()
  where id = p_match_id
  returning * into v_match;

  delete from public.ranked_active_match_players where match_id = p_match_id;
  update public.ranked_queue_entries
  set status = 'completed', left_at = clock_timestamp()
  where match_id = p_match_id and status = 'matched';

  perform public.ranked_reset_no_accept_progress(v_match.player_one_id);
  perform public.ranked_reset_no_accept_progress(v_match.player_two_id);

  insert into public.ranked_notifications (
    audience, recipient_profile_id, kind, title, body, payload
  )
  select
    'profile', participant_id, 'match_confirmed', 'Resultado confirmado',
    'A partida foi contabilizada no seu perfil ranked.',
    jsonb_build_object('matchId', p_match_id, 'matchNumber', v_match.match_number)
  from unnest(array[v_match.player_one_id, v_match.player_two_id]) participant_id;

  return v_match;
end;
$$;

create or replace function public.ranked_reconcile()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_match public.ranked_matches%rowtype;
  v_acceptance record;
  v_expired_queue integer := 0;
  v_expired_acceptances integer := 0;
  v_frozen_scores integer := 0;
  v_auto_confirmed integer := 0;
begin
  if auth.uid() is not null then
    perform public.ranked_check_rate_limit('reconcile', 180, 60);
  end if;

  update public.ranked_penalties
  set status = 'expired'
  where status = 'active' and ends_at is not null and ends_at <= clock_timestamp();

  update public.ranked_queue_entries
  set status = 'expired', left_at = clock_timestamp()
  where status = 'waiting'
    and heartbeat_at < clock_timestamp() - interval '20 seconds';
  get diagnostics v_expired_queue = row_count;

  for v_match in
    select *
    from public.ranked_matches
    where status = 'awaiting_acceptance' and accept_deadline <= clock_timestamp()
    order by accept_deadline
    for update skip locked
  loop
    for v_acceptance in
      select * from public.ranked_match_acceptances where match_id = v_match.id
    loop
      if v_acceptance.state = 'pending' then
        update public.ranked_match_acceptances
        set state = 'expired', responded_at = clock_timestamp()
        where id = v_acceptance.id;
        perform public.ranked_record_no_accept(v_acceptance.profile_id);
      elsif v_acceptance.state = 'accepted' then
        perform public.ranked_requeue_after_failed_acceptance(
          v_match.id, v_acceptance.profile_id
        );
      end if;
    end loop;

    update public.ranked_queue_entries
    set status = 'expired', left_at = clock_timestamp()
    where match_id = v_match.id and status = 'matched';

    update public.ranked_matches
    set status = 'cancelled',
        cancelled_at = clock_timestamp(),
        cancellation_reason = 'Prazo de aceite encerrado.'
    where id = v_match.id;

    delete from public.ranked_active_match_players where match_id = v_match.id;
    v_expired_acceptances := v_expired_acceptances + 1;
  end loop;

  for v_match in
    select *
    from public.ranked_matches
    where status = 'awaiting_score' and score_deadline <= clock_timestamp()
    order by score_deadline
    for update skip locked
  loop
    update public.ranked_matches set status = 'frozen' where id = v_match.id;
    insert into public.ranked_notifications (
      audience, kind, title, body, payload
    ) values (
      'support', 'support_required', 'Placar não enviado',
      'O criador não enviou o placar no prazo de três minutos.',
      jsonb_build_object('matchId', v_match.id, 'matchNumber', v_match.match_number)
    );
    v_frozen_scores := v_frozen_scores + 1;
  end loop;

  for v_match in
    select *
    from public.ranked_matches
    where status = 'awaiting_confirmation'
      and confirmation_deadline <= clock_timestamp()
    order by confirmation_deadline
    for update skip locked
  loop
    update public.ranked_result_confirmations
    set state = 'auto_approved', responded_at = clock_timestamp()
    where match_id = v_match.id
      and profile_id <> v_match.creator_profile_id
      and state = 'pending';

    perform public.ranked_finalize_match_internal(v_match.id, 'automatic', null);
    v_auto_confirmed := v_auto_confirmed + 1;
  end loop;

  return jsonb_build_object(
    'expiredQueueEntries', v_expired_queue,
    'expiredAcceptanceMatches', v_expired_acceptances,
    'frozenScoreMatches', v_frozen_scores,
    'autoConfirmedMatches', v_auto_confirmed
  );
end;
$$;

create or replace function public.ranked_create_profile(p_username text)
returns public.ranked_profiles
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.ranked_profiles%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;
  perform public.ranked_check_rate_limit('create_profile', 5, 3600);

  if exists (select 1 from public.ranked_profiles where id = v_user_id) then
    raise exception using errcode = '23505', message = 'Esta conta já possui um perfil ranked.';
  end if;

  begin
    insert into public.ranked_profiles (
      id, username, last_username_changed_at
    ) values (
      v_user_id, public.ranked_normalize_username(p_username), clock_timestamp()
    ) returning * into v_profile;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'Esse nome ranked já está em uso.';
  end;

  return v_profile;
end;
$$;

create or replace function public.ranked_update_username(p_username text)
returns public.ranked_profiles
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.ranked_profiles%rowtype;
  v_username text := public.ranked_normalize_username(p_username);
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;
  perform public.ranked_check_rate_limit('update_username', 10, 3600);

  select * into v_profile
  from public.ranked_profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Crie seu perfil ranked primeiro.';
  end if;
  if v_profile.username = v_username::extensions.citext then
    return v_profile;
  end if;
  if v_profile.last_username_changed_at is not null
    and v_profile.last_username_changed_at + interval '3 hours' > clock_timestamp() then
    raise exception using
      errcode = 'P0001',
      message = 'O nome ranked só pode ser alterado a cada três horas.';
  end if;

  begin
    update public.ranked_profiles
    set username = v_username
    where id = v_user_id
    returning * into v_profile;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'Esse nome ranked já está em uso.';
  end;

  return v_profile;
end;
$$;

create or replace function public.ranked_set_avatar_path(p_avatar_path text)
returns public.ranked_profiles
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.ranked_profiles%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;
  perform public.ranked_check_rate_limit('set_avatar', 20, 3600);

  if p_avatar_path is not null and (
    p_avatar_path <> v_user_id::text || '/avatar.webp'
  ) then
    raise exception using errcode = '22023', message = 'Caminho de avatar inválido.';
  end if;

  update public.ranked_profiles
  set avatar_path = p_avatar_path
  where id = v_user_id
  returning * into v_profile;

  if not found then
    raise exception using errcode = 'P0002', message = 'Crie seu perfil ranked primeiro.';
  end if;
  return v_profile;
end;
$$;

create or replace function public.ranked_get_my_profile()
returns table (
  id uuid,
  username text,
  avatar_path text,
  wins integer,
  losses integer,
  mmr integer,
  placement_matches smallint,
  placement_wins smallint,
  mmr_reached_at timestamptz,
  last_username_changed_at timestamptz,
  queue_strike_count smallint,
  no_accept_penalty_level smallint,
  frozen_until timestamptz,
  banned_at timestamptz,
  ban_reason text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    p.id,
    p.username::text,
    p.avatar_path,
    p.wins,
    p.losses,
    case when p.placement_matches = 5 then p.mmr else null end,
    p.placement_matches,
    p.placement_wins,
    p.mmr_reached_at,
    p.last_username_changed_at,
    p.queue_strike_count,
    p.no_accept_penalty_level,
    p.frozen_until,
    p.banned_at,
    p.ban_reason,
    p.created_at,
    p.updated_at
  from public.ranked_profiles p
  where p.id = auth.uid();
$$;

create or replace function public.ranked_join_queue()
returns public.ranked_queue_entries
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.ranked_profiles%rowtype;
  v_entry public.ranked_queue_entries%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;
  perform public.ranked_check_rate_limit('queue_mutation', 120, 60);
  perform public.ranked_reconcile();

  select * into v_profile
  from public.ranked_profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Complete seu perfil ranked antes de entrar na fila.';
  end if;
  if v_profile.banned_at is not null then
    raise exception using errcode = '42501', message = 'Esta conta está banida da ranked.';
  end if;
  if v_profile.frozen_until is not null and v_profile.frozen_until > clock_timestamp() then
    raise exception using errcode = '42501', message = 'Esta conta está temporariamente congelada.';
  end if;
  if exists (
    select 1 from public.ranked_penalties
    where profile_id = v_user_id
      and status = 'active'
      and (ends_at is null or ends_at > clock_timestamp())
  ) then
    raise exception using errcode = '42501', message = 'A fila está temporariamente bloqueada para esta conta.';
  end if;
  if exists (
    select 1 from public.ranked_active_match_players where profile_id = v_user_id
  ) then
    raise exception using errcode = '23505', message = 'Você já está em uma partida ativa.';
  end if;

  select * into v_entry
  from public.ranked_queue_entries
  where profile_id = v_user_id and status in ('waiting', 'matched')
  for update;

  if found then
    return v_entry;
  end if;

  insert into public.ranked_queue_entries (profile_id, effective_mmr)
  values (
    v_user_id,
    case when v_profile.placement_matches < 5
      then v_profile.provisional_mmr else v_profile.mmr end
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

create or replace function public.ranked_queue_heartbeat(p_queue_entry_id uuid)
returns public.ranked_queue_entries
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_entry public.ranked_queue_entries%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;

  update public.ranked_queue_entries
  set heartbeat_at = clock_timestamp()
  where id = p_queue_entry_id
    and profile_id = auth.uid()
    and status = 'waiting'
  returning * into v_entry;

  if not found then
    raise exception using errcode = 'P0002', message = 'Entrada ativa na fila não encontrada.';
  end if;
  return v_entry;
end;
$$;

create or replace function public.ranked_leave_queue(p_queue_entry_id uuid)
returns public.ranked_queue_entries
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_entry public.ranked_queue_entries%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;
  perform public.ranked_check_rate_limit('queue_mutation', 120, 60);

  update public.ranked_queue_entries
  set status = 'cancelled', left_at = clock_timestamp()
  where id = p_queue_entry_id
    and profile_id = auth.uid()
    and status = 'waiting'
  returning * into v_entry;

  if not found then
    raise exception using errcode = 'P0002', message = 'A busca não está ativa ou já encontrou uma partida.';
  end if;
  return v_entry;
end;
$$;

create or replace function public.ranked_try_matchmake()
returns public.ranked_matches
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_self public.ranked_queue_entries%rowtype;
  v_opponent public.ranked_queue_entries%rowtype;
  v_match public.ranked_matches%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;
  perform public.ranked_check_rate_limit('matchmake', 120, 60);
  perform public.ranked_reconcile();

  select * into v_self
  from public.ranked_queue_entries
  where profile_id = v_user_id and status = 'waiting'
  for update;

  if not found then
    return null;
  end if;

  select q.* into v_opponent
  from public.ranked_queue_entries q
  join public.ranked_profiles p on p.id = q.profile_id
  where q.status = 'waiting'
    and q.profile_id <> v_user_id
    and q.heartbeat_at >= clock_timestamp() - interval '20 seconds'
    and p.banned_at is null
    and (p.frozen_until is null or p.frozen_until <= clock_timestamp())
    and not exists (
      select 1 from public.ranked_active_match_players amp
      where amp.profile_id = q.profile_id
    )
    and not exists (
      select 1 from public.ranked_penalties pen
      where pen.profile_id = q.profile_id
        and pen.status = 'active'
        and (pen.ends_at is null or pen.ends_at > clock_timestamp())
    )
    and (
      v_self.joined_at <= clock_timestamp() - interval '60 seconds'
      or abs(q.effective_mmr - v_self.effective_mmr) <= 150
    )
  order by
    case
      when v_self.joined_at > clock_timestamp() - interval '60 seconds'
        then abs(q.effective_mmr - v_self.effective_mmr)
      else 0
    end,
    q.joined_at,
    q.id
  for update of q skip locked
  limit 1;

  if not found then
    return null;
  end if;

  insert into public.ranked_matches (player_one_id, player_two_id)
  values (v_self.profile_id, v_opponent.profile_id)
  returning * into v_match;

  insert into public.ranked_active_match_players (profile_id, match_id)
  values
    (v_self.profile_id, v_match.id),
    (v_opponent.profile_id, v_match.id);

  insert into public.ranked_match_acceptances (match_id, profile_id)
  values
    (v_match.id, v_self.profile_id),
    (v_match.id, v_opponent.profile_id);

  update public.ranked_queue_entries
  set status = 'matched', matched_at = clock_timestamp(), match_id = v_match.id
  where id in (v_self.id, v_opponent.id);

  insert into public.ranked_notifications (
    audience, recipient_profile_id, kind, title, body, payload
  )
  select
    'profile', participant_id, 'match_found', 'Partida encontrada',
    'Você tem 15 segundos para aceitar o confronto.',
    jsonb_build_object(
      'matchId', v_match.id,
      'matchNumber', v_match.match_number,
      'acceptDeadline', v_match.accept_deadline
    )
  from unnest(array[v_match.player_one_id, v_match.player_two_id]) participant_id;

  return v_match;
end;
$$;

create or replace function public.ranked_respond_to_match(
  p_match_id uuid,
  p_accept boolean
)
returns public.ranked_matches
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_match public.ranked_matches%rowtype;
  v_other_id uuid;
  v_creator_id uuid;
  v_password text;
  v_random_bytes bytea;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;
  if p_accept is null then
    raise exception using errcode = '22023', message = 'Informe se deseja aceitar a partida.';
  end if;
  perform public.ranked_check_rate_limit('match_acceptance', 20, 60);
  perform public.ranked_reconcile();

  select * into v_match
  from public.ranked_matches where id = p_match_id
  for update;

  if not found or v_user_id not in (v_match.player_one_id, v_match.player_two_id) then
    raise exception using errcode = 'P0002', message = 'Partida encontrada não está disponível.';
  end if;
  if v_match.status <> 'awaiting_acceptance' then
    return v_match;
  end if;
  if v_match.accept_deadline <= clock_timestamp() then
    perform public.ranked_reconcile();
    raise exception using errcode = 'P0001', message = 'O prazo de aceite foi encerrado.';
  end if;

  if exists (
    select 1 from public.ranked_match_acceptances
    where match_id = p_match_id and profile_id = v_user_id and state = 'accepted'
  ) and p_accept then
    return v_match;
  end if;

  update public.ranked_match_acceptances
  set state = case when p_accept then 'accepted' else 'declined' end,
      responded_at = clock_timestamp()
  where match_id = p_match_id
    and profile_id = v_user_id
    and state = 'pending';

  if not found then
    raise exception using errcode = 'P0001', message = 'O aceite já foi respondido.';
  end if;

  if not p_accept then
    perform public.ranked_record_no_accept(v_user_id);
    v_other_id := case when v_user_id = v_match.player_one_id
      then v_match.player_two_id else v_match.player_one_id end;

    if exists (
      select 1 from public.ranked_match_acceptances
      where match_id = p_match_id and profile_id = v_other_id and state = 'accepted'
    ) then
      perform public.ranked_requeue_after_failed_acceptance(p_match_id, v_other_id);
    end if;

    update public.ranked_queue_entries
    set status = 'expired', left_at = clock_timestamp()
    where match_id = p_match_id and status = 'matched';
    update public.ranked_matches
    set status = 'cancelled', cancelled_at = clock_timestamp(),
        cancellation_reason = 'Partida recusada.'
    where id = p_match_id
    returning * into v_match;
    delete from public.ranked_active_match_players where match_id = p_match_id;
    return v_match;
  end if;

  if (
    select count(*) from public.ranked_match_acceptances
    where match_id = p_match_id and state = 'accepted'
  ) = 2 then
    v_creator_id := case when get_byte(extensions.gen_random_bytes(1), 0) < 128
      then v_match.player_one_id else v_match.player_two_id end;
    v_random_bytes := extensions.gen_random_bytes(3);
    v_password := lpad(
      (
        100000
        + (
          get_byte(v_random_bytes, 0) * 65536
          + get_byte(v_random_bytes, 1) * 256
          + get_byte(v_random_bytes, 2)
        ) % 900000
      )::text,
      6,
      '0'
    );

    update public.ranked_matches
    set status = 'lobby',
        creator_profile_id = v_creator_id,
        room_name = '[ARENA X1 BR] Match ' || match_number,
        room_password = v_password
    where id = p_match_id
    returning * into v_match;

    insert into public.ranked_notifications (
      audience, recipient_profile_id, kind, title, body, payload
    )
    select
      'profile', participant_id, 'lobby_ready', 'Lobby liberado',
      'Os dois jogadores aceitaram. Consulte o nome e a senha da sala.',
      jsonb_build_object('matchId', v_match.id, 'matchNumber', v_match.match_number)
    from unnest(array[v_match.player_one_id, v_match.player_two_id]) participant_id;
  end if;

  return v_match;
end;
$$;

create or replace function public.ranked_start_match(p_match_id uuid)
returns public.ranked_matches
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_match public.ranked_matches%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;
  perform public.ranked_check_rate_limit('match_lifecycle', 30, 60);

  update public.ranked_matches
  set status = 'in_progress', started_at = clock_timestamp()
  where id = p_match_id and creator_profile_id = auth.uid() and status = 'lobby'
  returning * into v_match;

  if not found then
    raise exception using errcode = 'P0001', message = 'Somente o criador pode iniciar um lobby ativo.';
  end if;
  return v_match;
end;
$$;

create or replace function public.ranked_end_match(p_match_id uuid)
returns public.ranked_matches
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_match public.ranked_matches%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;
  perform public.ranked_check_rate_limit('match_lifecycle', 30, 60);

  update public.ranked_matches
  set status = 'awaiting_score',
      ended_at = clock_timestamp(),
      score_deadline = clock_timestamp() + interval '3 minutes'
  where id = p_match_id
    and creator_profile_id = auth.uid()
    and status in ('lobby', 'in_progress')
  returning * into v_match;

  if not found then
    raise exception using errcode = 'P0001', message = 'Somente o criador pode finalizar uma partida ativa.';
  end if;
  return v_match;
end;
$$;

create or replace function public.ranked_submit_score(
  p_match_id uuid,
  p_creator_goals integer,
  p_opponent_goals integer
)
returns public.ranked_matches
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_match public.ranked_matches%rowtype;
  v_winner_id uuid;
  v_loser_id uuid;
  v_opponent_id uuid;
  v_player_one_score integer;
  v_player_two_score integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;
  perform public.ranked_check_rate_limit('submit_score', 10, 60);
  perform public.ranked_reconcile();

  select * into v_match from public.ranked_matches where id = p_match_id for update;
  if not found
    or v_match.creator_profile_id <> auth.uid()
    or v_match.status <> 'awaiting_score' then
    raise exception using errcode = 'P0001', message = 'O placar não pode ser enviado neste momento.';
  end if;
  if v_match.score_deadline <= clock_timestamp() then
    perform public.ranked_reconcile();
    raise exception using errcode = 'P0001', message = 'O prazo para enviar o placar foi encerrado.';
  end if;
  if p_creator_goals is null or p_opponent_goals is null
    or p_creator_goals < 0 or p_opponent_goals < 0 then
    raise exception using errcode = '22023', message = 'Informe placares inteiros não negativos.';
  end if;
  if p_creator_goals = p_opponent_goals then
    raise exception using errcode = '23514', message = 'A partida ranked precisa ter um vencedor.';
  end if;

  v_opponent_id := case when auth.uid() = v_match.player_one_id
    then v_match.player_two_id else v_match.player_one_id end;
  v_winner_id := case when p_creator_goals > p_opponent_goals
    then auth.uid() else v_opponent_id end;
  v_loser_id := case when v_winner_id = auth.uid()
    then v_opponent_id else auth.uid() end;
  v_player_one_score := case when auth.uid() = v_match.player_one_id
    then p_creator_goals else p_opponent_goals end;
  v_player_two_score := case when auth.uid() = v_match.player_two_id
    then p_creator_goals else p_opponent_goals end;

  update public.ranked_matches
  set status = 'awaiting_confirmation',
      player_one_score = v_player_one_score,
      player_two_score = v_player_two_score,
      winner_profile_id = v_winner_id,
      loser_profile_id = v_loser_id,
      confirmation_deadline = clock_timestamp() + interval '3 minutes'
  where id = p_match_id
  returning * into v_match;

  insert into public.ranked_result_confirmations (
    match_id, profile_id, state, responded_at
  ) values
    (p_match_id, auth.uid(), 'approved', clock_timestamp()),
    (p_match_id, v_opponent_id, 'pending', null);

  insert into public.ranked_notifications (
    audience, recipient_profile_id, kind, title, body, payload
  ) values (
    'profile', v_opponent_id, 'score_submitted', 'Placar enviado',
    'Você tem três minutos para aprovar ou contestar o resultado.',
    jsonb_build_object(
      'matchId', v_match.id,
      'matchNumber', v_match.match_number,
      'confirmationDeadline', v_match.confirmation_deadline
    )
  );
  return v_match;
end;
$$;

create or replace function public.ranked_confirm_result(
  p_match_id uuid,
  p_approve boolean
)
returns public.ranked_matches
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_match public.ranked_matches%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;
  if p_approve is null then
    raise exception using errcode = '22023', message = 'Informe se deseja aprovar o resultado.';
  end if;
  perform public.ranked_check_rate_limit('confirm_result', 20, 60);
  perform public.ranked_reconcile();

  select * into v_match from public.ranked_matches where id = p_match_id for update;
  if not found
    or auth.uid() not in (v_match.player_one_id, v_match.player_two_id)
    or auth.uid() = v_match.creator_profile_id then
    raise exception using errcode = 'P0001', message = 'Este resultado não está disponível para confirmação.';
  end if;
  if v_match.status = 'confirmed' then
    return v_match;
  end if;
  if v_match.status <> 'awaiting_confirmation' then
    raise exception using errcode = 'P0001', message = 'Este resultado não está disponível para confirmação.';
  end if;
  if v_match.confirmation_deadline <= clock_timestamp() then
    perform public.ranked_reconcile();
    select * into v_match from public.ranked_matches where id = p_match_id;
    return v_match;
  end if;

  update public.ranked_result_confirmations
  set state = case when p_approve then 'approved' else 'contested' end,
      responded_at = clock_timestamp()
  where match_id = p_match_id and profile_id = auth.uid() and state = 'pending';

  if not found then
    raise exception using errcode = 'P0001', message = 'O resultado já foi respondido.';
  end if;

  if p_approve then
    return public.ranked_finalize_match_internal(p_match_id, 'players', null);
  end if;

  update public.ranked_matches
  set status = 'disputed'
  where id = p_match_id
  returning * into v_match;

  insert into public.ranked_notifications (
    audience, kind, title, body, payload
  ) values (
    'support', 'support_required', 'Resultado contestado',
    'Um jogador contestou o placar enviado pelo criador.',
    jsonb_build_object('matchId', v_match.id, 'matchNumber', v_match.match_number)
  );
  return v_match;
end;
$$;

create or replace function public.ranked_report_problem(
  p_match_id uuid,
  p_category public.ranked_report_category,
  p_observation text
)
returns public.ranked_match_reports
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_match public.ranked_matches%rowtype;
  v_report public.ranked_match_reports%rowtype;
  v_observation text;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;
  perform public.ranked_check_rate_limit('report_problem', 5, 600);
  v_observation := regexp_replace(
    btrim(coalesce(p_observation, '')), '[[:cntrl:]]+', ' ', 'g'
  );

  select * into v_match from public.ranked_matches where id = p_match_id for update;
  if not found
    or auth.uid() not in (v_match.player_one_id, v_match.player_two_id)
    or v_match.status not in (
      'lobby', 'in_progress', 'awaiting_score', 'awaiting_confirmation',
      'frozen', 'disputed'
    ) then
    raise exception using errcode = 'P0001', message = 'Esta partida não pode ser reportada neste momento.';
  end if;
  if char_length(v_observation) not between 10 and 1000 then
    raise exception using errcode = '22023', message = 'Descreva o problema usando entre 10 e 1.000 caracteres.';
  end if;

  insert into public.ranked_match_reports (
    match_id, reporter_profile_id, category, observation
  ) values (
    p_match_id, auth.uid(), p_category, v_observation
  ) returning * into v_report;

  if v_match.status not in ('frozen', 'disputed') then
    update public.ranked_matches set status = 'frozen' where id = p_match_id;
  end if;
  insert into public.ranked_notifications (
    audience, kind, title, body, payload
  ) values (
    'support', 'support_required', 'Problema reportado',
    'Um lobby foi congelado e precisa de análise do suporte.',
    jsonb_build_object('matchId', v_match.id, 'reportId', v_report.id)
  );
  return v_report;
end;
$$;

create or replace function public.ranked_support_resolve_match(
  p_match_id uuid,
  p_action text,
  p_player_one_score integer default null,
  p_player_two_score integer default null,
  p_winner_profile_id uuid default null,
  p_note text default null
)
returns public.ranked_matches
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_support_id uuid := auth.uid();
  v_match public.ranked_matches%rowtype;
  v_previous jsonb;
  v_winner_id uuid;
  v_loser_id uuid;
  v_player_one_score integer := p_player_one_score;
  v_player_two_score integer := p_player_two_score;
begin
  if not public.ranked_is_support(v_support_id) then
    raise exception using errcode = '42501', message = 'Acesso exclusivo do suporte.';
  end if;
  perform public.ranked_check_rate_limit('support_match', 120, 60);

  select * into v_match from public.ranked_matches where id = p_match_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Partida ranked não encontrada.';
  end if;
  if v_match.status in ('confirmed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'Esta partida já foi encerrada.';
  end if;
  v_previous := to_jsonb(v_match);

  if lower(p_action) = 'cancel' then
    update public.ranked_matches
    set status = 'cancelled',
        cancelled_at = clock_timestamp(),
        cancellation_reason = coalesce(nullif(btrim(p_note), ''), 'Cancelada pelo suporte.')
    where id = p_match_id
    returning * into v_match;
    delete from public.ranked_active_match_players where match_id = p_match_id;
    update public.ranked_queue_entries
    set status = 'cancelled', left_at = clock_timestamp()
    where match_id = p_match_id and status = 'matched';
  elsif lower(p_action) in ('confirm', 'walkover') then
    if v_match.status = 'awaiting_acceptance' then
      raise exception using errcode = 'P0001', message = 'Uma partida não aceita não pode receber resultado.';
    end if;

    if lower(p_action) = 'confirm' then
      if v_player_one_score is null or v_player_two_score is null
        or v_player_one_score < 0 or v_player_two_score < 0
        or v_player_one_score = v_player_two_score then
        raise exception using errcode = '22023', message = 'Informe um placar válido e sem empate.';
      end if;
      v_winner_id := case when v_player_one_score > v_player_two_score
        then v_match.player_one_id else v_match.player_two_id end;
    else
      if p_winner_profile_id is null
        or p_winner_profile_id not in (v_match.player_one_id, v_match.player_two_id) then
        raise exception using errcode = '22023', message = 'Informe o vencedor do W.O.';
      end if;
      v_winner_id := p_winner_profile_id;
      v_player_one_score := null;
      v_player_two_score := null;
    end if;

    if p_winner_profile_id is not null and p_winner_profile_id <> v_winner_id then
      raise exception using errcode = '23514', message = 'O vencedor não corresponde ao placar.';
    end if;
    v_loser_id := case when v_winner_id = v_match.player_one_id
      then v_match.player_two_id else v_match.player_one_id end;

    if v_match.status not in ('frozen', 'disputed', 'awaiting_confirmation') then
      update public.ranked_matches set status = 'disputed' where id = p_match_id;
    end if;
    update public.ranked_matches
    set player_one_score = v_player_one_score,
        player_two_score = v_player_two_score,
        winner_profile_id = v_winner_id,
        loser_profile_id = v_loser_id,
        resolution_source = 'support'
    where id = p_match_id;
    v_match := public.ranked_finalize_match_internal(p_match_id, 'support', v_support_id);
  else
    raise exception using errcode = '22023', message = 'Ação de suporte inválida.';
  end if;

  update public.ranked_match_reports
  set status = 'resolved', resolved_by = v_support_id, resolved_at = clock_timestamp()
  where match_id = p_match_id and status = 'open';

  insert into public.support_audit_log (
    support_user_id, action, target_type, target_id,
    previous_state, next_state, note
  ) values (
    v_support_id, 'resolve_match:' || lower(p_action), 'ranked_match',
    p_match_id::text, v_previous, to_jsonb(v_match), nullif(btrim(p_note), '')
  );

  return v_match;
end;
$$;

create or replace function public.ranked_support_adjust_mmr(
  p_profile_id uuid,
  p_new_mmr integer,
  p_note text
)
returns public.ranked_profiles
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_support_id uuid := auth.uid();
  v_profile public.ranked_profiles%rowtype;
  v_previous jsonb;
begin
  if not public.ranked_is_support(v_support_id) then
    raise exception using errcode = '42501', message = 'Acesso exclusivo do suporte.';
  end if;
  if p_new_mmr is null or p_new_mmr < 800 then
    raise exception using errcode = '22023', message = 'O MMR não pode ficar abaixo de 800.';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception using errcode = '22023', message = 'Informe uma justificativa interna.';
  end if;

  select * into v_profile
  from public.ranked_profiles where id = p_profile_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Perfil ranked não encontrado.';
  end if;
  v_previous := to_jsonb(v_profile);

  update public.ranked_profiles
  set mmr = p_new_mmr,
      provisional_mmr = case when placement_matches = 5 then p_new_mmr else provisional_mmr end,
      mmr_reached_at = clock_timestamp()
  where id = p_profile_id
  returning * into v_profile;

  insert into public.ranked_mmr_ledger (
    profile_id, reason, old_mmr, new_mmr, delta, is_placement, created_by
  ) values (
    p_profile_id, 'support_adjustment',
    (v_previous ->> 'mmr')::integer, p_new_mmr,
    p_new_mmr - (v_previous ->> 'mmr')::integer, false, v_support_id
  );

  insert into public.support_audit_log (
    support_user_id, action, target_type, target_id,
    previous_state, next_state, note
  ) values (
    v_support_id, 'adjust_mmr', 'ranked_profile', p_profile_id::text,
    v_previous, to_jsonb(v_profile), btrim(p_note)
  );
  return v_profile;
end;
$$;

create or replace function public.ranked_support_manage_profile(
  p_profile_id uuid,
  p_action text,
  p_duration_seconds integer default null,
  p_note text default null
)
returns public.ranked_profiles
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_support_id uuid := auth.uid();
  v_profile public.ranked_profiles%rowtype;
  v_previous jsonb;
  v_ends_at timestamptz;
  v_action text := lower(p_action);
  v_active_match public.ranked_matches%rowtype;
  v_other_id uuid;
begin
  if not public.ranked_is_support(v_support_id) then
    raise exception using errcode = '42501', message = 'Acesso exclusivo do suporte.';
  end if;
  if v_action is null
    or v_action not in ('ban', 'unban', 'freeze', 'unfreeze', 'penalize') then
    raise exception using errcode = '22023', message = 'Ação de suporte inválida.';
  end if;
  if v_action in ('freeze', 'penalize')
    and (p_duration_seconds is null or p_duration_seconds < 60 or p_duration_seconds > 31536000) then
    raise exception using errcode = '22023', message = 'Informe uma duração entre um minuto e um ano.';
  end if;

  select * into v_profile
  from public.ranked_profiles where id = p_profile_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Perfil ranked não encontrado.';
  end if;
  v_previous := to_jsonb(v_profile);
  v_ends_at := case when p_duration_seconds is null then null
    else clock_timestamp() + make_interval(secs => p_duration_seconds) end;

  if v_action = 'ban' then
    update public.ranked_profiles
    set banned_at = clock_timestamp(), ban_reason = nullif(btrim(p_note), '')
    where id = p_profile_id;
    insert into public.ranked_penalties (
      profile_id, kind, reason, ends_at, created_by
    ) values (p_profile_id, 'ban', nullif(btrim(p_note), ''), null, v_support_id);
  elsif v_action = 'unban' then
    update public.ranked_profiles set banned_at = null, ban_reason = null
    where id = p_profile_id;
    update public.ranked_penalties
    set status = 'revoked', revoked_by = v_support_id, revoked_at = clock_timestamp()
    where profile_id = p_profile_id and kind = 'ban' and status = 'active';
  elsif v_action = 'freeze' then
    update public.ranked_profiles set frozen_until = v_ends_at where id = p_profile_id;
    insert into public.ranked_penalties (
      profile_id, kind, reason, ends_at, created_by
    ) values (
      p_profile_id, 'account_freeze', nullif(btrim(p_note), ''), v_ends_at, v_support_id
    );
  elsif v_action = 'unfreeze' then
    update public.ranked_profiles set frozen_until = null where id = p_profile_id;
    update public.ranked_penalties
    set status = 'revoked', revoked_by = v_support_id, revoked_at = clock_timestamp()
    where profile_id = p_profile_id
      and kind in ('account_freeze', 'manual_queue_lock')
      and status = 'active';
  elsif v_action = 'penalize' then
    insert into public.ranked_penalties (
      profile_id, kind, reason, ends_at, created_by
    ) values (
      p_profile_id, 'manual_queue_lock', nullif(btrim(p_note), ''), v_ends_at, v_support_id
    );
  end if;

  if v_action in ('ban', 'freeze', 'penalize') then
    update public.ranked_queue_entries
    set status = 'cancelled', left_at = clock_timestamp()
    where profile_id = p_profile_id and status = 'waiting';

    for v_active_match in
      select m.*
      from public.ranked_matches m
      join public.ranked_active_match_players amp on amp.match_id = m.id
      where amp.profile_id = p_profile_id
        and m.status = 'awaiting_acceptance'
      for update of m
    loop
      v_other_id := case when p_profile_id = v_active_match.player_one_id
        then v_active_match.player_two_id else v_active_match.player_one_id end;
      perform public.ranked_requeue_after_failed_acceptance(
        v_active_match.id, v_other_id
      );
      update public.ranked_queue_entries
      set status = 'cancelled', left_at = clock_timestamp()
      where match_id = v_active_match.id
        and profile_id = p_profile_id
        and status = 'matched';
      update public.ranked_matches
      set status = 'cancelled',
          cancelled_at = clock_timestamp(),
          cancellation_reason = 'Conta removida do confronto pelo suporte.'
      where id = v_active_match.id;
      delete from public.ranked_active_match_players
      where match_id = v_active_match.id;
    end loop;

    update public.ranked_matches m
    set status = 'frozen'
    from public.ranked_active_match_players amp
    where amp.profile_id = p_profile_id
      and amp.match_id = m.id
      and m.status in ('lobby', 'in_progress', 'awaiting_score', 'awaiting_confirmation');
  end if;

  select * into v_profile from public.ranked_profiles where id = p_profile_id;
  insert into public.support_audit_log (
    support_user_id, action, target_type, target_id,
    previous_state, next_state, note
  ) values (
    v_support_id, 'manage_profile:' || v_action, 'ranked_profile', p_profile_id::text,
    v_previous, to_jsonb(v_profile), nullif(btrim(p_note), '')
  );
  return v_profile;
end;
$$;

create or replace function public.ranked_acknowledge_post_match(
  p_match_id uuid,
  p_requeue boolean
)
returns public.ranked_post_match_choices
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_match public.ranked_matches%rowtype;
  v_choice public.ranked_post_match_choices%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;
  if p_requeue is null then
    raise exception using errcode = '22023', message = 'Informe sua escolha de pós-partida.';
  end if;
  perform public.ranked_check_rate_limit('post_match_choice', 20, 60);

  select * into v_match
  from public.ranked_matches
  where id = p_match_id
  for update;

  if not found
    or v_user_id not in (v_match.player_one_id, v_match.player_two_id)
    or v_match.status <> 'confirmed' then
    raise exception using errcode = 'P0001', message = 'O pós-partida não está disponível.';
  end if;

  insert into public.ranked_post_match_choices (match_id, profile_id, requeue)
  values (p_match_id, v_user_id, p_requeue)
  on conflict (match_id, profile_id) do nothing
  returning * into v_choice;

  if not found then
    select * into strict v_choice
    from public.ranked_post_match_choices
    where match_id = p_match_id and profile_id = v_user_id;
  end if;

  if v_choice.requeue then
    perform public.ranked_join_queue();
  end if;

  return v_choice;
end;
$$;
