-- Allows the creator to finish a lobby directly, without a separate start step.
create or replace function public.ranked_end_match(p_match_id uuid)
returns public.ranked_matches
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_match public.ranked_matches%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;

  perform public.ranked_check_rate_limit('match_lifecycle', 30, 60);

  select * into v_match
  from public.ranked_matches
  where id = p_match_id
  for update;

  if not found or v_match.creator_profile_id <> auth.uid() then
    raise exception using errcode = 'P0001', message = 'Somente o criador pode finalizar esta partida.';
  end if;

  if v_match.status = 'awaiting_score' then
    return v_match;
  end if;

  if v_match.status <> 'lobby' then
    raise exception using errcode = 'P0001', message = 'A partida não está em um lobby aberto.';
  end if;

  update public.ranked_matches
  set status = 'awaiting_score',
      ended_at = clock_timestamp(),
      score_deadline = clock_timestamp() + interval '3 minutes'
  where id = p_match_id
  returning * into v_match;

  return v_match;
end;
$$;

revoke all on function public.ranked_end_match(uuid) from public, anon;
grant execute on function public.ranked_end_match(uuid) to authenticated;