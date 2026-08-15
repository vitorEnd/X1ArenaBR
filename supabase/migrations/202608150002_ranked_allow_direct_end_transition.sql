-- The start-match step was removed from the UI. Allow the creator to finish
-- a lobby directly and move it to the score-submission state.
create or replace function public.ranked_validate_match_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'awaiting_acceptance' and new.status in ('lobby', 'cancelled'))
    or (old.status = 'lobby' and new.status in ('in_progress', 'awaiting_score', 'frozen', 'disputed', 'cancelled'))
    or (old.status = 'in_progress' and new.status in ('awaiting_score', 'frozen', 'disputed', 'cancelled'))
    or (old.status = 'awaiting_score' and new.status in ('awaiting_confirmation', 'frozen', 'disputed', 'cancelled'))
    or (old.status = 'awaiting_confirmation' and new.status in ('confirmed', 'frozen', 'disputed', 'cancelled'))
    or (old.status = 'frozen' and new.status in ('confirmed', 'disputed', 'cancelled'))
    or (old.status = 'disputed' and new.status in ('confirmed', 'cancelled'))
  ) then
    raise exception using
      errcode = '23514',
      message = format('Transição de partida inválida: %s → %s.', old.status, new.status);
  end if;

  return new;
end;
$$;