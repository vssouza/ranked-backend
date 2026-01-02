-- =========================================================
-- 002_tournaments.sql
-- Tournaments + tournament staff + tournament entries (players)
-- =========================================================

-- -----------------------------
-- tournaments
-- -----------------------------
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

  created_by uuid not null
    references auth.users(id)
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

create index idx_tournaments_created_by
  on public.tournaments (created_by);

create trigger trg_tournaments_updated_at
before update on public.tournaments
for each row
execute function public.set_updated_at();

-- -----------------------------
-- tournament_staff
-- -----------------------------
create table public.tournament_staff (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  tournament_id uuid not null,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  roles text[] not null default array['STAFF']::text[],

  created_at timestamptz not null default now(),

  unique (tournament_id, user_id),

  -- enforce tournament belongs to same org
  foreign key (tournament_id, organisation_id)
    references public.tournaments (id, organisation_id)
    on delete cascade
);

create index idx_tournament_staff_tournament
  on public.tournament_staff (tournament_id);

create index idx_tournament_staff_org
  on public.tournament_staff (organisation_id);

create index idx_tournament_staff_user
  on public.tournament_staff (user_id);

-- -----------------------------
-- tournament_entries
-- -----------------------------
create table public.tournament_entries (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  tournament_id uuid not null,

  user_id uuid
    references auth.users(id)
    on delete set null,

  display_name text not null,
  email citext,

  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'DROPPED', 'DISQUALIFIED')),

  seed int,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  unique (tournament_id, user_id),

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

create index idx_tournament_entries_user
  on public.tournament_entries (user_id);

create index idx_tournament_entries_status
  on public.tournament_entries (tournament_id, status);

-- Prevent duplicate guest entries by email (recommended)
create unique index uq_tournament_entries_guest_email
  on public.tournament_entries (tournament_id, email)
  where user_id is null and email is not null;
