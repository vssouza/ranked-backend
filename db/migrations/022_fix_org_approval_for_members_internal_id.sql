-- =========================================================
-- 022_fix_org_approval_for_members_internal_id.sql
-- Option A: ensure org approval fields exist and bind reviewer to
-- members.internal_id (not auth.users).
--
-- Designed to be run AFTER 018 (which recreates organisations).
-- =========================================================

-- 1) status (idempotent)
alter table public.organisations
  add column if not exists status text not null default 'PENDING'
    check (status in ('PENDING', 'ACTIVE', 'REJECTED'));

-- 2) reviewer (Option A)
-- If an old reviewed_by column exists (auth.users FK), replace it.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organisations'
      and column_name = 'reviewed_by'
  ) then
    -- Drop FK constraint on reviewed_by if present
    begin
      alter table public.organisations drop constraint if exists organisations_reviewed_by_fkey;
    exception when others then
      -- constraint name might differ; ignore
      null;
    end;

    -- Rename the column to the new name
    alter table public.organisations
      rename column reviewed_by to reviewed_by_member_id;
  else
    -- Column not present, add the new one
    alter table public.organisations
      add column reviewed_by_member_id uuid;
  end if;
end $$;

-- Add (or re-add) correct FK to members.internal_id
alter table public.organisations
  drop constraint if exists organisations_reviewed_by_member_id_fkey;

alter table public.organisations
  add constraint organisations_reviewed_by_member_id_fkey
  foreign key (reviewed_by_member_id)
  references public.members(internal_id)
  on delete set null;

-- 3) reviewed_at + review_note (idempotent)
alter table public.organisations
  add column if not exists reviewed_at timestamptz;

alter table public.organisations
  add column if not exists review_note text;

-- 4) Helpful index for admin review queue (idempotent)
create index if not exists idx_organisations_status_created_at
  on public.organisations (status, created_at desc);

-- Option A posture
alter table public.organisations disable row level security;
