-- =========================================================
-- 027_disable_tenancy_and_tournament_rls.sql
-- Option A posture: backend-owned access control.
-- Ensure RLS is disabled on core multi-tenant tables.
-- =========================================================

alter table public.organisations      disable row level security;
alter table public.org_memberships    disable row level security;
alter table public.org_invitations    disable row level security;

alter table public.tournaments        disable row level security;
alter table public.tournament_staff   disable row level security;
alter table public.tournament_entries disable row level security;

alter table public.rounds             disable row level security;
alter table public.matches            disable row level security;

alter table public.standings_snapshots      disable row level security;
alter table public.standings_snapshot_rows  disable row level security;

alter table public.member_addresses    disable row level security;
