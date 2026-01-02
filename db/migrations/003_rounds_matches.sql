-- =========================================================
-- 003_rounds_matches.sql
-- Rounds + Matches (supports BYE as Option A: player2 NULL)
-- Includes composite FK enforcement to ensure tournament/org consistency
-- =========================================================

-- -----------------------------
-- rounds
-- -----------------------------
create table public.rounds (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  tournament_id uuid not null,

  round_number int not null,

  -- PENDING | ACTIVE | COMPLETE
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACTIVE', 'COMPLETE')),

  started_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tournament_id, round_number),

  check (round_number > 0),
  check (completed_at is null or started_at is null or completed_at >= started_at),

  -- Enforce that tournament belongs to same org (composite FK)
  foreign key (tournament_id, organisation_id)
    references public.tournaments (id, organisation_id)
    on delete cascade
);

create index idx_rounds_tournament_round
  on public.rounds (tournament_id, round_number);

create index idx_rounds_tournament_status
  on public.rounds (tournament_id, status);

create index idx_rounds_org
  on public.rounds (organisation_id);

create trigger trg_rounds_updated_at
before update on public.rounds
for each row
execute function public.set_updated_at();

-- -----------------------------
-- matches
-- -----------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  tournament_id uuid not null,

  round_id uuid
    references public.rounds(id)
    on delete cascade,

  table_number int,

  -- PENDING | IN_PROGRESS | COMPLETE | BYE | VOID
  status text not null default 'PENDING'
    check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETE', 'BYE', 'VOID')),

  player1_entry_id uuid
    references public.tournament_entries(id)
    on delete set null,

  player2_entry_id uuid
    references public.tournament_entries(id)
    on delete set null,

  -- Suggested result shapes:
  -- MATCH:
  -- { "type":"MATCH", "p1": { "games": 2 }, "p2": { "games": 1 }, "draws": 0, "winner": "P1", "points": { "p1": 3, "p2": 0 } }
  -- BYE:
  -- { "type":"BYE", "winner":"P1", "points": { "p1": 3, "p2": 0 } }
  result jsonb not null default '{}'::jsonb,

  reported_by uuid
    references auth.users(id)
    on delete set null,

  reported_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- sanity
  check (table_number is null or table_number > 0),
  check (player1_entry_id is distinct from player2_entry_id),

  -- BYE rules (Option A):
  -- - must have exactly one real player (player1)
  -- - player2 must be NULL
  check (
    status <> 'BYE'
    or (player1_entry_id is not null and player2_entry_id is null)
  ),

  -- Non-BYE matches should have two players (except VOID which may be partially null)
  check (
    status in ('BYE', 'VOID')
    or (player1_entry_id is not null and player2_entry_id is not null)
  ),

  -- Enforce that tournament belongs to same org (composite FK)
  foreign key (tournament_id, organisation_id)
    references public.tournaments (id, organisation_id)
    on delete cascade
);

create index idx_matches_tournament
  on public.matches (tournament_id);

create index idx_matches_round
  on public.matches (round_id);

create index idx_matches_tournament_status
  on public.matches (tournament_id, status);

create index idx_matches_players
  on public.matches (player1_entry_id, player2_entry_id);

create index idx_matches_org
  on public.matches (organisation_id);

create trigger trg_matches_updated_at
before update on public.matches
for each row
execute function public.set_updated_at();
