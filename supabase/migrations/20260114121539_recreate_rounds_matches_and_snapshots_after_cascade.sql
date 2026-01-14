-- =========================================================
-- 028_recreate_rounds_matches_and_snapshots_after_cascade.sql
-- Recreate rounds/matches/standings tables that may have been
-- dropped by DROP ... CASCADE in 018/019.
--
-- IMPORTANT:
-- - matches is recreated with column "reported_by" (old name)
--   so 020 can rename it to reported_by_member_id.
-- - standings_snapshots is recreated with column "created_by"
--   so 021 can rename it to created_by_member_id.
-- =========================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Drop in dependency order
drop table if exists public.standings_snapshot_rows cascade;
drop table if exists public.standings_snapshots cascade;
drop table if exists public.matches cascade;
drop table if exists public.rounds cascade;

-- -----------------------------
-- rounds (from 003_rounds_matches.sql)
-- -----------------------------
create table public.rounds (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  tournament_id uuid not null,

  round_number int not null,

  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACTIVE', 'COMPLETE')),

  started_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tournament_id, round_number),

  check (round_number > 0),
  check (completed_at is null or started_at is null or completed_at >= started_at),

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

drop trigger if exists trg_rounds_updated_at on public.rounds;
create trigger trg_rounds_updated_at
before update on public.rounds
for each row
execute function public.set_updated_at();

-- -----------------------------
-- matches (from 003_rounds_matches.sql)
-- NOTE: reported_by remains auth.users here so 020 can fix it.
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

  status text not null default 'PENDING'
    check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETE', 'BYE', 'VOID')),

  player1_entry_id uuid
    references public.tournament_entries(id)
    on delete set null,

  player2_entry_id uuid
    references public.tournament_entries(id)
    on delete set null,

  result jsonb not null default '{}'::jsonb,

  reported_by uuid
    references auth.users(id)
    on delete set null,

  reported_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (table_number is null or table_number > 0),
  check (player1_entry_id is distinct from player2_entry_id),

  check (
    status <> 'BYE'
    or (player1_entry_id is not null and player2_entry_id is null)
  ),

  check (
    status in ('BYE', 'VOID')
    or (player1_entry_id is not null and player2_entry_id is not null)
  ),

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

drop trigger if exists trg_matches_updated_at on public.matches;
create trigger trg_matches_updated_at
before update on public.matches
for each row
execute function public.set_updated_at();

-- -----------------------------
-- standings_snapshots (from 004_standings_snapshot.sql)
-- NOTE: created_by remains auth.users here so 021 can fix it.
-- -----------------------------
create table public.standings_snapshots (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  tournament_id uuid not null,

  round_id uuid
    references public.rounds(id)
    on delete set null,

  kind text not null default 'ROUND'
    check (kind in ('CURRENT', 'ROUND', 'FINAL', 'REPAIR')),

  algorithm_version text,

  player_count int not null default 0,
  match_count int not null default 0,

  meta jsonb not null default '{}'::jsonb,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  foreign key (tournament_id, organisation_id)
    references public.tournaments (id, organisation_id)
    on delete cascade
);

create index idx_standings_snapshots_tournament_created_at
  on public.standings_snapshots (tournament_id, created_at desc);

create index idx_standings_snapshots_org_created_at
  on public.standings_snapshots (organisation_id, created_at desc);

create index idx_standings_snapshots_round
  on public.standings_snapshots (round_id);

create index idx_standings_snapshots_tournament_kind_created_at
  on public.standings_snapshots (tournament_id, kind, created_at desc);

create index idx_standings_snapshots_meta_gin
  on public.standings_snapshots using gin (meta);

-- -----------------------------
-- standings_snapshot_rows (from 004_standings_snapshot.sql)
-- -----------------------------
create table public.standings_snapshot_rows (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  tournament_id uuid not null,

  snapshot_id uuid not null
    references public.standings_snapshots(id)
    on delete cascade,

  entry_id uuid not null
    references public.tournament_entries(id)
    on delete cascade,

  rank int not null check (rank > 0),

  points numeric(10,2) not null default 0,

  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,

  omw numeric(6,4),
  gwp numeric(6,4),
  ogw numeric(6,4),
  sb  numeric(12,4),

  stats jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  unique (snapshot_id, entry_id),

  foreign key (tournament_id, organisation_id)
    references public.tournaments (id, organisation_id)
    on delete cascade
);

create index idx_standings_rows_snapshot_rank
  on public.standings_snapshot_rows (snapshot_id, rank);

create index idx_standings_rows_entry_created_at
  on public.standings_snapshot_rows (entry_id, created_at desc);

create index idx_standings_rows_tournament
  on public.standings_snapshot_rows (tournament_id);

create index idx_standings_rows_org
  on public.standings_snapshot_rows (organisation_id);

-- Backend-owned posture
alter table public.rounds disable row level security;
alter table public.matches disable row level security;
alter table public.standings_snapshots disable row level security;
alter table public.standings_snapshot_rows disable row level security;
