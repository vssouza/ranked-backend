import type {FastifyInstance} from "fastify";
import {db} from "@/lib/db.js";
import {ListMemberAddressesResponseSchema} from "@/schemas/member-addresses.schema.js";

function emptyToNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export async function registerMemberAddressesRoutes(app: FastifyInstance) {
  app.get("/member-addresses", async (req, reply) => {
    if (!req.member) return reply.code(401).send({error: "Unauthorized"});

    const memberId = req.member.internal_id;

    const {rows} = await db.query(
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
    );

    const data = {
      items: rows.map((r) => ({
        id: r.id,
        memberId: r.member_id,

        label: emptyToNull(r.label),
        fullName: emptyToNull(r.full_name),

        line1: String(r.line1).trim(),
        line2: emptyToNull(r.line2),
        city: String(r.city).trim(),
        region: emptyToNull(r.region),
        postalCode: emptyToNull(r.postal_code),
        country: String(r.country).trim(),
        phone: emptyToNull(r.phone),

        isDefault: Boolean(r.is_default),

        createdAt: new Date(r.created_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString(),
      })),
    };

    return ListMemberAddressesResponseSchema.parse(data);
  });
}
