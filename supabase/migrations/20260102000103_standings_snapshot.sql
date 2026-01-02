-- =========================================================
-- 004_standings_snapshot.sql
-- Standings snapshots (server-authoritative outputs from rankings-core)
-- =========================================================

-- -----------------------------
-- standings_snapshots
-- -----------------------------
-- One snapshot per tournament "state" you want to preserve (e.g., after each round).
-- Store summary metadata here; store the actual rows in standings_snapshot_rows.
--
-- Meta conventions (recommended, not enforced):
-- {
--   "phase": "SWISS" | "CUT",
--   "cut": {
--     "made": true,
--     "size": 8 | 16 | 32 | 64 | 128,
--     "seeded_from_round": 6,
--     "seeding_method": "points_then_tiebreakers",
--     "seed_entry_ids": ["<uuid>", "..."],
--     "seed_ranks": [ { "entry_id":"<uuid>", "seed": 1 }, ... ]
--   }
-- }
create table public.standings_snapshots (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  tournament_id uuid not null,

  -- null = "current"/ad-hoc snapshot, otherwise ties snapshot to a completed (or in-progress) round
  round_id uuid
    references public.rounds(id)
    on delete set null,

  -- "CURRENT" | "ROUND" | "FINAL" | "REPAIR"
  kind text not null default 'ROUND'
    check (kind in ('CURRENT', 'ROUND', 'FINAL', 'REPAIR')),

  -- rankings-core / algorithm version for reproducibility
  algorithm_version text,

  -- convenience fields for fast reads
  player_count int not null default 0,
  match_count int not null default 0,

  -- flexible: store tie-break config, scoring config, notes, and cut metadata
  meta jsonb not null default '{}'::jsonb,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  -- Ensure tournament belongs to same org (composite FK)
  foreign key (tournament_id, organisation_id)
    references public.tournaments (id, organisation_id)
    on delete cascade
);

-- Optional documentation at DB level (safe, non-breaking)
comment on column public.standings_snapshots.meta is
'JSON metadata from rankings-core. Convention: include {"phase":"SWISS|CUT", "cut":{"made":true,"size":N,"seeded_from_round":R,"seed_entry_ids":[...]}} when top cut is decided.';

-- Most common query: latest snapshot for a tournament
create index idx_standings_snapshots_tournament_created_at
  on public.standings_snapshots (tournament_id, created_at desc);

-- Admin/support queries by org
create index idx_standings_snapshots_org_created_at
  on public.standings_snapshots (organisation_id, created_at desc);

-- Optional: quickly filter by round
create index idx_standings_snapshots_round
  on public.standings_snapshots (round_id);

-- Helpful for hybrid tournaments:
-- Find snapshots where cut was made (query by tournament + created_at, then filter by meta)
create index idx_standings_snapshots_tournament_kind_created_at
  on public.standings_snapshots (tournament_id, kind, created_at desc);

-- Optional GIN index for metadata queries (helps if you frequently query meta->... fields)
create index idx_standings_snapshots_meta_gin
  on public.standings_snapshots using gin (meta);

-- -----------------------------
-- standings_snapshot_rows
-- -----------------------------
-- One row per player (tournament_entry) within a snapshot.
-- Store standard fields in columns for sorting/filtering, and keep the rest in stats jsonb.
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

  -- wins/losses/draws are extremely common across games
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,

  -- common Swiss tie-breakers (nullable because different games/leagues differ)
  omw numeric(6,4),
  gwp numeric(6,4),
  ogw numeric(6,4),
  sb  numeric(12,4),

  -- everything else from rankings-core can live here:
  -- e.g. { "opp_points": 12, "match_win_pct": 0.667, "games_won": 10, ... }
  stats jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  -- Ensure snapshot rows align
  unique (snapshot_id, entry_id),

  -- Ensure tournament belongs to same org (composite FK)
  foreign key (tournament_id, organisation_id)
    references public.tournaments (id, organisation_id)
    on delete cascade
);

-- Fast fetch of a snapshot ordered by rank
create index idx_standings_rows_snapshot_rank
  on public.standings_snapshot_rows (snapshot_id, rank);

-- Fast fetch per tournament entry history (player profile / progress)
create index idx_standings_rows_entry_created_at
  on public.standings_snapshot_rows (entry_id, created_at desc);

-- Useful for backend sanity checks and bulk operations
create index idx_standings_rows_tournament
  on public.standings_snapshot_rows (tournament_id);

create index idx_standings_rows_org
  on public.standings_snapshot_rows (organisation_id);
