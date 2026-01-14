-- =========================================================
-- 026_fix_rounds_phase_columns_after_recreate.sql
-- Ensure hybrid round phase fields exist (idempotent).
-- Useful if rounds was dropped/recreated due to cascade drops.
-- =========================================================

-- phase column
alter table public.rounds
  add column if not exists phase text not null default 'SWISS'
    check (phase in ('SWISS', 'CUT'));

-- cut_size column
alter table public.rounds
  add column if not exists cut_size int
    check (cut_size is null or cut_size in (2,4,8,16,32,64,128,256,512));

-- indexes
create index if not exists idx_rounds_tournament_phase
  on public.rounds (tournament_id, phase);

create index if not exists idx_rounds_tournament_phase_round
  on public.rounds (tournament_id, phase, round_number);
