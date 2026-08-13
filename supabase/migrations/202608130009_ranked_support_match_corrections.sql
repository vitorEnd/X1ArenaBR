create or replace function public.ranked_support_correct_match(
  p_match_id uuid,
  p_player_one_score integer,
  p_player_two_score integer,
  p_player_one_mmr integer,
  p_player_two_mmr integer,
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
  v_new_winner uuid;
  v_new_loser uuid;
  v_player_one_old_mmr integer;
  v_player_two_old_mmr integer;
begin
  if not public.ranked_is_support(v_support_id) then
    raise exception using errcode = '42501', message = 'Acesso exclusivo do suporte.';
  end if;
  perform public.ranked_check_rate_limit('support_match_correction', 60, 60);

  if p_player_one_score is null or p_player_two_score is null
    or p_player_one_score < 0 or p_player_two_score < 0
    or p_player_one_score = p_player_two_score then
    raise exception using errcode = '22023', message = 'Informe um placar válido e sem empate.';
  end if;
  if p_player_one_mmr < 800 or p_player_two_mmr < 800 then
    raise exception using errcode = '22023', message = 'O MMR não pode ficar abaixo de 800.';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception using errcode = '22023', message = 'Informe uma justificativa interna.';
  end if;

  select * into v_match
  from public.ranked_matches
  where id = p_match_id
  for update;
  if not found or v_match.status <> 'confirmed' then
    raise exception using errcode = 'P0002', message = 'Partida confirmada não encontrada.';
  end if;
  if v_match.confirmed_at < clock_timestamp() - interval '24 hours' then
    raise exception using errcode = 'P0001', message = 'O prazo de correção desta partida expirou.';
  end if;

  v_previous := to_jsonb(v_match);
  v_new_winner := case when p_player_one_score > p_player_two_score
    then v_match.player_one_id else v_match.player_two_id end;
  v_new_loser := case when v_new_winner = v_match.player_one_id
    then v_match.player_two_id else v_match.player_one_id end;

  if v_match.winner_profile_id is distinct from v_new_winner then
    update public.ranked_profiles
    set wins = greatest(0, wins - 1), losses = losses + 1
    where id = v_match.winner_profile_id;
    update public.ranked_profiles
    set losses = greatest(0, losses - 1), wins = wins + 1
    where id = v_match.loser_profile_id;
  end if;

  select mmr into v_player_one_old_mmr
  from public.ranked_profiles where id = v_match.player_one_id for update;
  select mmr into v_player_two_old_mmr
  from public.ranked_profiles where id = v_match.player_two_id for update;

  update public.ranked_profiles
  set mmr = p_player_one_mmr,
      provisional_mmr = p_player_one_mmr,
      mmr_reached_at = clock_timestamp()
  where id = v_match.player_one_id;
  update public.ranked_profiles
  set mmr = p_player_two_mmr,
      provisional_mmr = p_player_two_mmr,
      mmr_reached_at = clock_timestamp()
  where id = v_match.player_two_id;

  insert into public.ranked_mmr_ledger (
    profile_id, reason, old_mmr, new_mmr, delta, is_placement, created_by
  ) values
    (v_match.player_one_id, 'support_adjustment', v_player_one_old_mmr,
      p_player_one_mmr, p_player_one_mmr - v_player_one_old_mmr, false, v_support_id),
    (v_match.player_two_id, 'support_adjustment', v_player_two_old_mmr,
      p_player_two_mmr, p_player_two_mmr - v_player_two_old_mmr, false, v_support_id);

  update public.ranked_matches
  set player_one_score = p_player_one_score,
      player_two_score = p_player_two_score,
      winner_profile_id = v_new_winner,
      loser_profile_id = v_new_loser,
      resolution_source = 'support',
      updated_at = clock_timestamp()
  where id = p_match_id
  returning * into v_match;

  insert into public.support_audit_log (
    support_user_id, action, target_type, target_id,
    previous_state, next_state, note
  ) values (
    v_support_id, 'correct_confirmed_match', 'ranked_match', p_match_id::text,
    v_previous, to_jsonb(v_match) || jsonb_build_object(
      'player_one_mmr', p_player_one_mmr,
      'player_two_mmr', p_player_two_mmr
    ), btrim(p_note)
  );

  return v_match;
end;
$$;

revoke all on function public.ranked_support_correct_match(
  uuid, integer, integer, integer, integer, text
) from public, anon;
grant execute on function public.ranked_support_correct_match(
  uuid, integer, integer, integer, integer, text
) to authenticated;
