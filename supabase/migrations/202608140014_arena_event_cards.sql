create table if not exists public.arena_cards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 80),
  status text not null default 'draft'
    check (status in ('draft', 'announced', 'live', 'finished')),
  starts_at timestamptz,
  venue text not null default 'Park' check (venue = 'Park'),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.arena_card_matches (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.arena_cards(id) on delete cascade,
  position integer not null check (position > 0),
  category_id text not null check (category_id in ('peso-pena', 'peso-medio', 'peso-pesado')),
  player_a_id text not null,
  player_b_id text not null,
  match_type text not null default 'normal' check (match_type in ('normal', 'belt')),
  status text not null default 'announced' check (status in ('announced', 'live', 'finished')),
  scheduled_at timestamptz,
  player_a_score integer check (player_a_score is null or player_a_score >= 0),
  player_b_score integer check (player_b_score is null or player_b_score >= 0),
  winner_player_id text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (card_id, position),
  constraint arena_card_matches_distinct_players check (player_a_id <> player_b_id),
  constraint arena_card_matches_result_consistent check (
    (status <> 'finished' and player_a_score is null and player_b_score is null and winner_player_id is null)
    or (
      status = 'finished'
      and player_a_score is not null
      and player_b_score is not null
      and player_a_score <> player_b_score
      and winner_player_id in (player_a_id, player_b_id)
    )
  )
);

create index if not exists arena_cards_status_idx
  on public.arena_cards (status, created_at desc);
create index if not exists arena_card_matches_card_idx
  on public.arena_card_matches (card_id, position);

drop trigger if exists arena_cards_updated_at on public.arena_cards;
create trigger arena_cards_updated_at
before update on public.arena_cards
for each row execute function public.ranked_set_updated_at();

drop trigger if exists arena_card_matches_updated_at on public.arena_card_matches;
create trigger arena_card_matches_updated_at
before update on public.arena_card_matches
for each row execute function public.ranked_set_updated_at();

alter table public.arena_cards enable row level security;
alter table public.arena_card_matches enable row level security;

drop policy if exists arena_cards_public_read on public.arena_cards;
create policy arena_cards_public_read on public.arena_cards
for select using (status <> 'draft');

drop policy if exists arena_card_matches_public_read on public.arena_card_matches;
create policy arena_card_matches_public_read on public.arena_card_matches
for select using (
  exists (
    select 1 from public.arena_cards c
    where c.id = card_id and c.status <> 'draft'
  )
);

revoke all on table public.arena_cards, public.arena_card_matches
from public, anon, authenticated;
grant select on table public.arena_cards, public.arena_card_matches
to anon, authenticated;

create or replace function public.arena_support_start_card(
  p_card_id uuid,
  p_support_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Acesso exclusivo do servidor.';
  end if;
  if not exists (
    select 1 from public.support_users
    where user_id = p_support_user_id and is_active
  ) then
    raise exception using errcode = '42501', message = 'Suporte não autorizado.';
  end if;
  if not exists (select 1 from public.arena_card_matches where card_id = p_card_id) then
    raise exception using errcode = '23514', message = 'Adicione ao menos um confronto antes de iniciar o card.';
  end if;

  update public.arena_cards
  set status = 'live', updated_by = p_support_user_id
  where id = p_card_id and status in ('draft', 'announced');
  if not found then
    raise exception using errcode = '23514', message = 'Este card não pode ser iniciado no estado atual.';
  end if;

  update public.arena_card_matches
  set status = 'live'
  where card_id = p_card_id and status = 'announced';

  insert into public.support_audit_log (
    support_user_id, action, target_type, target_id, next_state, note
  ) values (
    p_support_user_id, 'start_card', 'arena_card', p_card_id::text,
    jsonb_build_object('status', 'live'), 'Card iniciado pela central de suporte.'
  );
end;
$$;

create or replace function public.arena_support_finish_card(
  p_card_id uuid,
  p_results jsonb,
  p_support_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_match_count integer;
  v_result jsonb;
  v_match_id uuid;
  v_score_a integer;
  v_score_b integer;
  v_player_a text;
  v_player_b text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Acesso exclusivo do servidor.';
  end if;
  if not exists (
    select 1 from public.support_users
    where user_id = p_support_user_id and is_active
  ) then
    raise exception using errcode = '42501', message = 'Suporte não autorizado.';
  end if;
  if not exists (
    select 1 from public.arena_cards where id = p_card_id and status = 'live'
  ) then
    raise exception using errcode = '23514', message = 'Somente um card iniciado pode ser finalizado.';
  end if;
  if jsonb_typeof(p_results) <> 'array' then
    raise exception using errcode = '22023', message = 'Resultados inválidos.';
  end if;

  select count(*)::integer into v_match_count
  from public.arena_card_matches where card_id = p_card_id;
  if v_match_count = 0 or jsonb_array_length(p_results) <> v_match_count then
    raise exception using errcode = '23514', message = 'Informe o resultado de todos os confrontos.';
  end if;
  if (
    select count(distinct value->>'matchId') from jsonb_array_elements(p_results)
  ) <> v_match_count then
    raise exception using errcode = '23514', message = 'Há resultados ausentes ou repetidos.';
  end if;

  for v_result in select value from jsonb_array_elements(p_results)
  loop
    begin
      v_match_id := (v_result->>'matchId')::uuid;
      v_score_a := (v_result->>'playerAScore')::integer;
      v_score_b := (v_result->>'playerBScore')::integer;
    exception when others then
      raise exception using errcode = '22023', message = 'Resultado inválido.';
    end;

    if v_score_a < 0 or v_score_b < 0 or v_score_a = v_score_b then
      raise exception using errcode = '23514', message = 'Os placares devem ser válidos e sem empate.';
    end if;

    select player_a_id, player_b_id into v_player_a, v_player_b
    from public.arena_card_matches
    where id = v_match_id and card_id = p_card_id
    for update;
    if not found then
      raise exception using errcode = '23514', message = 'Confronto não pertence ao card.';
    end if;

    update public.arena_card_matches
    set status = 'finished',
        player_a_score = v_score_a,
        player_b_score = v_score_b,
        winner_player_id = case when v_score_a > v_score_b then v_player_a else v_player_b end
    where id = v_match_id;
  end loop;

  update public.arena_cards
  set status = 'finished', updated_by = p_support_user_id
  where id = p_card_id;

  insert into public.support_audit_log (
    support_user_id, action, target_type, target_id, next_state, note
  ) values (
    p_support_user_id, 'finish_card', 'arena_card', p_card_id::text,
    jsonb_build_object('status', 'finished', 'matches', v_match_count),
    'Resultados oficiais registrados pela central de suporte.'
  );
end;
$$;

revoke all on function public.arena_support_start_card(uuid, uuid),
  public.arena_support_finish_card(uuid, jsonb, uuid)
from public, anon, authenticated;
grant execute on function public.arena_support_start_card(uuid, uuid),
  public.arena_support_finish_card(uuid, jsonb, uuid)
to service_role;

insert into public.arena_cards (id, name, status, starts_at, venue)
values (
  'a8b00000-0000-4000-8000-000000000001',
  'AXB CARD 01',
  'announced',
  null,
  'Park'
)
on conflict (id) do nothing;

insert into public.arena_card_matches (
  id, card_id, position, category_id, player_a_id, player_b_id, match_type
)
values
  ('a8b00000-0000-4000-8000-000000000101', 'a8b00000-0000-4000-8000-000000000001', 1, 'peso-medio', 'vwyxz', 'duardin', 'belt'),
  ('a8b00000-0000-4000-8000-000000000102', 'a8b00000-0000-4000-8000-000000000001', 2, 'peso-medio', 'vtzinn021', 'joao00325', 'normal'),
  ('a8b00000-0000-4000-8000-000000000103', 'a8b00000-0000-4000-8000-000000000001', 3, 'peso-medio', 'itz', 'BG', 'normal'),
  ('a8b00000-0000-4000-8000-000000000104', 'a8b00000-0000-4000-8000-000000000001', 4, 'peso-pena', 'Gabbo', 'zeys', 'belt'),
  ('a8b00000-0000-4000-8000-000000000105', 'a8b00000-0000-4000-8000-000000000001', 5, 'peso-pena', 'Jilson', 'rodry', 'normal'),
  ('a8b00000-0000-4000-8000-000000000106', 'a8b00000-0000-4000-8000-000000000001', 6, 'peso-pena', 'Nickzada', 'kakaleb', 'normal'),
  ('a8b00000-0000-4000-8000-000000000107', 'a8b00000-0000-4000-8000-000000000001', 7, 'peso-pena', 'pero', 'ShotColt', 'normal'),
  ('a8b00000-0000-4000-8000-000000000108', 'a8b00000-0000-4000-8000-000000000001', 8, 'peso-pena', 'Noki', 'Vini', 'normal')
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'arena_cards'
    ) then
      alter publication supabase_realtime add table public.arena_cards;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'arena_card_matches'
    ) then
      alter publication supabase_realtime add table public.arena_card_matches;
    end if;
  end if;
end;
$$;
