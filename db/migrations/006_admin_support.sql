-- =========================================================
-- 006_admin_support.sql
-- Platform-level admin allowlist + audit logs
-- =========================================================

-- Ranked platform administrators (allowlist)
create table public.ranked_admins (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  -- who granted this user admin rights (optional)
  created_by uuid
    references auth.users(id)
    on delete set null
);

create index idx_ranked_admins_created_at
  on public.ranked_admins (created_at desc);

-- Audit logs (cross-tenant actions done by Ranked staff/backends)
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),

  actor_user_id uuid
    references auth.users(id)
    on delete set null,

  action text not null,     -- e.g. ORG_APPROVE, ORG_REJECT, TOURNAMENT_FIX, etc.
  entity text not null,     -- e.g. organisations, tournaments, users
  entity_id uuid,           -- target row id, when applicable
  organisation_id uuid,     -- tenant impacted, when applicable

  meta jsonb not null default '{}'::jsonb, -- extra context
  created_at timestamptz not null default now()
);

create index idx_audit_logs_created_at
  on public.audit_logs (created_at desc);

create index idx_audit_logs_org_created_at
  on public.audit_logs (organisation_id, created_at desc);

create index idx_audit_logs_actor_created_at
  on public.audit_logs (actor_user_id, created_at desc);
