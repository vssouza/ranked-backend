import type { FastifyInstance } from "fastify"
import { db } from "../lib/db.js"
import { ListMemberAddressesResponseSchema } from "../schemas/member-addresses.schema.js"

type MemberAddressRow = {
  id: string
  member_id: string

  label: string | null
  full_name: string | null

  line1: string
  line2: string | null
  city: string
  region: string | null
  postal_code: string | null
  country: string
  phone: string | null

  is_default: boolean

  created_at: string | Date
  updated_at: string | Date
}

function emptyToNull(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length === 0 ? null : t
}

export async function registerMemberAddressesRoutes(app: FastifyInstance) {
  app.get("/member-addresses", async (req, reply) => {
    if (!req.member) return reply.code(401).send({ error: "Unauthorized" })

    const memberId = req.member.internal_id

    const { rows } = await db.query<MemberAddressRow>(
      `
      select
        id,
        member_id,
        label,
        full_name,
        line1,
        line2,
        city,
        region,
        postal_code,
        country,
        phone,
        is_default,
        created_at,
        updated_at
      from public.member_addresses
      where member_id = $1
      order by is_default desc, created_at desc
      `,
      [memberId]
    )

    const data = {
      items: rows.map((r: MemberAddressRow) => ({
        id: r.id,
        memberId: r.member_id,

        label: emptyToNull(r.label),
        fullName: emptyToNull(r.full_name),

        line1: r.line1.trim(),
        line2: emptyToNull(r.line2),
        city: r.city.trim(),
        region: emptyToNull(r.region),
        postalCode: emptyToNull(r.postal_code),
        country: r.country.trim(),
        phone: emptyToNull(r.phone),

        isDefault: r.is_default,

        createdAt: new Date(r.created_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString(),
      })),
    }

    return ListMemberAddressesResponseSchema.parse(data)
  })
}
