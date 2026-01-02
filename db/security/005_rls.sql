-- =========================================================
-- 005_rls.sql
-- Row Level Security (RLS) baseline for multi-tenancy
-- Applies to:
--   organisations, org_memberships, org_invitations
--   tournaments, tournament_staff, tournament_entries
-- =========================================================

-- -----------------------------
-- Helper: current_user_id()
-- -----------------------------
-- Wrapper so policies don't sprinkle auth.uid() everywhere.
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    auth.uid(),
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    nullif(current_setting('app.current_user_id', true), '')::uuid
  );
$$;

-- -----------------------------
-- Helper: org status
-- -----------------------------
create or replace function public.is_org_active(p_org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organisations o
    where o.id = p_org_id
      and o.status = 'ACTIVE'
  );
$$;

-- -----------------------------
-- Helper: org membership checks
-- -----------------------------
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.org_memberships m
    where m.organisation_id = p_org_id
      and m.user_id = public.current_user_id()
      and m.status = 'ACTIVE'
  );
$$;

create or replace function public.has_org_role(p_org_id uuid, p_role text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.org_memberships m
    where m.organisation_id = p_org_id
      and m.user_id = public.current_user_id()
      and m.status = 'ACTIVE'
      and p_role = any(m.roles)
  );
$$;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
as $$
  select public.has_org_role(p_org_id, 'OWNER')
      or public.has_org_role(p_org_id, 'ADMIN');
$$;

-- =========================================================
-- Enable RLS
-- =========================================================

alter table public.organisations enable row level security;
alter table public.org_memberships enable row level security;
alter table public.org_invitations enable row level security;

alter table public.tournaments enable row level security;
alter table public.tournament_staff enable row level security;
alter table public.tournament_entries enable row level security;

-- NOTE: You already created 009_force_rls.sql to FORCE RLS later.

-- =========================================================
-- organisations policies (approval-aware)
-- =========================================================

-- Select:
-- - ACTIVE org: members can read
-- - Creator can read their own org request (PENDING/REJECTED too)
drop policy if exists organisations_select on public.organisations;
create policy organisations_select
on public.organisations
for select
to authenticated
using (
  (status = 'ACTIVE' and public.is_org_member(id))
  or (created_by = public.current_user_id())
);

-- Insert: any authenticated user can submit an org request (defaults to PENDING)
drop policy if exists organisations_insert on public.organisations;
create policy organisations_insert
on public.organisations
for insert
to authenticated
with check (
  created_by = public.current_user_id()
);

-- Update:
-- Only admins of ACTIVE orgs can update (name/slug/etc.).
-- This also prevents PENDING orgs from being modified to ACTIVE by client-side update,
-- because PENDING rows won't pass the USING clause.
drop policy if exists organisations_update on public.organisations;
create policy organisations_update
on public.organisations
for update
to authenticated
using (
  status = 'ACTIVE'
  and public.is_org_admin(id)
)
with check (
  status = 'ACTIVE'
  and public.is_org_admin(id)
);

-- Delete: only OWNER, and only if org is ACTIVE (optional safety)
drop policy if exists organisations_delete on public.organisations;
create policy organisations_delete
on public.organisations
for delete
to authenticated
using (
  status = 'ACTIVE'
  and public.has_org_role(id, 'OWNER')
);

-- =========================================================
-- org_memberships policies
-- =========================================================

-- Select:
-- - users can read their own memberships
-- - members of ACTIVE org can read all memberships in that org (staff UI)
drop policy if exists org_memberships_select on public.org_memberships;
create policy org_memberships_select
on public.org_memberships
for select
to authenticated
using (
  user_id = public.current_user_id()
  or (
    public.is_org_active(organisation_id)
    and public.is_org_member(organisation_id)
  )
);

-- Insert: only admins of ACTIVE orgs can add memberships
drop policy if exists org_memberships_insert on public.org_memberships;
create policy org_memberships_insert
on public.org_memberships
for insert
to authenticated
with check (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
);

-- Update: only admins of ACTIVE orgs can change roles/status
drop policy if exists org_memberships_update on public.org_memberships;
create policy org_memberships_update
on public.org_memberships
for update
to authenticated
using (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
)
with check (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
);

-- Delete: only admins of ACTIVE orgs can remove memberships
drop policy if exists org_memberships_delete on public.org_memberships;
create policy org_memberships_delete
on public.org_memberships
for delete
to authenticated
using (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
);

-- =========================================================
-- org_invitations policies
-- =========================================================

-- Select: only admins of ACTIVE orgs can see invitations
drop policy if exists org_invitations_select on public.org_invitations;
create policy org_invitations_select
on public.org_invitations
for select
to authenticated
using (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
);

-- Insert: only admins of ACTIVE orgs can create invitations
drop policy if exists org_invitations_insert on public.org_invitations;
create policy org_invitations_insert
on public.org_invitations
for insert
to authenticated
with check (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
);

-- Update/Delete: only admins of ACTIVE orgs
drop policy if exists org_invitations_update on public.org_invitations;
create policy org_invitations_update
on public.org_invitations
for update
to authenticated
using (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
)
with check (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
);

drop policy if exists org_invitations_delete on public.org_invitations;
create policy org_invitations_delete
on public.org_invitations
for delete
to authenticated
using (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
);

-- =========================================================
-- tournaments policies
-- =========================================================

-- Select: members of ACTIVE org can read tournaments
drop policy if exists tournaments_select on public.tournaments;
create policy tournaments_select
on public.tournaments
for select
to authenticated
using (
  public.is_org_active(organisation_id)
  and public.is_org_member(organisation_id)
);

-- Insert/Update/Delete: org admins only (ACTIVE org)
drop policy if exists tournaments_insert on public.tournaments;
create policy tournaments_insert
on public.tournaments
for insert
to authenticated
with check (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
  and created_by = public.current_user_id()
);

drop policy if exists tournaments_update on public.tournaments;
create policy tournaments_update
on public.tournaments
for update
to authenticated
using (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
)
with check (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
);

drop policy if exists tournaments_delete on public.tournaments;
create policy tournaments_delete
on public.tournaments
for delete
to authenticated
using (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
);

-- =========================================================
-- tournament_staff policies
-- =========================================================

-- Select: org members can view staff list (ACTIVE org)
drop policy if exists tournament_staff_select on public.tournament_staff;
create policy tournament_staff_select
on public.tournament_staff
for select
to authenticated
using (
  public.is_org_active(organisation_id)
  and public.is_org_member(organisation_id)
);

-- Insert/Update/Delete: org admins only (ACTIVE org)
drop policy if exists tournament_staff_insert on public.tournament_staff;
create policy tournament_staff_insert
on public.tournament_staff
for insert
to authenticated
with check (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
);

drop policy if exists tournament_staff_update on public.tournament_staff;
create policy tournament_staff_update
on public.tournament_staff
for update
to authenticated
using (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
)
with check (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
);

drop policy if exists tournament_staff_delete on public.tournament_staff;
create policy tournament_staff_delete
on public.tournament_staff
for delete
to authenticated
using (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
);

-- =========================================================
-- tournament_entries policies
-- =========================================================

-- Select:
-- - org members can read all entries (ACTIVE org)
-- - a registered player can read their own entry even if not org staff/member
drop policy if exists tournament_entries_select on public.tournament_entries;
create policy tournament_entries_select
on public.tournament_entries
for select
to authenticated
using (
  (public.is_org_active(organisation_id) and public.is_org_member(organisation_id))
  or (public.is_org_active(organisation_id) and user_id = public.current_user_id())
);

-- Insert:
-- Allow self-registration for authenticated users when tournament is REG_OPEN (ACTIVE org).
-- Guests (user_id is null) require org admin.
drop policy if exists tournament_entries_insert on public.tournament_entries;
create policy tournament_entries_insert
on public.tournament_entries
for insert
to authenticated
with check (
  public.is_org_active(organisation_id)
  and (
    (
      user_id = public.current_user_id()
      and exists (
        select 1
        from public.tournaments t
        where t.id = tournament_id
          and t.organisation_id = organisation_id
          and t.status = 'REG_OPEN'
      )
    )
    or (
      user_id is null
      and public.is_org_admin(organisation_id)
    )
  )
);

-- Update/Delete:
-- Keep it simple/safe: org admins only (ACTIVE org)
drop policy if exists tournament_entries_update on public.tournament_entries;
create policy tournament_entries_update
on public.tournament_entries
for update
to authenticated
using (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
)
with check (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
);

drop policy if exists tournament_entries_delete on public.tournament_entries;
create policy tournament_entries_delete
on public.tournament_entries
for delete
to authenticated
using (
  public.is_org_active(organisation_id)
  and public.is_org_admin(organisation_id)
);
