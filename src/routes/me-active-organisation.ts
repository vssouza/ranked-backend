import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../lib/db.js";

const BodySchema = z.object({
  organisationId: z.string().uuid().nullable(),
});

export async function registerMeActiveOrganisationRoute(app: FastifyInstance) {
  app.post("/me/active-organisation", async (req, reply) => {
    if (!req.member) return reply.code(401).send({ error: "Unauthorized" });

    const { organisationId } = BodySchema.parse(req.body);
    const memberId = req.member.internal_id;

    // Allow clearing active org
    if (organisationId === null) {
      await db.query(
        `
        insert into public.member_preferences (member_id, active_organisation_id, updated_at)
        values ($1, null, now())
        on conflict (member_id)
        do update set
          active_organisation_id = null,
          updated_at = now()
        `,
        [memberId]
      );
      return reply.send({ ok: true, activeOrganisationId: null });
    }

    // Verify user is an ACTIVE member of that org
    const membership = await db.query(
      `
      select 1
      from public.org_memberships
      where member_id = $1
        and organisation_id = $2
        and status = 'ACTIVE'
      limit 1
      `,
      [memberId, organisationId]
    );

    if ((membership.rowCount ?? 0) === 0) {
      return reply.code(403).send({ error: "FORBIDDEN_ORG" });
    }

    await db.query(
      `
      insert into public.member_preferences (member_id, active_organisation_id, updated_at)
      values ($1, $2, now())
      on conflict (member_id)
      do update set
        active_organisation_id = excluded.active_organisation_id,
        updated_at = now()
      `,
      [memberId, organisationId]
    );

    return reply.send({ ok: true, activeOrganisationId: organisationId });
  });
}
