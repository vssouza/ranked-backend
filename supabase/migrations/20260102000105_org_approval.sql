-- =========================================================
-- 007_org_approval.sql
-- Organisation approval workflow fields
-- =========================================================

-- Add org approval state + review metadata
alter table public.organisations
  add column status text not null default 'PENDING'
    check (status in ('PENDING', 'ACTIVE', 'REJECTED'));

alter table public.organisations
  add column reviewed_by uuid
    references auth.users(id)
    on delete set null;

alter table public.organisations
  add column reviewed_at timestamptz;

alter table public.organisations
  add column review_note text;

-- Helpful index for admin review queue
create index idx_organisations_status_created_at
  on public.organisations (status, created_at desc);
