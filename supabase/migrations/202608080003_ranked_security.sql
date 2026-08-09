-- AXB Ranked Matchmaking: least-privilege grants, RLS, Storage and Realtime.

create or replace function public.ranked_mark_notification_read(p_notification_id uuid)
returns public.ranked_notifications
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_notification public.ranked_notifications%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;

  update public.ranked_notifications
  set read_at = coalesce(read_at, clock_timestamp())
  where id = p_notification_id
    and audience = 'profile'
    and recipient_profile_id = auth.uid()
  returning * into v_notification;

  if not found then
    raise exception using errcode = 'P0002', message = 'Notificação não encontrada.';
  end if;
  return v_notification;
end;
$$;

create or replace function public.ranked_get_queue_count()
returns bigint
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select count(*)
  from public.ranked_queue_entries
  where status = 'waiting'
    and heartbeat_at >= clock_timestamp() - interval '20 seconds';
$$;

alter table public.ranked_profiles enable row level security;
alter table public.ranked_username_history enable row level security;
alter table public.ranked_matches enable row level security;
alter table public.ranked_queue_entries enable row level security;
alter table public.ranked_active_match_players enable row level security;
alter table public.ranked_match_acceptances enable row level security;
alter table public.ranked_result_confirmations enable row level security;
alter table public.ranked_post_match_choices enable row level security;
alter table public.ranked_match_reports enable row level security;
alter table public.ranked_mmr_ledger enable row level security;
alter table public.ranked_penalties enable row level security;
alter table public.ranked_notifications enable row level security;
alter table public.support_users enable row level security;
alter table public.support_audit_log enable row level security;
alter table public.ranked_rate_limits enable row level security;

drop policy if exists ranked_profiles_read_own on public.ranked_profiles;
create policy ranked_profiles_read_own
on public.ranked_profiles for select to authenticated
using (id = auth.uid() or public.ranked_is_support());

drop policy if exists ranked_username_history_support_read on public.ranked_username_history;
create policy ranked_username_history_support_read
on public.ranked_username_history for select to authenticated
using (public.ranked_is_support());

drop policy if exists ranked_matches_participant_read on public.ranked_matches;
create policy ranked_matches_participant_read
on public.ranked_matches for select to authenticated
using (
  auth.uid() in (player_one_id, player_two_id)
  or public.ranked_is_support()
);

drop policy if exists ranked_queue_entries_own_read on public.ranked_queue_entries;
create policy ranked_queue_entries_own_read
on public.ranked_queue_entries for select to authenticated
using (profile_id = auth.uid() or public.ranked_is_support());

drop policy if exists ranked_active_match_players_participant_read
  on public.ranked_active_match_players;
create policy ranked_active_match_players_participant_read
on public.ranked_active_match_players for select to authenticated
using (profile_id = auth.uid() or public.ranked_is_support());

drop policy if exists ranked_match_acceptances_participant_read
  on public.ranked_match_acceptances;
create policy ranked_match_acceptances_participant_read
on public.ranked_match_acceptances for select to authenticated
using (
  exists (
    select 1
    from public.ranked_matches m
    where m.id = match_id
      and auth.uid() in (m.player_one_id, m.player_two_id)
  )
  or public.ranked_is_support()
);

drop policy if exists ranked_result_confirmations_participant_read
  on public.ranked_result_confirmations;
create policy ranked_result_confirmations_participant_read
on public.ranked_result_confirmations for select to authenticated
using (
  exists (
    select 1
    from public.ranked_matches m
    where m.id = match_id
      and auth.uid() in (m.player_one_id, m.player_two_id)
  )
  or public.ranked_is_support()
);

drop policy if exists ranked_post_match_choices_own_read
  on public.ranked_post_match_choices;
create policy ranked_post_match_choices_own_read
on public.ranked_post_match_choices for select to authenticated
using (profile_id = auth.uid() or public.ranked_is_support());

drop policy if exists ranked_match_reports_reporter_read on public.ranked_match_reports;
create policy ranked_match_reports_reporter_read
on public.ranked_match_reports for select to authenticated
using (reporter_profile_id = auth.uid() or public.ranked_is_support());

drop policy if exists ranked_mmr_ledger_own_read on public.ranked_mmr_ledger;
create policy ranked_mmr_ledger_own_read
on public.ranked_mmr_ledger for select to authenticated
using (profile_id = auth.uid() or public.ranked_is_support());

drop policy if exists ranked_penalties_own_read on public.ranked_penalties;
create policy ranked_penalties_own_read
on public.ranked_penalties for select to authenticated
using (profile_id = auth.uid() or public.ranked_is_support());

drop policy if exists ranked_notifications_authorized_read on public.ranked_notifications;
create policy ranked_notifications_authorized_read
on public.ranked_notifications for select to authenticated
using (
  (audience = 'profile' and recipient_profile_id = auth.uid())
  or (audience = 'support' and public.ranked_is_support())
);

drop policy if exists support_users_support_read on public.support_users;
create policy support_users_support_read
on public.support_users for select to authenticated
using (public.ranked_is_support());

drop policy if exists support_audit_log_support_read on public.support_audit_log;
create policy support_audit_log_support_read
on public.support_audit_log for select to authenticated
using (public.ranked_is_support());

-- No policies are intentionally created for ranked_rate_limits: only definer RPCs use it.

revoke all on table public.ranked_profiles from anon, authenticated;
revoke all on table public.ranked_username_history from anon, authenticated;
revoke all on table public.ranked_matches from anon, authenticated;
revoke all on table public.ranked_queue_entries from anon, authenticated;
revoke all on table public.ranked_active_match_players from anon, authenticated;
revoke all on table public.ranked_match_acceptances from anon, authenticated;
revoke all on table public.ranked_result_confirmations from anon, authenticated;
revoke all on table public.ranked_post_match_choices from anon, authenticated;
revoke all on table public.ranked_match_reports from anon, authenticated;
revoke all on table public.ranked_mmr_ledger from anon, authenticated;
revoke all on table public.ranked_penalties from anon, authenticated;
revoke all on table public.ranked_notifications from anon, authenticated;
revoke all on table public.support_users from anon, authenticated;
revoke all on table public.support_audit_log from anon, authenticated;
revoke all on table public.ranked_rate_limits from anon, authenticated;

grant select (
  id, username, avatar_path, wins, losses,
  placement_matches, placement_wins, mmr_reached_at,
  last_username_changed_at, queue_strike_count,
  no_accept_penalty_level, frozen_until, banned_at, ban_reason,
  created_at, updated_at
) on public.ranked_profiles to authenticated;
grant select on table public.ranked_username_history to authenticated;
grant select on table public.ranked_matches to authenticated;
grant select (
  id, profile_id, status, joined_at, heartbeat_at,
  matched_at, match_id, left_at, created_at, updated_at
) on public.ranked_queue_entries to authenticated;
grant select on table public.ranked_active_match_players to authenticated;
grant select on table public.ranked_match_acceptances to authenticated;
grant select on table public.ranked_result_confirmations to authenticated;
grant select on table public.ranked_post_match_choices to authenticated;
grant select on table public.ranked_match_reports to authenticated;
grant select on table public.ranked_mmr_ledger to authenticated;
grant select on table public.ranked_penalties to authenticated;
grant select on table public.ranked_notifications to authenticated;
grant select on table public.support_users to authenticated;
grant select on table public.support_audit_log to authenticated;

revoke all on table public.ranked_global_standings from public, anon, authenticated;
grant select on table public.ranked_public_profiles to anon, authenticated;
grant select on table public.ranked_leaderboard to anon, authenticated;
grant select on table public.ranked_public_match_history to anon, authenticated;

-- Functions are executable by PUBLIC by default. Revoke every ranked/support helper,
-- then grant only the intended API surface to authenticated clients.
do $$
declare v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'ranked\_%' escape '\' or p.proname = 'support_audit_log')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_function);
  end loop;
end $$;

grant execute on function public.ranked_create_profile(text) to authenticated;
grant execute on function public.ranked_update_username(text) to authenticated;
grant execute on function public.ranked_set_avatar_path(text) to authenticated;
grant execute on function public.ranked_get_my_profile() to authenticated;
grant execute on function public.ranked_get_queue_count() to authenticated;
-- RLS policies evaluate this helper as the caller, so authenticated needs EXECUTE.
-- The UUID is unguessable and the function exposes no account data beyond support status.
grant execute on function public.ranked_is_support(uuid) to authenticated;
grant execute on function public.ranked_join_queue() to authenticated;
grant execute on function public.ranked_queue_heartbeat(uuid) to authenticated;
grant execute on function public.ranked_leave_queue(uuid) to authenticated;
grant execute on function public.ranked_try_matchmake() to authenticated;
grant execute on function public.ranked_respond_to_match(uuid, boolean) to authenticated;
grant execute on function public.ranked_start_match(uuid) to authenticated;
grant execute on function public.ranked_end_match(uuid) to authenticated;
grant execute on function public.ranked_submit_score(uuid, integer, integer) to authenticated;
grant execute on function public.ranked_confirm_result(uuid, boolean) to authenticated;
grant execute on function public.ranked_acknowledge_post_match(uuid, boolean)
  to authenticated;
grant execute on function public.ranked_report_problem(uuid, public.ranked_report_category, text)
  to authenticated;
grant execute on function public.ranked_mark_notification_read(uuid) to authenticated;
grant execute on function public.ranked_reconcile() to authenticated;
grant execute on function public.ranked_support_resolve_match(
  uuid, text, integer, integer, uuid, text
) to authenticated;
grant execute on function public.ranked_support_adjust_mmr(uuid, integer, text)
  to authenticated;
grant execute on function public.ranked_support_manage_profile(uuid, text, integer, text)
  to authenticated;

-- Public avatars are intentionally readable. Mutations are scoped to the first
-- path segment, which must be the authenticated user's UUID.
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'ranked-avatars',
  'ranked-avatars',
  true,
  5242880,
  array['image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ranked_avatars_public_read on storage.objects;
create policy ranked_avatars_public_read
on storage.objects for select to public
using (bucket_id = 'ranked-avatars');

drop policy if exists ranked_avatars_owner_insert on storage.objects;
create policy ranked_avatars_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ranked-avatars'
  and name = auth.uid()::text || '/avatar.webp'
);

drop policy if exists ranked_avatars_owner_update on storage.objects;
create policy ranked_avatars_owner_update
on storage.objects for update to authenticated
using (
  bucket_id = 'ranked-avatars'
  and name = auth.uid()::text || '/avatar.webp'
)
with check (
  bucket_id = 'ranked-avatars'
  and name = auth.uid()::text || '/avatar.webp'
);

drop policy if exists ranked_avatars_owner_delete on storage.objects;
create policy ranked_avatars_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'ranked-avatars'
  and name = auth.uid()::text || '/avatar.webp'
);

alter table public.ranked_profiles replica identity full;
alter table public.ranked_queue_entries replica identity full;
alter table public.ranked_matches replica identity full;
alter table public.ranked_match_acceptances replica identity full;
alter table public.ranked_result_confirmations replica identity full;
alter table public.ranked_post_match_choices replica identity full;
alter table public.ranked_notifications replica identity full;

do $$
declare v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array[
      'ranked_profiles',
      'ranked_queue_entries',
      'ranked_matches',
      'ranked_match_acceptances',
      'ranked_result_confirmations',
      'ranked_post_match_choices',
      'ranked_notifications'
    ]
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_table
      ) then
        execute format(
          'alter publication supabase_realtime add table public.%I',
          v_table
        );
      end if;
    end loop;
  end if;
end $$;
