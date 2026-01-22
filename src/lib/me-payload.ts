// src/lib/me-payload.ts
import { db } from "../lib/db.js"
import { exists } from "../lib/db-helpers.js"

type MembershipRow = {
  organisation_id: string
  roles: string[] | null
  slug: string
  name: string
}

function pickRole(
  roles: string[] | null | undefined
): "owner" | "admin" | "organiser" | "member" {
  const set = new Set((roles ?? []).map((r) => String(r).toUpperCase()))
  if (set.has("OWNER")) return "owner"
  if (set.has("ADMIN")) return "admin"
  if (set.has("ORGANISER") || set.has("ORGANIZER")) return "organiser"
  return "member"
}

export async function buildMePayload(member: {
  internal_id: string
  email: string
  username: string | null
  display_name: string
}) {
  const memberId = member.internal_id

  const [isSuperAdmin, memberships, hasAddresses] = await Promise.all([
    exists(
      db,
      `select 1 from public.ranked_admins where member_id = $1 limit 1`,
      [memberId]
    ),
    db.query<MembershipRow>(
      `
      select
        m.organisation_id,
        m.roles,
        o.slug,
        o.name
      from public.org_memberships m
      join public.organisations o
        on o.id = m.organisation_id
      where m.member_id = $1
        and m.status = 'ACTIVE'
      order by o.name asc
      `,
      [memberId]
    ),
    exists(
      db,
      `select 1 from public.member_addresses where member_id = $1 limit 1`,
      [memberId]
    ),
  ])

  return {
    ok: true as const,
    user: {
      id: memberId,
      email: member.email,
      username: member.username ?? "",
      displayName: member.display_name ?? "",
    },
    isSuperAdmin,
    memberships: memberships.rows.map((r: MembershipRow) => ({
      org: {
        id: r.organisation_id,
        slug: r.slug,
        name: r.name,
      },
      role: pickRole(r.roles),
    })),
    hasAddresses,
  }
}
