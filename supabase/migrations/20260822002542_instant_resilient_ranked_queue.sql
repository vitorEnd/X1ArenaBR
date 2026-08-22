begin;

-- A browser can briefly pause background timers. Keep a two-minute lease so a
-- healthy player is not removed by a short scheduling or network delay.
create or replace function public.ranked_get_queue_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.ranked_queue_entries
  where status = 'waiting'
    and heartbeat_at >= clock_timestamp() - interval '2 minutes';
$$;

create or replace function public.ranked_reconcile()
returns jsonb
language plpgsql
security definer
set search_path = ''
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
  where status = 'active'
    and ends_at is not null
    and ends_at <= clock_timestamp();

  update public.ranked_profiles p
  set banned_at = null,
      ban_reason = null
  where p.banned_at is not null
    and not exists (
      select 1
      from public.ranked_penalties pen
      where pen.profile_id = p.id
        and pen.kind = 'ban'
        and pen.status = 'active'
        and pen.ends_at > clock_timestamp()
    );

  update public.ranked_queue_entries
  set status = 'expired',
      left_at = clock_timestamp()
  where status = 'waiting'
    and heartbeat_at < clock_timestamp() - interval '2 minutes';
  get diagnostics v_expired_queue = row_count;

  for v_match in
    select *
    from public.ranked_matches
    where status = 'awaiting_acceptance'
      and accept_deadline <= clock_timestamp()
    order by accept_deadline
    for update skip locked
  loop
    for v_acceptance in
      select *
      from public.ranked_match_acceptances
      where match_id = v_match.id
    loop
      if v_acceptance.state = 'pending' then
        update public.ranked_match_acceptances
        set state = 'expired',
            responded_at = clock_timestamp()
        where id = v_acceptance.id;
        perform public.ranked_record_no_accept(v_acceptance.profile_id);
      elsif v_acceptance.state = 'accepted' then
        perform public.ranked_requeue_after_failed_acceptance(
          v_match.id,
          v_acceptance.profile_id
        );
      end if;
    end loop;

    update public.ranked_queue_entries
    set status = 'expired',
        left_at = clock_timestamp()
    where match_id = v_match.id
      and status = 'matched';

    update public.ranked_matches
    set status = 'cancelled',
        cancelled_at = clock_timestamp(),
        cancellation_reason = 'Prazo de aceite encerrado.'
    where id = v_match.id;

    delete from public.ranked_active_match_players
    where match_id = v_match.id;
    v_expired_acceptances := v_expired_acceptances + 1;
  end loop;

  for v_match in
    select *
    from public.ranked_matches
    where status = 'awaiting_score'
      and score_deadline <= clock_timestamp()
    order by score_deadline
    for update skip locked
  loop
    update public.ranked_matches
    set status = 'frozen'
    where id = v_match.id;

    insert into public.ranked_notifications (
      audience,
      kind,
      title,
      body,
      payload
    ) values (
      'support',
      'support_required',
      'Placar não enviado',
      'O criador não enviou o placar no prazo de três minutos.',
      jsonb_build_object(
        'matchId', v_match.id,
        'matchNumber', v_match.match_number
      )
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
    set state = 'auto_approved',
        responded_at = clock_timestamp()
    where match_id = v_match.id
      and profile_id <> v_match.creator_profile_id
      and state = 'pending';

    perform public.ranked_finalize_match_internal(
      v_match.id,
      'automatic',
      null
    );
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

-- Serialize the tiny matchmaking critical section. Without this lock, two
-- players ticking at the same moment can each lock their own row and skip the
-- other one, leaving both searching even though the queue has two players.
create or replace function public.ranked_try_matchmake()
returns public.ranked_matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_self public.ranked_queue_entries%rowtype;
  v_opponent public.ranked_queue_entries%rowtype;
  v_match public.ranked_matches%rowtype;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'Autenticação obrigatória.';
  end if;

  perform public.ranked_check_rate_limit('matchmake', 120, 60);
  perform pg_advisory_xact_lock(1096301645, 1);
  perform public.ranked_reconcile();

  select * into v_self
  from public.ranked_queue_entries
  where profile_id = v_user_id
    and status = 'waiting'
  for update;

  if not found then
    return null;
  end if;

  select q.* into v_opponent
  from public.ranked_queue_entries q
  join public.ranked_profiles p on p.id = q.profile_id
  where q.status = 'waiting'
    and q.profile_id <> v_user_id
    and q.heartbeat_at >= clock_timestamp() - interval '2 minutes'
    and p.banned_at is null
    and (p.frozen_until is null or p.frozen_until <= clock_timestamp())
    and not exists (
      select 1
      from public.ranked_active_match_players amp
      where amp.profile_id = q.profile_id
    )
    and not exists (
      select 1
      from public.ranked_penalties pen
      where pen.profile_id = q.profile_id
        and pen.status = 'active'
        and (pen.ends_at is null or pen.ends_at > clock_timestamp())
    )
  order by q.joined_at, q.id
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
  set status = 'matched',
      matched_at = clock_timestamp(),
      match_id = v_match.id
  where id in (v_self.id, v_opponent.id);

  insert into public.ranked_notifications (
    audience,
    recipient_profile_id,
    kind,
    title,
    body,
    payload
  )
  select
    'profile',
    participant_id,
    'match_found',
    'Partida encontrada',
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

-- One network call renews the lease and attempts matchmaking. If another
-- player's tick already created a match, return it so the client refreshes
-- immediately even when Realtime delivery is delayed.
create or replace function public.ranked_queue_tick()
returns public.ranked_matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_entry public.ranked_queue_entries%rowtype;
  v_match public.ranked_matches%rowtype;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'Autenticação obrigatória.';
  end if;

  select * into v_match
  from public.ranked_matches
  where v_user_id in (player_one_id, player_two_id)
    and status not in ('confirmed', 'cancelled')
  order by created_at desc
  limit 1;

  if found then
    return v_match;
  end if;

  update public.ranked_queue_entries
  set heartbeat_at = clock_timestamp()
  where profile_id = v_user_id
    and status = 'waiting'
  returning * into v_entry;

  if not found then
    return null;
  end if;

  return public.ranked_try_matchmake();
end;
$$;

revoke all on function public.ranked_get_queue_count()
from public, anon, authenticated;
revoke all on function public.ranked_reconcile()
from public, anon, authenticated;
revoke all on function public.ranked_try_matchmake()
from public, anon, authenticated;
revoke all on function public.ranked_queue_tick()
from public, anon, authenticated;

grant execute on function public.ranked_get_queue_count()
to authenticated, service_role;
grant execute on function public.ranked_reconcile()
to authenticated;
grant execute on function public.ranked_try_matchmake()
to authenticated;
grant execute on function public.ranked_queue_tick()
to authenticated;

commit;
