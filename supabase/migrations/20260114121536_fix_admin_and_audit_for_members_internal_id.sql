-- =========================================================
-- 017_fix_admin_and_audit_for_members_internal_id.sql
-- Decouple admin allowlist + audit logs from Supabase auth.users
-- and bind them to app-owned members.internal_id (Option A).
--
-- Assumptions:
-- - public.members exists and has primary key (internal_id uuid)
-- - No production data yet (safe to drop & recreate)
-- =========================================================

-- Ensure uuid generation is available (Supabase typically has this)
create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- Drop old tables (they referenced auth.users)
-- ---------------------------------------------------------
drop table if exists public.audit_logs cascade;
drop table if exists public.ranked_admins cascade;

-- ---------------------------------------------------------
-- Ranked platform administrators (allowlist)
-- ---------------------------------------------------------
create table public.ranked_admins (
  member_id uuid primary key
    references public.members(internal_id)
    on delete cascade,

  created_at timestamptz not null default now(),

  -- who granted this user admin rights (optional)
  created_by_member_id uuid
    references public.members(internal_id)
    on delete set null
);

create index idx_ranked_admins_created_at
  on public.ranked_admins (created_at desc);

-- ---------------------------------------------------------
-- Audit logs (cross-tenant actions done by Ranked staff/backends)
-- ---------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),

  actor_member_id uuid
    references public.members(internal_id)
    on delete set null,

  action text not null,     -- e.g. ORG_APPROVE, ORG_REJECT, TOURNAMENT_FIX, etc.
  entity text not null,     -- e.g. organisations, tournaments, members
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
  on public.audit_logs (actor_member_id, created_at desc);

-- ---------------------------------------------------------
-- RLS posture (Option A)
-- These are backend-owned tables. Enforce access in ranked-backend.
-- ---------------------------------------------------------
alter table public.ranked_admins disable row level security;
alter table public.audit_logs disable row level security;
