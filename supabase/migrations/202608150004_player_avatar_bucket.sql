-- Public player portraits managed by authorized support staff.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-avatars', 'player-avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

do $
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'player_avatars_public_read'
  ) then
    create policy player_avatars_public_read on storage.objects
    for select using (bucket_id = 'player-avatars');
  end if;
end;
$;