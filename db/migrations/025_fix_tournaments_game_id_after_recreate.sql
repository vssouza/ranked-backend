-- =========================================================
-- 025_fix_tournaments_game_id_after_recreate.sql
-- Forward fix: ensure tournaments has game_id after tournaments
-- table was recreated (e.g. by 019).
-- =========================================================

-- Add game_id to tournaments (idempotent)
alter table public.tournaments
  add column if not exists game_id uuid
    references public.games(id)
    on delete restrict;

create index if not exists idx_tournaments_game
  on public.tournaments (game_id);
