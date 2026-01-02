# RLS Smoke Test Checklist (Pre-Prod)

## Purpose
Verify tenant isolation and role-based access control
after enabling RLS and FORCE RLS.

## Preconditions
- Applied migrations: 005, 009, 010
- Users: Alice (OWNER), Bob (STAFF), Carol (PLAYER)
- Backend uses privileged connection

## Org lifecycle
- [ ] Alice can create org (PENDING)
- [ ] Alice cannot self-approve
- [ ] Backend can approve
- [ ] Bob/Carol cannot read PENDING org

## Memberships
- [ ] OWNER can invite
- [ ] Non-admin cannot view invitations
- [ ] Cross-org reads denied

## Tournaments
- [ ] Only admins can create
- [ ] Only members can read
- [ ] Cross-org isolation enforced

## Entries
- [ ] Self-registration allowed in REG_OPEN
- [ ] Duplicate entry blocked
- [ ] Guest email uniqueness enforced

## Rounds & Matches
- [ ] Admin can create rounds
- [ ] BYE constraint enforced
- [ ] Non-admin cannot report results

## Standings
- [ ] Snapshot creation restricted
- [ ] Snapshot read visibility correct

## Admin tables
- [ ] ranked_admins inaccessible from client
- [ ] audit_logs inaccessible from client

## FORCE RLS sanity
- [ ] Non-privileged DB role cannot bypass RLS
