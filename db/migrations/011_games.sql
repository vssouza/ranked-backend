-- =========================================================
-- 011_games.sql
-- Games / rulesets (used to group ratings across tournaments & orgs)
-- =========================================================

create table public.games (
  id uuid primary key default gen_random_uuid(),

  -- Stable identifier (use in URLs / configs): e.g. "mtg", "lorcana", "chess"
  code varchar(63) not null unique
    check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),

  name text not null,

  -- Optional: store game-specific defaults (K-factor, scoring, tie-breaks, etc.)
  settings jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index idx_games_created_at
  on public.games (created_at desc);

-- Add game_id to tournaments (each tournament belongs to one game)
alter table public.tournaments
  add column game_id uuid
    references public.games(id)
    on delete restrict;

create index idx_tournaments_game
  on public.tournaments (game_id);

-- Optional: if you want to enforce that every tournament has a game:
-- (Leave this commented until you're ready to backfill existing rows)
-- alter table public.tournaments
--   alter column game_id set not null;
