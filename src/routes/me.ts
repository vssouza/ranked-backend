import type {FastifyInstance} from "fastify";
import {db} from "@/lib/db.js";
import {MeResponseSchema} from "@/schemas/me.schema.js";

function pickRole(
  roles: string[] | null | undefined
): "owner" | "admin" | "organiser" | "member" {
  const set = new Set((roles ?? []).map((r) => String(r).toUpperCase()));
  if (set.has("OWNER")) return "owner";
  if (set.has("ADMIN")) return "admin";
  if (set.has("ORGANISER") || set.has("ORGANIZER")) return "organiser";
  return "member";
}

export async function registerMeRoute(app: FastifyInstance) {
  app.get("/me", async (req, reply) => {
    if (!req.member) return reply.code(401).send({error: "Unauthorized"});

    const memberId = req.member.internal_id;

    const [admins, memberships, addresses] = await Promise.all([
      db.query(
        `select 1 from public.ranked_admins where member_id = $1 limit 1`,
        [memberId]
      ),
      db.query(
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
      db.query(
        `select 1 from public.member_addresses where member_id = $1 limit 1`,
        [memberId]
      ),
    ]);

    const payload = {
      user: {
        id: memberId,
        email: req.member.email,
        username: req.member.username ?? "", // schema requires string
        displayName: req.member.display_name ?? "",
      },
      isSuperAdmin: admins.rowCount > 0,
      memberships: memberships.rows.map((r) => ({
        org: {
          id: r.organisation_id,
          slug: r.slug,
          name: r.name,
        },
        role: pickRole(r.roles),
      })),
      hasAddresses: addresses.rowCount > 0,
    };

    return MeResponseSchema.parse(payload);
  });
}
