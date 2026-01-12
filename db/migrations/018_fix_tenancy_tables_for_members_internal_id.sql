-- =========================================================
-- 018_fix_tenancy_tables_for_members_internal_id.sql
-- Decouple tenancy tables from auth.users and bind to
-- app-owned members.internal_id (Option A).
--
-- Safe if you have no production data yet:
-- - Drops and recreates organisations, org_memberships, org_invitations
-- =========================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------
-- Drop old tables (in dependency order)
-- ---------------------------------------------------------
drop table if exists public.org_invitations cascade;
drop table if exists public.org_memberships cascade;
drop table if exists public.organisations cascade;

-- ---------------------------------------------------------
-- Recreate organisations (tenants)
-- ---------------------------------------------------------
create table public.organisations (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug varchar(63) not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),

  created_by_member_id uuid not null
    references public.members(internal_id)
    on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_organisations_created_by_member
  on public.organisations (created_by_member_id);

-- updated_at trigger (assumes public.set_updated_at() exists)
drop trigger if exists trg_organisations_updated_at on public.organisations;
create trigger trg_organisations_updated_at
before update on public.organisations
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------
-- Recreate organisation memberships
-- ---------------------------------------------------------
create table public.org_memberships (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  member_id uuid not null
    references public.members(internal_id)
    on delete cascade,

  roles text[] not null default array['OWNER']::text[],

  status text not null default 'ACTIVE',
  -- ACTIVE | INVITED | REMOVED

  invited_by_member_id uuid
    references public.members(internal_id)
    on delete set null,

  created_at timestamptz not null default now(),

  unique (organisation_id, member_id)
);

create index idx_org_memberships_member
  on public.org_memberships (member_id);

create index idx_org_memberships_org
  on public.org_memberships (organisation_id);

-- ---------------------------------------------------------
-- Recreate organisation invitations
-- ---------------------------------------------------------
create table public.org_invitations (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  email citext not null,

  roles text[] not null default array['STAFF']::text[],

  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,

  invited_by_member_id uuid
    references public.members(internal_id)
    on delete set null,

  created_at timestamptz not null default now(),

  unique (organisation_id, email)
);

create index idx_org_invitations_org
  on public.org_invitations (organisation_id);

create index idx_org_invitations_email
  on public.org_invitations (email);

-- ---------------------------------------------------------
-- RLS posture (Option A)
-- These are backend-owned tables. Enforce access in ranked-backend.
-- ---------------------------------------------------------
alter table public.organisations disable row level security;
alter table public.org_memberships disable row level security;
alter table public.org_invitations disable row level security;
