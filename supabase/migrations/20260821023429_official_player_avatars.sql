-- Official tournament player portraits. Only the server-side support API writes
-- these records; the public site may read the current storage path.
create table if not exists public.arena_player_avatars (
  player_id text primary key,
  storage_path text not null unique,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint arena_player_avatars_player_id_safe
    check (player_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  constraint arena_player_avatars_path_canonical
    check (storage_path = 'official/' || lower(player_id) || '/avatar.webp')
);

create or replace function public.arena_set_player_avatar_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists arena_player_avatars_updated_at
  on public.arena_player_avatars;
create trigger arena_player_avatars_updated_at
before update on public.arena_player_avatars
for each row execute function public.arena_set_player_avatar_updated_at();

alter table public.arena_player_avatars enable row level security;

drop policy if exists arena_player_avatars_public_read
  on public.arena_player_avatars;
create policy arena_player_avatars_public_read
on public.arena_player_avatars
for select
to anon, authenticated
using (true);

revoke all on table public.arena_player_avatars from public, anon, authenticated;
grant select (player_id, storage_path, updated_at)
  on table public.arena_player_avatars
  to anon, authenticated;
grant all on table public.arena_player_avatars to service_role;

revoke all on function public.arena_set_player_avatar_updated_at()
  from public, anon, authenticated;
grant execute on function public.arena_set_player_avatar_updated_at()
  to service_role;

-- The bucket is public for rendering, but it has no client-side write policy.
-- Official uploads are always normalized to WebP by the support surface.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'player-avatars',
  'player-avatars',
  true,
  5242880,
  array['image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists player_avatars_public_read on storage.objects;
create policy player_avatars_public_read
on storage.objects
for select
to public
using (bucket_id = 'player-avatars');
