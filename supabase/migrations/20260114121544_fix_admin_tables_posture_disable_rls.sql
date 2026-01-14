-- =========================================================
-- 024_fix_admin_tables_posture_disable_rls.sql
-- Forward fix: standardize Option A posture for admin tables.
--
-- Purpose:
-- - If 010_admin_tables_rls.sql enabled RLS + deny-all policies,
--   this forward fix disables RLS again so these tables remain
--   backend-owned and enforced via ranked-backend.
--
-- Notes:
-- - Safe to run even if RLS is already disabled.
-- - Policies may still exist; they won't apply while RLS is disabled.
-- =========================================================

alter table public.ranked_admins disable row level security;
alter table public.audit_logs disable row level security;
