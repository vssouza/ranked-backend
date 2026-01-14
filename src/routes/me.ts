import type { FastifyInstance } from "fastify"
import { db } from "../lib/db.js"
import { exists } from "../lib/db-helpers.js"
import { MeResponseSchema } from "../schemas/me.schema.js"

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

export async function registerMeRoute(app: FastifyInstance) {
  app.get("/me", async (req, reply) => {
    if (!req.member) return reply.code(401).send({ error: "Unauthorized" })

    const memberId = req.member.internal_id

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

    const payload = {
      user: {
        id: memberId,
        email: req.member.email,
        username: req.member.username ?? "",
        displayName: req.member.display_name ?? "",
      },
      isSuperAdmin,
      memberships: memberships.rows.map((r) => ({
        org: {
          id: r.organisation_id,
          slug: r.slug,
          name: r.name,
        },
        role: pickRole(r.roles),
      })),
      hasAddresses,
    }

    return MeResponseSchema.parse(payload)
  })
}
