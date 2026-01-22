import fp from "fastify-plugin";
import { z } from "zod";
import { db } from "../lib/db.js";

const OrgIdHeaderSchema = z.string().uuid();

type OrgRow = {
  id: string;
  slug: string;
  name: string;
};

type MembershipRow = {
  organisation_id: string;
  roles: string[] | null;
};

function pickRole(
  roles: string[] | null | undefined
): "owner" | "admin" | "organiser" | "member" {
  const set = new Set((roles ?? []).map((r) => String(r).toUpperCase()));
  if (set.has("OWNER")) return "owner";
  if (set.has("ADMIN")) return "admin";
  if (set.has("ORGANISER") || set.has("ORGANIZER")) return "organiser";
  return "member";
}

export default fp(async (app) => {
  app.decorateRequest("org", null);
  app.decorateRequest("orgRole", null);

  app.addHook("preHandler", async (req, reply) => {
    // Only applies when the client sends X-Org-Id
    const raw = req.headers["x-org-id"];
    if (!raw) return;

    // Must be authenticated first
    if (!req.member) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const orgId = OrgIdHeaderSchema.safeParse(String(raw));
    if (!orgId.success) {
      return reply.code(400).send({ error: "INVALID_ORG_ID" });
    }

    // Ensure membership (ACTIVE)
    const membership = await db.query<MembershipRow>(
      `
      select organisation_id, roles
      from public.org_memberships
      where member_id = $1
        and organisation_id = $2
        and status = 'ACTIVE'
      limit 1
      `,
      [req.member.internal_id, orgId.data]
    );

    const m = membership.rows[0];
    if (!m) {
      return reply.code(403).send({ error: "FORBIDDEN_ORG" });
    }

    const org = await db.query<OrgRow>(
      `
      select id, slug, name
      from public.organisations
      where id = $1
      limit 1
      `,
      [orgId.data]
    );

    const o = org.rows[0];
    if (!o) {
      return reply.code(404).send({ error: "ORG_NOT_FOUND" });
    }

    req.org = o;
    req.orgRole = pickRole(m.roles);
  });
});
