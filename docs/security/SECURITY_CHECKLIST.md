# Security Checklist (Pre-Staging / Pre-Production)

This checklist must be completed **before enabling staging or production environments**.

It ensures tenant isolation, approval workflows, and admin-only operations are correctly enforced at the database level.

---

## 1. Migration State

### Schema migrations
- [ ] All schema migrations applied in order (001 → latest)
- [ ] No failed or partially-applied migrations
- [ ] Composite foreign keys are present where expected:
  - tournaments → (id, organisation_id)
  - tournament_entries → (tournament_id, organisation_id)
  - tournament_staff → (tournament_id, organisation_id)
  - rounds / matches → (tournament_id, organisation_id)
  - standings tables → (tournament_id, organisation_id)

### Security migrations
- [ ] `005_rls.sql` applied
- [ ] `009_force_rls.sql` applied
- [ ] `010_admin_tables_rls.sql` applied
- [ ] `008_protect_org_approval_fields.sql` applied

---

## 2. RLS Status Verification

Confirm RLS is **enabled and forced** where expected.

### Tenant-scoped tables (FORCE RLS)
- [ ] organisations
- [ ] org_memberships
- [ ] org_invitations
- [ ] tournaments
- [ ] tournament_staff
- [ ] tournament_entries
- [ ] rounds
- [ ] matches
- [ ] standings_snapshots
- [ ] standings_snapshot_rows

### Admin-only tables (RLS enabled, deny client access)
- [ ] ranked_admins
- [ ] audit_logs

---

## 3. Org Approval Safety

- [ ] Organisations default to `status = 'PENDING'`
- [ ] Client users cannot update:
  - status
  - reviewed_by
  - reviewed_at
  - review_note
- [ ] `008_protect_org_approval_fields.sql` trigger blocks client-side approval
- [ ] Org approval is only possible via backend / privileged role

---

## 4. Tenant Isolation

### Cross-org isolation
- [ ] Users cannot read data from organisations they are not members of
- [ ] Cross-org access is denied for:
  - tournaments
  - entries
  - matches
  - standings
- [ ] Backend privileged access is the **only** way to perform cross-tenant operations

### Membership enforcement
- [ ] Only org admins can:
  - create tournaments
  - invite staff
  - modify tournament configuration
- [ ] Non-members cannot read org data

---

## 5. Tournament & Match Integrity

- [ ] Tournament creation requires ACTIVE organisation
- [ ] Player self-registration only allowed when tournament is `REG_OPEN`
- [ ] Duplicate player entries are prevented
- [ ] Guest entries enforce unique email per tournament
- [ ] BYE matches enforce:
  - exactly one player
  - `player2_entry_id IS NULL`
- [ ] Non-admin users cannot modify match results

---

## 6. Hybrid Tournaments (Swiss + Cut)

- [ ] `rounds.phase` column exists (`SWISS | CUT`)
- [ ] `rounds.cut_size` used for CUT rounds
- [ ] Standings snapshot records cut decision in `meta.cut`
- [ ] Cut rounds are created only after Swiss completion

---

## 7. Standings & Rankings Safety

- [ ] Standings snapshots are server-authoritative
- [ ] Snapshot rows cannot be modified by players
- [ ] Snapshot visibility matches product intent (staff-only or public)
- [ ] No client-side recomputation of standings

---

## 8. Admin Tables Lockdown

- [ ] Client roles (`anon`, `authenticated`) cannot read:
  - ranked_admins
  - audit_logs
- [ ] Only backend privileged role can write audit logs
- [ ] Admin allowlist (`ranked_admins`) is backend-managed only

---

## 9. Backend Access Model

- [ ] Frontend does NOT use `supabase-js` directly
- [ ] Backend uses:
  - Supabase service role **or**
  - Dedicated privileged Postgres user
- [ ] Privileged credentials are never exposed to clients
- [ ] Manual SQL access uses a sufficiently privileged role

---

## 10. Smoke Tests

- [ ] `docs/security/RLS_SMOKE_TEST.md` executed end-to-end
- [ ] All expected ALLOW cases succeed
- [ ] All expected DENY cases fail
- [ ] No “temporary” RLS bypasses left in place

---

## 11. Final Sign-off

- [ ] Schema reviewed
- [ ] RLS reviewed
- [ ] Approval workflow verified
- [ ] Tenant isolation verified
- [ ] Checklist reviewed by at least one other person

**Ready for staging / production 🚀**
