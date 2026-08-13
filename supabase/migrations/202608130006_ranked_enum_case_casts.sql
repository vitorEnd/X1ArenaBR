-- Keep the existing matchmaking behavior while making CASE results match the
-- enum-typed state columns explicitly.

create or replace function public.ranked_respond_to_match(
  p_match_id uuid,
  p_accept boolean
)
returns public.ranked_matches
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_match public.ranked_matches%rowtype;
  v_other_id uuid;
  v_creator_id uuid;
  v_password text;
  v_random_bytes bytea;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;
  if p_accept is null then
    raise exception using errcode = '22023', message = 'Informe se deseja aceitar a partida.';
  end if;
  perform public.ranked_check_rate_limit('match_acceptance', 20, 60);
  perform public.ranked_reconcile();

  select * into v_match
  from public.ranked_matches where id = p_match_id
  for update;

  if not found or v_user_id not in (v_match.player_one_id, v_match.player_two_id) then
    raise exception using errcode = 'P0002', message = 'Partida encontrada não está disponível.';
  end if;
  if v_match.status <> 'awaiting_acceptance' then
    return v_match;
  end if;
  if v_match.accept_deadline <= clock_timestamp() then
    perform public.ranked_reconcile();
    raise exception using errcode = 'P0001', message = 'O prazo de aceite foi encerrado.';
  end if;

  if exists (
    select 1 from public.ranked_match_acceptances
    where match_id = p_match_id and profile_id = v_user_id and state = 'accepted'
  ) and p_accept then
    return v_match;
  end if;

  update public.ranked_match_acceptances
  set state = case
        when p_accept then 'accepted'::public.ranked_acceptance_state
        else 'declined'::public.ranked_acceptance_state
      end,
      responded_at = clock_timestamp()
  where match_id = p_match_id
    and profile_id = v_user_id
    and state = 'pending';

  if not found then
    raise exception using errcode = 'P0001', message = 'O aceite já foi respondido.';
  end if;

  if not p_accept then
    perform public.ranked_record_no_accept(v_user_id);
    v_other_id := case when v_user_id = v_match.player_one_id
      then v_match.player_two_id else v_match.player_one_id end;

    if exists (
      select 1 from public.ranked_match_acceptances
      where match_id = p_match_id and profile_id = v_other_id and state = 'accepted'
    ) then
      perform public.ranked_requeue_after_failed_acceptance(p_match_id, v_other_id);
    end if;

    update public.ranked_queue_entries
    set status = 'expired', left_at = clock_timestamp()
    where match_id = p_match_id and status = 'matched';
    update public.ranked_matches
    set status = 'cancelled', cancelled_at = clock_timestamp(),
        cancellation_reason = 'Partida recusada.'
    where id = p_match_id
    returning * into v_match;
    delete from public.ranked_active_match_players where match_id = p_match_id;
    return v_match;
  end if;

  if (
    select count(*) from public.ranked_match_acceptances
    where match_id = p_match_id and state = 'accepted'
  ) = 2 then
    v_creator_id := case when get_byte(extensions.gen_random_bytes(1), 0) < 128
      then v_match.player_one_id else v_match.player_two_id end;
    v_random_bytes := extensions.gen_random_bytes(3);
    v_password := lpad(
      (
        100000
        + (
          get_byte(v_random_bytes, 0) * 65536
          + get_byte(v_random_bytes, 1) * 256
          + get_byte(v_random_bytes, 2)
        ) % 900000
      )::text,
      6,
      '0'
    );

    update public.ranked_matches
    set status = 'lobby',
        creator_profile_id = v_creator_id,
        room_name = '[ARENA X1 BR] Match ' || match_number,
        room_password = v_password
    where id = p_match_id
    returning * into v_match;

    insert into public.ranked_notifications (
      audience, recipient_profile_id, kind, title, body, payload
    )
    select
      'profile', participant_id, 'lobby_ready', 'Lobby liberado',
      'Os dois jogadores aceitaram. Consulte o nome e a senha da sala.',
      jsonb_build_object('matchId', v_match.id, 'matchNumber', v_match.match_number)
    from unnest(array[v_match.player_one_id, v_match.player_two_id]) participant_id;
  end if;

  return v_match;
end;
$$;

create or replace function public.ranked_confirm_result(
  p_match_id uuid,
  p_approve boolean
)
returns public.ranked_matches
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare v_match public.ranked_matches%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Autenticação obrigatória.';
  end if;
  if p_approve is null then
    raise exception using errcode = '22023', message = 'Informe se deseja aprovar o resultado.';
  end if;
  perform public.ranked_check_rate_limit('confirm_result', 20, 60);
  perform public.ranked_reconcile();

  select * into v_match from public.ranked_matches where id = p_match_id for update;
  if not found
    or auth.uid() not in (v_match.player_one_id, v_match.player_two_id)
    or auth.uid() = v_match.creator_profile_id then
    raise exception using errcode = 'P0001', message = 'Este resultado não está disponível para confirmação.';
  end if;
  if v_match.status = 'confirmed' then
    return v_match;
  end if;
  if v_match.status <> 'awaiting_confirmation' then
    raise exception using errcode = 'P0001', message = 'Este resultado não está disponível para confirmação.';
  end if;
  if v_match.confirmation_deadline <= clock_timestamp() then
    perform public.ranked_reconcile();
    select * into v_match from public.ranked_matches where id = p_match_id;
    return v_match;
  end if;

  update public.ranked_result_confirmations
  set state = case
        when p_approve then 'approved'::public.ranked_confirmation_state
        else 'contested'::public.ranked_confirmation_state
      end,
      responded_at = clock_timestamp()
  where match_id = p_match_id and profile_id = auth.uid() and state = 'pending';

  if not found then
    raise exception using errcode = 'P0001', message = 'O resultado já foi respondido.';
  end if;

  if p_approve then
    return public.ranked_finalize_match_internal(p_match_id, 'players', null);
  end if;

  update public.ranked_matches
  set status = 'disputed'
  where id = p_match_id
  returning * into v_match;

  insert into public.ranked_notifications (
    audience, kind, title, body, payload
  ) values (
    'support', 'support_required', 'Resultado contestado',
    'Um jogador contestou o placar enviado pelo criador.',
    jsonb_build_object('matchId', v_match.id, 'matchNumber', v_match.match_number)
  );
  return v_match;
end;
$$;

-- CREATE OR REPLACE keeps existing ACLs; these statements make the intended
-- API surface explicit and prevent accidental execution by anonymous clients.
revoke all on function public.ranked_respond_to_match(uuid, boolean) from public, anon;
revoke all on function public.ranked_confirm_result(uuid, boolean) from public, anon;
grant execute on function public.ranked_respond_to_match(uuid, boolean) to authenticated;
grant execute on function public.ranked_confirm_result(uuid, boolean) to authenticated;
