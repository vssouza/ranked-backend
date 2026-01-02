-- =========================================================
-- 010_admin_tables_rls.sql
-- Lock down admin-only tables from client access
-- =========================================================

alter table public.ranked_admins enable row level security;
alter table public.audit_logs enable row level security;

-- Deny all access from normal client roles
drop policy if exists ranked_admins_deny_all on public.ranked_admins;
create policy ranked_admins_deny_all
on public.ranked_admins
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists audit_logs_deny_all on public.audit_logs;
create policy audit_logs_deny_all
on public.audit_logs
for all
to anon, authenticated
using (false)
with check (false);
