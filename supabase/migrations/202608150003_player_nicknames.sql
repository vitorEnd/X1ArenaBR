create table if not exists public.arena_player_nicknames (
  player_id text primary key,
  nickname text not null check (char_length(btrim(nickname)) between 2 and 48),
  color text not null default 'purple' check (color in ('purple', 'gold', 'red')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references auth.users(id)
);

create or replace function public.arena_set_nickname_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.nickname = btrim(new.nickname);
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists arena_player_nicknames_updated_at on public.arena_player_nicknames;
create trigger arena_player_nicknames_updated_at
before update on public.arena_player_nicknames
for each row execute function public.arena_set_nickname_updated_at();

alter table public.arena_player_nicknames enable row level security;
drop policy if exists arena_player_nicknames_public_read on public.arena_player_nicknames;
create policy arena_player_nicknames_public_read on public.arena_player_nicknames
for select using (true);

revoke all on public.arena_player_nicknames from anon, authenticated;
grant select on public.arena_player_nicknames to anon, authenticated;
grant all on public.arena_player_nicknames to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-avatars', 'player-avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;