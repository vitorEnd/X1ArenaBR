-- Repair migration for anonymous mode on databases where migration 003 was
-- already recorded or where the existing RPC signature prevented replacement.
-- Keep this migration idempotent: it is safe to paste into Supabase SQL Editor.
create sequence if not exists public.ranked_anonymous_number_seq;

alter table public.ranked_profiles
  add column if not exists anonymous_mode boolean not null default false,
  add column if not exists anonymous_number bigint;

create unique index if not exists ranked_profiles_anonymous_number_unique
  on public.ranked_profiles (anonymous_number)
  where anonymous_number is not null;

drop function if exists public.ranked_get_my_profile();

drop view if exists public.ranked_leaderboard;
drop view if exists public.ranked_public_profiles;
create function public.ranked_get_my_profile()
returns table (
  id uuid, username text, avatar_path text, wins integer, losses integer, mmr integer,
  placement_matches smallint, placement_wins smallint, mmr_reached_at timestamptz,
  last_username_changed_at timestamptz, queue_strike_count smallint,
  no_accept_penalty_level smallint, frozen_until timestamptz, banned_at timestamptz,
  ban_reason text, created_at timestamptz, updated_at timestamptz,
  anonymous_mode boolean, anonymous_number bigint
)
language sql stable security definer
set search_path = public, auth, pg_temp
as $$
  select p.id, p.username::text, p.avatar_path, p.wins, p.losses,
    case when p.placement_matches = 5 then p.mmr else null end,
    p.placement_matches, p.placement_wins, p.mmr_reached_at,
    p.last_username_changed_at, p.queue_strike_count, p.no_accept_penalty_level,
    p.frozen_until, p.banned_at, p.ban_reason, p.created_at, p.updated_at,
    p.anonymous_mode, p.anonymous_number
  from public.ranked_profiles p where p.id = auth.uid();
$$;

grant execute on function public.ranked_get_my_profile() to authenticated;
create or replace function public.ranked_set_anonymous_mode(p_enabled boolean)
returns public.ranked_profiles
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare v_profile public.ranked_profiles%rowtype; v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception using errcode = '28000', message = 'Autenticação obrigatória.'; end if;
  update public.ranked_profiles
  set anonymous_mode = coalesce(p_enabled, false),
      anonymous_number = case when coalesce(p_enabled, false) and anonymous_number is null
        then nextval('public.ranked_anonymous_number_seq') else anonymous_number end
  where id = v_user_id returning * into v_profile;
  if not found then raise exception using errcode = 'P0002', message = 'Crie seu perfil ranked primeiro.'; end if;
  return v_profile;
end;
$$;

grant execute on function public.ranked_set_anonymous_mode(boolean) to authenticated;

create view public.ranked_public_profiles with (security_barrier = true) as
select p.id,
  case when p.anonymous_mode then 'Anonimo' || lpad(p.anonymous_number::text, 4, '0') else p.username end as username,
  case when p.anonymous_mode then null else p.avatar_path end as avatar_path,
  case when p.anonymous_mode then 0 else p.wins end as wins,
  case when p.anonymous_mode then 0 else p.losses end as losses,
  case when p.anonymous_mode then null else p.mmr end as mmr,
  p.placement_matches, p.placement_wins,
  case when p.anonymous_mode then null else g.global_position end as global_position,
  case when p.anonymous_mode then null else g.tier end as tier,
  p.created_at, p.updated_at, p.anonymous_mode
from public.ranked_profiles p
left join public.ranked_global_standings g on g.id = p.id
where p.banned_at is null;

create view public.ranked_leaderboard with (security_barrier = true) as
select * from public.ranked_public_profiles
where global_position <= 50 or anonymous_mode;

-- Migration 003/004 can run after the security migration. Re-apply the grants
-- because DROP VIEW removes the old view privileges.
grant select on public.ranked_public_profiles to anon, authenticated;
grant select on public.ranked_leaderboard to anon, authenticated;
grant execute on function public.ranked_get_my_profile() to authenticated;
grant execute on function public.ranked_set_anonymous_mode(boolean) to authenticated;

grant select on public.ranked_public_profiles to anon, authenticated;
grant select on public.ranked_leaderboard to anon, authenticated;
