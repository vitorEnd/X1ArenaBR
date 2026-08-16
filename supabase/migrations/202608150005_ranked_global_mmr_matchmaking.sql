-- Ranked matchmaking intentionally ignores MMR distance from the first search attempt.
-- This lets players in any rank, including unplaced players, find each other globally.

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