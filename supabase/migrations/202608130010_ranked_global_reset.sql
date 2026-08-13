create or replace function public.ranked_support_reset_all(
  p_support_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_profile_count integer;
  v_match_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Acesso exclusivo do servidor.';
  end if;
  if p_support_user_id is null or not exists (
    select 1 from public.support_users
    where user_id = p_support_user_id and is_active
  ) then
    raise exception using errcode = '42501', message = 'Suporte não autorizado.';
  end if;

  perform pg_advisory_xact_lock(hashtext('ranked_global_reset'));
  select count(*)::integer into v_profile_count from public.ranked_profiles;
  select count(*)::integer into v_match_count from public.ranked_matches;

  delete from public.ranked_match_reports;
  delete from public.ranked_post_match_choices;
  delete from public.ranked_result_confirmations;
  delete from public.ranked_match_acceptances;
  delete from public.ranked_active_match_players;
  delete from public.ranked_queue_entries;
  delete from public.ranked_mmr_ledger;
  delete from public.ranked_matches;

  delete from public.ranked_notifications;
  delete from public.ranked_rate_limits;
  delete from public.ranked_penalties where kind = 'no_accept';

  update public.ranked_profiles
  set wins = 0,
      losses = 0,
      mmr = 800,
      provisional_mmr = 800,
      placement_matches = 0,
      placement_wins = 0,
      mmr_reached_at = clock_timestamp(),
      queue_strike_count = 0,
      no_accept_penalty_level = 0,
      updated_at = clock_timestamp();

  insert into public.support_audit_log (
    support_user_id,
    action,
    target_type,
    target_id,
    previous_state,
    next_state,
    note
  ) values (
    p_support_user_id,
    'reset_ranked',
    'ranked_system',
    'global',
    jsonb_build_object('profiles', v_profile_count, 'matches', v_match_count),
    jsonb_build_object('profiles', v_profile_count, 'matches', 0, 'mmr', 800),
    'Reset global autorizado pela central de suporte.'
  );

  return jsonb_build_object(
    'profiles_reset', v_profile_count,
    'matches_removed', v_match_count
  );
end;
$$;

revoke all on function public.ranked_support_reset_all(uuid)
from public, anon, authenticated;
grant execute on function public.ranked_support_reset_all(uuid)
to service_role;
