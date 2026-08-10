-- AXB Ranked: authoritative deadline reconciliation.
-- The function is idempotent, so a short interval is safe and keeps the
-- 15-second acceptance window accurate even when no browser is connected.

create extension if not exists pg_cron;

do $$
declare
  v_existing_job_id bigint;
begin
  select jobid
  into v_existing_job_id
  from cron.job
  where jobname = 'ranked-reconcile'
  limit 1;

  if v_existing_job_id is not null then
    perform cron.unschedule(v_existing_job_id);
  end if;

  perform cron.schedule(
    'ranked-reconcile',
    '5 seconds',
    $command$ select public.ranked_reconcile(); $command$
  );
end;
$$;

