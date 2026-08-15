begin;

create or replace function public.ranked_support_start_match(
  p_match_id uuid,
  p_note text
)
returns public.ranked_matches
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_support_id uuid := auth.uid();
  v_match public.ranked_matches%rowtype;
  v_previous jsonb;
begin
  if not public.ranked_is_support(v_support_id) then
    raise exception using errcode = '42501', message = 'Acesso exclusivo do suporte.';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception using errcode = '22023', message = 'Informe uma justificativa interna.';
  end if;

  select * into v_match
  from public.ranked_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Partida ranked não encontrada.';
  end if;
  if v_match.status <> 'lobby' then
    raise exception using errcode = 'P0001', message = 'Somente um lobby aguardando início pode ser iniciado pelo suporte.';
  end if;

  v_previous := to_jsonb(v_match);

  update public.ranked_matches
  set status = 'in_progress',
      started_at = clock_timestamp()
  where id = p_match_id
  returning * into v_match;

  insert into public.support_audit_log (
    support_user_id, action, target_type, target_id,
    previous_state, next_state, note
  ) values (
    v_support_id, 'start_match', 'ranked_match', p_match_id::text,
    v_previous, to_jsonb(v_match), btrim(p_note)
  );

  insert into public.ranked_notifications (
    audience, recipient_profile_id, kind, title, body, payload
  )
  select
    'profile', participant_id, 'support_resolution', 'Partida iniciada pelo suporte',
    'O suporte liberou o início deste X1.',
    jsonb_build_object('matchId', v_match.id, 'matchNumber', v_match.match_number)
  from unnest(array[v_match.player_one_id, v_match.player_two_id]) participant_id;

  return v_match;
end;
$$;

revoke all on function public.ranked_support_start_match(uuid, text) from public, anon;
grant execute on function public.ranked_support_start_match(uuid, text) to authenticated;

commit;
