-- =========================================================
-- 015_fix_member_addresses_for_internal_member_id.sql
-- Recreate member_addresses to reference members.internal_id
-- (Option A: app-owned member identity)
-- =========================================================

create extension if not exists pgcrypto;

-- If table exists from prior migrations, drop it (no data yet)
drop table if exists public.member_addresses cascade;

-- Recreate with FK to members.internal_id
create table public.member_addresses (
  id uuid primary key default gen_random_uuid(),

  member_id uuid not null
    references public.members(internal_id)
    on delete cascade,

  label text, -- e.g. 'Home', 'Work' (optional)
  full_name text, -- recipient name for shipping

  line1 text not null,
  line2 text,
  city text not null,
  region text,
  postal_code text,
  country text not null,
  phone text,

  is_default boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index member_addresses_member_id_idx
on public.member_addresses(member_id);

-- Ensure at most one default address per member
create unique index member_addresses_one_default_per_member
on public.member_addresses(member_id)
where is_default;

-- updated_at trigger
drop trigger if exists set_member_addresses_updated_at on public.member_addresses;
create trigger set_member_addresses_updated_at
before update on public.member_addresses
for each row execute procedure public.set_updated_at();

-- =========================================================
-- RLS (recommended for Option A)
-- If all access goes through ranked-backend, enforce auth there.
-- =========================================================
alter table public.member_addresses disable row level security;
