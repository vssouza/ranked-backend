-- =========================================================
-- 009_force_rls.sql
-- Enforce RLS on tenant-scoped tables
-- =========================================================

alter table public.organisations force row level security;
alter table public.org_memberships force row level security;
alter table public.org_invitations force row level security;

alter table public.tournaments force row level security;
alter table public.tournament_staff force row level security;
alter table public.tournament_entries force row level security;

alter table public.rounds force row level security;
alter table public.matches force row level security;

alter table public.standings_snapshots force row level security;
alter table public.standings_snapshot_rows force row level security;
