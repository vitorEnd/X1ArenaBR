begin;

create or replace function public.ranked_finalize_match_internal(
  p_match_id uuid,
  p_source public.ranked_resolution_source,
  p_support_user_id uuid default null
)
returns public.ranked_matches
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_match public.ranked_matches%rowtype;
  v_winner public.ranked_profiles%rowtype;
  v_loser public.ranked_profiles%rowtype;
  v_winner_effective integer;
  v_loser_effective integer;
  v_expected_winner numeric;
  v_winner_gain integer;
  v_loser_loss integer;
  v_winner_new_mmr integer;
  v_loser_new_mmr integer;
  v_winner_new_matches integer;
  v_loser_new_matches integer;
  v_winner_new_placement_wins integer;
begin
  select * into v_match
  from public.ranked_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Partida ranked não encontrada.';
  end if;
  if v_match.status = 'confirmed' then
    return v_match;
  end if;
  if v_match.status not in ('awaiting_confirmation', 'frozen', 'disputed') then
    raise exception using errcode = 'P0001', message = 'A partida não está pronta para confirmação.';
  end if;
  if v_match.winner_profile_id is null or v_match.loser_profile_id is null then
    raise exception using errcode = '23514', message = 'O vencedor e o perdedor precisam estar definidos.';
  end if;
  if exists (select 1 from public.ranked_mmr_ledger where match_id = p_match_id) then
    raise exception using errcode = '23505', message = 'Esta partida já foi contabilizada.';
  end if;

  perform 1
  from public.ranked_profiles
  where id in (v_match.winner_profile_id, v_match.loser_profile_id)
  order by id
  for update;

  select * into strict v_winner
  from public.ranked_profiles where id = v_match.winner_profile_id;
  select * into strict v_loser
  from public.ranked_profiles where id = v_match.loser_profile_id;

  v_winner_effective := case
    when v_winner.placement_matches < 5 then v_winner.provisional_mmr
    else v_winner.mmr
  end;
  v_loser_effective := case
    when v_loser.placement_matches < 5 then v_loser.provisional_mmr
    else v_loser.mmr
  end;
  v_expected_winner := 1 / (
    1 + power(10::numeric, (v_loser_effective - v_winner_effective)::numeric / 400)
  );
  v_winner_gain := greatest(
    30,
    least(40, round(30 + 10 * (1 - v_expected_winner))::integer)
  );
  v_loser_loss := greatest(
    10,
    least(15, round(10 + 5 * (1 - v_expected_winner))::integer)
  );

  if v_winner.placement_matches < 5 then
    v_winner_new_matches := v_winner.placement_matches + 1;
    v_winner_new_placement_wins := v_winner.placement_wins + 1;
    v_winner_new_mmr := public.ranked_placement_mmr(v_winner_new_placement_wins);

    update public.ranked_profiles
    set wins = wins + 1,
        placement_matches = v_winner_new_matches,
        placement_wins = v_winner_new_placement_wins,
        provisional_mmr = v_winner_new_mmr,
        mmr = case when v_winner_new_matches = 5 then v_winner_new_mmr else mmr end,
        mmr_reached_at = case
          when v_winner_new_matches = 5 then clock_timestamp()
          else mmr_reached_at
        end
    where id = v_winner.id;

    insert into public.ranked_mmr_ledger (
      profile_id, match_id, reason, old_mmr, new_mmr, delta, is_placement, created_by
    ) values (
      v_winner.id,
      p_match_id,
      case when v_winner_new_matches = 5
        then 'placement_complete'::public.ranked_mmr_reason
        else 'ranked_result'::public.ranked_mmr_reason
      end,
      null, null, null, true, p_support_user_id
    );
  else
    v_winner_new_mmr := v_winner.mmr + v_winner_gain;
    update public.ranked_profiles
    set wins = wins + 1,
        mmr = v_winner_new_mmr,
        provisional_mmr = v_winner_new_mmr,
        mmr_reached_at = clock_timestamp()
    where id = v_winner.id;

    insert into public.ranked_mmr_ledger (
      profile_id, match_id, reason, old_mmr, new_mmr, delta, is_placement, created_by
    ) values (
      v_winner.id, p_match_id, 'ranked_result', v_winner.mmr,
      v_winner_new_mmr, v_winner_new_mmr - v_winner.mmr, false, p_support_user_id
    );
  end if;

  if v_loser.placement_matches < 5 then
    v_loser_new_matches := v_loser.placement_matches + 1;
    v_loser_new_mmr := public.ranked_placement_mmr(v_loser.placement_wins);

    update public.ranked_profiles
    set losses = losses + 1,
        placement_matches = v_loser_new_matches,
        provisional_mmr = v_loser_new_mmr,
        mmr = case when v_loser_new_matches = 5 then v_loser_new_mmr else mmr end,
        mmr_reached_at = case
          when v_loser_new_matches = 5 then clock_timestamp()
          else mmr_reached_at
        end
    where id = v_loser.id;

    insert into public.ranked_mmr_ledger (
      profile_id, match_id, reason, old_mmr, new_mmr, delta, is_placement, created_by
    ) values (
      v_loser.id,
      p_match_id,
      case when v_loser_new_matches = 5
        then 'placement_complete'::public.ranked_mmr_reason
        else 'ranked_result'::public.ranked_mmr_reason
      end,
      null, null, null, true, p_support_user_id
    );
  else
    v_loser_new_mmr := greatest(800, v_loser.mmr - v_loser_loss);
    update public.ranked_profiles
    set losses = losses + 1,
        mmr = v_loser_new_mmr,
        provisional_mmr = v_loser_new_mmr,
        mmr_reached_at = case
          when v_loser_new_mmr <> v_loser.mmr then clock_timestamp()
          else mmr_reached_at
        end
    where id = v_loser.id;

    insert into public.ranked_mmr_ledger (
      profile_id, match_id, reason, old_mmr, new_mmr, delta, is_placement, created_by
    ) values (
      v_loser.id, p_match_id, 'ranked_result', v_loser.mmr,
      v_loser_new_mmr, v_loser_new_mmr - v_loser.mmr, false, p_support_user_id
    );
  end if;

  update public.ranked_matches
  set status = 'confirmed',
      resolution_source = p_source,
      confirmed_at = clock_timestamp()
  where id = p_match_id
  returning * into v_match;

  delete from public.ranked_active_match_players where match_id = p_match_id;
  update public.ranked_queue_entries
  set status = 'completed', left_at = clock_timestamp()
  where match_id = p_match_id and status = 'matched';

  perform public.ranked_reset_no_accept_progress(v_match.player_one_id);
  perform public.ranked_reset_no_accept_progress(v_match.player_two_id);

  insert into public.ranked_notifications (
    audience, recipient_profile_id, kind, title, body, payload
  )
  select
    'profile', participant_id, 'match_confirmed', 'Resultado confirmado',
    'A partida foi contabilizada no seu perfil ranked.',
    jsonb_build_object('matchId', p_match_id, 'matchNumber', v_match.match_number)
  from unnest(array[v_match.player_one_id, v_match.player_two_id]) participant_id;

  return v_match;
end;
$$;

-- Internal helper: preserve the restricted ACL established by the security migration.
revoke all on function public.ranked_finalize_match_internal(
  uuid, public.ranked_resolution_source, uuid
) from public, anon, authenticated;

commit;
