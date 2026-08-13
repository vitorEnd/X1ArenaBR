-- Support bans are always temporary and use ranked_penalties as the authoritative expiry.
-- The profile flags remain a fast access guard and are cleared by reconciliation.

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

  update public.ranked_profiles p
  set banned_at = null, ban_reason = null
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
        perform public.ranked_requeue_after_failed_acceptance(v_match.id, v_acceptance.profile_id);
      end if;
    end loop;

    update public.ranked_queue_entries
    set status = 'expired', left_at = clock_timestamp()
    where match_id = v_match.id and status = 'matched';

    update public.ranked_matches
    set status = 'cancelled', cancelled_at = clock_timestamp(),
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
    insert into public.ranked_notifications (audience, kind, title, body, payload)
    values (
      'support', 'support_required', 'Placar não enviado',
      'O criador não enviou o placar no prazo de três minutos.',
      jsonb_build_object('matchId', v_match.id, 'matchNumber', v_match.match_number)
    );
    v_frozen_scores := v_frozen_scores + 1;
  end loop;

  for v_match in
    select *
    from public.ranked_matches
    where status = 'awaiting_confirmation' and confirmation_deadline <= clock_timestamp()
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
  if v_action = 'ban'
    and (p_duration_seconds is null or p_duration_seconds < 60 or p_duration_seconds > 360000) then
    raise exception using errcode = '22023', message = 'Informe uma duração entre um minuto e 100 horas.';
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
    update public.ranked_penalties
    set status = 'revoked', revoked_by = v_support_id, revoked_at = clock_timestamp()
    where profile_id = p_profile_id and kind = 'ban' and status = 'active';
    update public.ranked_profiles
    set banned_at = clock_timestamp(), ban_reason = nullif(btrim(p_note), '')
    where id = p_profile_id;
    insert into public.ranked_penalties (profile_id, kind, reason, ends_at, created_by)
    values (p_profile_id, 'ban', nullif(btrim(p_note), ''), v_ends_at, v_support_id);
  elsif v_action = 'unban' then
    update public.ranked_profiles set banned_at = null, ban_reason = null
    where id = p_profile_id;
    update public.ranked_penalties
    set status = 'revoked', revoked_by = v_support_id, revoked_at = clock_timestamp()
    where profile_id = p_profile_id and kind = 'ban' and status = 'active';
  elsif v_action = 'freeze' then
    update public.ranked_profiles set frozen_until = v_ends_at where id = p_profile_id;
    insert into public.ranked_penalties (profile_id, kind, reason, ends_at, created_by)
    values (p_profile_id, 'account_freeze', nullif(btrim(p_note), ''), v_ends_at, v_support_id);
  elsif v_action = 'unfreeze' then
    update public.ranked_profiles set frozen_until = null where id = p_profile_id;
    update public.ranked_penalties
    set status = 'revoked', revoked_by = v_support_id, revoked_at = clock_timestamp()
    where profile_id = p_profile_id
      and kind in ('account_freeze', 'manual_queue_lock') and status = 'active';
  elsif v_action = 'penalize' then
    insert into public.ranked_penalties (profile_id, kind, reason, ends_at, created_by)
    values (p_profile_id, 'manual_queue_lock', nullif(btrim(p_note), ''), v_ends_at, v_support_id);
  end if;

  if v_action in ('ban', 'freeze', 'penalize') then
    update public.ranked_queue_entries
    set status = 'cancelled', left_at = clock_timestamp()
    where profile_id = p_profile_id and status = 'waiting';

    for v_active_match in
      select m.*
      from public.ranked_matches m
      join public.ranked_active_match_players amp on amp.match_id = m.id
      where amp.profile_id = p_profile_id and m.status = 'awaiting_acceptance'
      for update of m
    loop
      v_other_id := case when p_profile_id = v_active_match.player_one_id
        then v_active_match.player_two_id else v_active_match.player_one_id end;
      perform public.ranked_requeue_after_failed_acceptance(v_active_match.id, v_other_id);
      update public.ranked_queue_entries
      set status = 'cancelled', left_at = clock_timestamp()
      where match_id = v_active_match.id and profile_id = p_profile_id and status = 'matched';
      update public.ranked_matches
      set status = 'cancelled', cancelled_at = clock_timestamp(),
          cancellation_reason = 'Conta removida do confronto pelo suporte.'
      where id = v_active_match.id;
      delete from public.ranked_active_match_players where match_id = v_active_match.id;
    end loop;

    update public.ranked_matches m
    set status = 'frozen'
    from public.ranked_active_match_players amp
    where amp.profile_id = p_profile_id and amp.match_id = m.id
      and m.status in ('lobby', 'in_progress', 'awaiting_score', 'awaiting_confirmation');
  end if;

  select * into v_profile from public.ranked_profiles where id = p_profile_id;
  insert into public.support_audit_log (
    support_user_id, action, target_type, target_id, previous_state, next_state, note
  ) values (
    v_support_id, 'manage_profile:' || v_action, 'ranked_profile', p_profile_id::text,
    v_previous, to_jsonb(v_profile), nullif(btrim(p_note), '')
  );
  return v_profile;
end;
$$;

revoke all on function public.ranked_is_support(uuid) from public, anon;
revoke all on function public.ranked_support_resolve_match(uuid, text, integer, integer, uuid, text)
from public, anon;
revoke all on function public.ranked_support_adjust_mmr(uuid, integer, text)
from public, anon;
revoke all on function public.ranked_support_manage_profile(uuid, text, integer, text)
from public, anon;

grant execute on function public.ranked_is_support(uuid) to authenticated;
grant execute on function public.ranked_support_resolve_match(uuid, text, integer, integer, uuid, text)
to authenticated;
grant execute on function public.ranked_support_adjust_mmr(uuid, integer, text)
to authenticated;
grant execute on function public.ranked_support_manage_profile(uuid, text, integer, text)
to authenticated;
