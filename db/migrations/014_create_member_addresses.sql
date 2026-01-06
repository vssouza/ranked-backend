-- =========================================================
-- 014_create_member_addresses.sql
-- Member profile / shipping addresses (user-scoped PII)
-- =========================================================

-- -----------------------------
-- Table
-- -----------------------------
create table if not exists public.member_addresses (
  id uuid primary key default gen_random_uuid(),

  member_id uuid not null
    references public.members(id)
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

-- -----------------------------
-- Indexes
-- -----------------------------
create index if not exists member_addresses_member_id_idx
on public.member_addresses(member_id);

-- Ensure at most one default address per member
create unique index if not exists member_addresses_one_default_per_member
on public.member_addresses(member_id)
where is_default;

-- -----------------------------
-- RLS
-- -----------------------------
alter table public.member_addresses enable row level security;

-- Select: users can read their own addresses
drop policy if exists member_addresses_select_own on public.member_addresses;
create policy member_addresses_select_own
on public.member_addresses
for select
to authenticated
using (member_id = public.current_user_id());

-- Insert: users can create their own addresses
drop policy if exists member_addresses_insert_own on public.member_addresses;
create policy member_addresses_insert_own
on public.member_addresses
for insert
to authenticated
with check (member_id = public.current_user_id());

-- Update: users can update their own addresses
drop policy if exists member_addresses_update_own on public.member_addresses;
create policy member_addresses_update_own
on public.member_addresses
for update
to authenticated
using (member_id = public.current_user_id())
with check (member_id = public.current_user_id());

-- Delete: users can delete their own addresses
drop policy if exists member_addresses_delete_own on public.member_addresses;
create policy member_addresses_delete_own
on public.member_addresses
for delete
to authenticated
using (member_id = public.current_user_id());

-- -----------------------------
-- updated_at trigger
-- -----------------------------
drop trigger if exists set_member_addresses_updated_at on public.member_addresses;
create trigger set_member_addresses_updated_at
before update on public.member_addresses
for each row execute procedure public.set_updated_at();
