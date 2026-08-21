begin;

-- Global Ranked reward switch. Placement remains governed by the official
-- five-match table; only positive post-placement MMR rewards are multiplied.
create table if not exists public.ranked_runtime_settings (
  id smallint primary key default 1 check (id = 1),
  points_multiplier smallint not null default 1
    check (points_multiplier in (1, 2, 3)),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp()
);

insert into public.ranked_runtime_settings (id, points_multiplier)
values (1, 1)
on conflict (id) do nothing;

alter table public.ranked_runtime_settings enable row level security;
revoke all on table public.ranked_runtime_settings from public, anon, authenticated;
grant select, update on table public.ranked_runtime_settings to service_role;

create or replace function public.ranked_support_set_points_multiplier(
  p_multiplier smallint
)
returns smallint
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_support_id uuid := auth.uid();
begin
  if v_support_id is null or not public.ranked_is_support(v_support_id) then
    raise exception using errcode = '42501', message = 'Suporte não autorizado.';
  end if;
  if p_multiplier not in (1, 2, 3) then
    raise exception using errcode = '22023', message = 'Multiplicador inválido.';
  end if;

  insert into public.ranked_runtime_settings (
    id, points_multiplier, updated_by, updated_at
  ) values (
    1, p_multiplier, v_support_id, clock_timestamp()
  )
  on conflict (id) do update
  set points_multiplier = excluded.points_multiplier,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  insert into public.support_audit_log (
    support_user_id, action, target_type, target_id, next_state, note
  ) values (
    v_support_id,
    'set_ranked_points_multiplier',
    'ranked_settings',
    'global',
    jsonb_build_object('points_multiplier', p_multiplier),
    format('Pontos Ranked definidos em %sx.', p_multiplier)
  );

  return p_multiplier;
end;
$$;

revoke all on function public.ranked_support_set_points_multiplier(smallint)
from public, anon, authenticated;
grant execute on function public.ranked_support_set_points_multiplier(smallint)
to authenticated;

create or replace function public.ranked_apply_points_multiplier_to_ledger()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_multiplier smallint := 1;
begin
  if new.is_placement or new.delta is null or new.delta <= 0
    or new.old_mmr is null or new.new_mmr is null
    or new.reason <> 'ranked_result' then
    return new;
  end if;

  select points_multiplier into v_multiplier
  from public.ranked_runtime_settings
  where id = 1;
  v_multiplier := coalesce(v_multiplier, 1);

  if v_multiplier = 1 then
    return new;
  end if;

  new.delta := new.delta * v_multiplier;
  new.new_mmr := new.old_mmr + new.delta;

  update public.ranked_profiles
  set mmr = new.new_mmr,
      provisional_mmr = new.new_mmr,
      mmr_reached_at = clock_timestamp()
  where id = new.profile_id;

  return new;
end;
$$;

revoke all on function public.ranked_apply_points_multiplier_to_ledger()
from public, anon, authenticated;

drop trigger if exists ranked_mmr_ledger_points_multiplier
on public.ranked_mmr_ledger;
create trigger ranked_mmr_ledger_points_multiplier
before insert on public.ranked_mmr_ledger
for each row execute function public.ranked_apply_points_multiplier_to_ledger();

-- Event predictions: voter identities never become public. Clients read only
-- aggregated totals from a narrow RPC and cast votes through a validated RPC.
create table if not exists public.arena_match_votes (
  match_id uuid not null references public.arena_card_matches(id) on delete cascade,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  predicted_player_id text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (match_id, voter_user_id)
);

create index if not exists arena_match_votes_summary_idx
on public.arena_match_votes (match_id, predicted_player_id);

alter table public.arena_match_votes enable row level security;
revoke all on table public.arena_match_votes from public, anon, authenticated;
grant select, insert, update, delete on table public.arena_match_votes to service_role;

drop trigger if exists arena_match_votes_updated_at on public.arena_match_votes;
create trigger arena_match_votes_updated_at
before update on public.arena_match_votes
for each row execute function public.ranked_set_updated_at();

create or replace function public.arena_vote_for_match(
  p_match_id uuid,
  p_player_id text
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_player_a_id text;
  v_player_b_id text;
  v_match_status text;
  v_card_status text;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Entre na sua conta para votar.';
  end if;

  select m.player_a_id, m.player_b_id, m.status, c.status
  into v_player_a_id, v_player_b_id, v_match_status, v_card_status
  from public.arena_card_matches m
  join public.arena_cards c on c.id = m.card_id
  where m.id = p_match_id
  for update of m, c;

  if not found then
    raise exception using errcode = 'P0002', message = 'Confronto não encontrado.';
  end if;
  if v_match_status <> 'announced' or v_card_status <> 'announced' then
    raise exception using errcode = 'P0001', message = 'A votação deste confronto foi encerrada.';
  end if;
  if p_player_id not in (v_player_a_id, v_player_b_id) then
    raise exception using errcode = '22023', message = 'Escolha um dos jogadores do confronto.';
  end if;

  insert into public.arena_match_votes (
    match_id, voter_user_id, predicted_player_id
  ) values (
    p_match_id, v_user_id, p_player_id
  )
  on conflict (match_id, voter_user_id) do update
  set predicted_player_id = excluded.predicted_player_id,
      updated_at = clock_timestamp();
end;
$$;

revoke all on function public.arena_vote_for_match(uuid, text)
from public, anon, authenticated;
grant execute on function public.arena_vote_for_match(uuid, text)
to authenticated;

create or replace function public.arena_get_match_vote_state(
  p_match_ids uuid[]
)
returns table (
  match_id uuid,
  player_a_id text,
  player_b_id text,
  player_a_votes bigint,
  player_b_votes bigint,
  own_vote text,
  voting_open boolean
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if coalesce(cardinality(p_match_ids), 0) = 0 then
    return;
  end if;
  if cardinality(p_match_ids) > 100 then
    raise exception using errcode = '22023', message = 'Muitos confrontos solicitados.';
  end if;

  return query
  select
    m.id,
    m.player_a_id,
    m.player_b_id,
    count(v.match_id) filter (where v.predicted_player_id = m.player_a_id),
    count(v.match_id) filter (where v.predicted_player_id = m.player_b_id),
    max(v.predicted_player_id) filter (where v.voter_user_id = auth.uid()),
    (m.status = 'announced' and c.status = 'announced')
  from public.arena_card_matches m
  join public.arena_cards c on c.id = m.card_id
  left join public.arena_match_votes v on v.match_id = m.id
  where m.id = any(p_match_ids)
    and c.status <> 'draft'
  group by m.id, m.player_a_id, m.player_b_id, m.status, c.status
  order by m.id;
end;
$$;

revoke all on function public.arena_get_match_vote_state(uuid[])
from public, anon, authenticated;
grant execute on function public.arena_get_match_vote_state(uuid[])
to anon, authenticated;

create or replace function public.arena_clear_match_votes_after_player_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.player_a_id is distinct from new.player_a_id
    or old.player_b_id is distinct from new.player_b_id then
    delete from public.arena_match_votes where match_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.arena_clear_match_votes_after_player_change()
from public, anon, authenticated;

drop trigger if exists arena_card_matches_clear_votes
on public.arena_card_matches;
create trigger arena_card_matches_clear_votes
after update of player_a_id, player_b_id on public.arena_card_matches
for each row execute function public.arena_clear_match_votes_after_player_change();

commit;
