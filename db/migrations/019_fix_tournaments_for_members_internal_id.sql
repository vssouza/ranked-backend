-- =========================================================
-- 019_fix_tournaments_for_members_internal_id.sql
-- Decouple tournament tables from auth.users and bind to
-- app-owned members.internal_id (Option A).
--
-- Safe to drop & recreate if you have no production data yet.
-- =========================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------
-- Drop old tables (dependency order)
-- ---------------------------------------------------------
drop table if exists public.tournament_entries cascade;
drop table if exists public.tournament_staff cascade;
drop table if exists public.tournaments cascade;

-- ---------------------------------------------------------
-- Recreate tournaments
-- ---------------------------------------------------------
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  name text not null,

  format text not null
    check (format in ('SWISS', 'ROUND_ROBIN', 'SINGLE_ELIM')),

  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'REG_OPEN', 'IN_PROGRESS', 'COMPLETE', 'CANCELLED')),

  start_at timestamptz,
  end_at timestamptz,

  settings jsonb not null default '{}'::jsonb,

  created_by_member_id uuid not null
    references public.members(internal_id)
    on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (end_at is null or start_at is null or end_at >= start_at),

  -- enables composite FK enforcement from child tables
  unique (id, organisation_id)
);

create index idx_tournaments_org_created_at
  on public.tournaments (organisation_id, created_at desc);

create index idx_tournaments_org_status
  on public.tournaments (organisation_id, status);

create index idx_tournaments_created_by_member
  on public.tournaments (created_by_member_id);

-- updated_at trigger (assumes public.set_updated_at() exists)
drop trigger if exists trg_tournaments_updated_at on public.tournaments;
create trigger trg_tournaments_updated_at
before update on public.tournaments
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------
-- Recreate tournament_staff
-- ---------------------------------------------------------
create table public.tournament_staff (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  tournament_id uuid not null,

  member_id uuid not null
    references public.members(internal_id)
    on delete cascade,

  roles text[] not null default array['STAFF']::text[],

  created_at timestamptz not null default now(),

  unique (tournament_id, member_id),

  -- enforce tournament belongs to same org
  foreign key (tournament_id, organisation_id)
    references public.tournaments (id, organisation_id)
    on delete cascade
);

create index idx_tournament_staff_tournament
  on public.tournament_staff (tournament_id);

create index idx_tournament_staff_org
  on public.tournament_staff (organisation_id);

create index idx_tournament_staff_member
  on public.tournament_staff (member_id);

-- ---------------------------------------------------------
-- Recreate tournament_entries
-- ---------------------------------------------------------
create table public.tournament_entries (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  tournament_id uuid not null,

  -- nullable: allows guest entries not linked to a member account
  member_id uuid
    references public.members(internal_id)
    on delete set null,

  display_name text not null,
  email citext,

  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'DROPPED', 'DISQUALIFIED')),

  seed int,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  unique (tournament_id, member_id),

  check (seed is null or seed > 0),

  -- enforce tournament belongs to same org
  foreign key (tournament_id, organisation_id)
    references public.tournaments (id, organisation_id)
    on delete cascade
);

create index idx_tournament_entries_tournament
  on public.tournament_entries (tournament_id);

create index idx_tournament_entries_org
  on public.tournament_entries (organisation_id);

create index idx_tournament_entries_member
  on public.tournament_entr_
