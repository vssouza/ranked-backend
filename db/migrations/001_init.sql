-- =========================================================
-- 001_init.sql
-- Initial schema: extensions + core tenancy tables
-- =========================================================

-- -----------------------------
-- Extensions
-- -----------------------------
-- UUID generation
create extension if not exists "pgcrypto";

-- Case-insensitive text (emails, slugs)
create extension if not exists "citext";

-- -----------------------------
-- Organisations (tenants)
-- -----------------------------
create table public.organisations (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug varchar(63) not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),

  created_by uuid not null
    references auth.users(id)
    on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_organisations_created_by
  on public.organisations (created_by);

-- -----------------------------
-- Organisation memberships
-- -----------------------------
create table public.org_memberships (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  -- Flexible role system (extend later)
  roles text[] not null default array['OWNER']::text[],

  status text not null default 'ACTIVE',
  -- ACTIVE | INVITED | REMOVED

  invited_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  unique (organisation_id, user_id)
);

create index idx_org_memberships_user
  on public.org_memberships (user_id);

create index idx_org_memberships_org
  on public.org_memberships (organisation_id);

-- -----------------------------
-- Organisation invitations
-- -----------------------------
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

  invited_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  unique (organisation_id, email)
);

create index idx_org_invitations_org
  on public.org_invitations (organisation_id);

create index idx_org_invitations_email
  on public.org_invitations (email);

-- -----------------------------
-- Updated_at helper
-- -----------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_organisations_updated_at
before update on public.organisations
for each row
execute function public.set_updated_at();
