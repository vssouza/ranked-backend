-- =========================================================
-- 014_members_decouple_from_supabase.sql
-- Recreate members as app-owned identity + provider mapping
-- =========================================================

-- Optional, but usually available in Supabase:
-- gen_random_uuid() comes from pgcrypto
create extension if not exists pgcrypto;

-- -----------------------------
-- Remove Supabase-coupled trigger/function
-- -----------------------------
do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
  ) then
    drop trigger on_auth_user_created on auth.users;
  end if;
exception
  when undefined_table then
    -- auth.users might not be accessible in some contexts; ignore
    null;
end $$;

drop function if exists public.handle_new_user();

-- -----------------------------
-- Drop old members table (no data, so simplest)
-- -----------------------------
drop table if exists public.members cascade;

-- -----------------------------
-- Recreate members as app-owned
-- -----------------------------
create table public.members (
  -- Your internal, stable identifier for the app
  internal_id uuid primary key default gen_random_uuid(),

  -- Provider mapping (lets you swap auth providers later)
  auth_provider text not null default 'supabase',            -- e.g. 'supabase'
  auth_subject  text not null,                               -- e.g. Supabase user id (sub), stored as text for portability

  -- Optional convenience: keep this while you're on Supabase (not required for portability)
  supabase_user_id uuid null,             -- can store the UUID version of auth_subject for debugging/joins, but don't FK it

  email text not null,

  username varchar(32)
    check (char_length(username) between 3 and 32)
    check (username = lower(username))
    check (username ~ '^[a-z0-9_]+$'),

  display_name varchar(64) not null default ''
    check (char_length(trim(display_name)) between 0 and 64),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One row per external identity (critical)
  constraint members_auth_identity_unique unique (auth_provider, auth_subject)
);

-- Case-insensitive uniqueness (and allows multiple NULL usernames)
create unique index members_username_lower_unique
on public.members (lower(username));

create index members_email_idx on public.members (email);

-- -----------------------------
-- updated_at trigger (reuse your existing helper if you want)
-- -----------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_members_updated_at on public.members;
create trigger set_members_updated_at
before update on public.members
for each row execute procedure public.set_updated_at();

-- -----------------------------
-- RLS: recommended change for Option A
-- -----------------------------
-- If the frontend NEVER touches the DB directly (only your backend does),
-- you can disable RLS on members and enforce in the backend.
-- (Service role bypasses RLS anyway.)
alter table public.members disable row level security;

-- If you insist on keeping RLS, do NOT enable/force until you've decided
-- how you'll pass internal_id into Postgres (JWT custom claims or settings).
