-- =========================================================
-- 012_hybrid_tournament_round_phase.sql
-- Hybrid tournaments (Swiss + Top Cut) support via round phase
-- =========================================================

-- Round phase: SWISS or CUT
alter table public.rounds
  add column phase text not null default 'SWISS'
    check (phase in ('SWISS', 'CUT'));

-- For CUT rounds: bracket size this cut round belongs to (Top 8/16/32/64/128...)
-- We allow common powers of two; you can extend later without breaking anything.
alter table public.rounds
  add column cut_size int
    check (cut_size is null or cut_size in (2,4,8,16,32,64,128,256,512));

-- Helpful indexes
create index idx_rounds_tournament_phase
  on public.rounds (tournament_id, phase);

create index idx_rounds_tournament_phase_round
  on public.rounds (tournament_id, phase, round_number);
