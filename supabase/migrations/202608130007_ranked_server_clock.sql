-- Browsers can have a clock that differs substantially from the database.
-- Expose the authoritative clock so short acceptance deadlines are rendered
-- correctly without weakening the server-side deadline enforcement.
create or replace function public.ranked_server_now()
returns timestamptz
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select clock_timestamp();
$$;

revoke all on function public.ranked_server_now() from public, anon;
grant execute on function public.ranked_server_now() to authenticated;
