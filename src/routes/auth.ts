import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {supabaseAuth} from "@/lib/supabaseAuth.js";
import {db} from "@/lib/db.js";

const ExchangeBody = z.object({
  accessToken: z.string().min(10),
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/exchange", async (req, reply) => {
    const {accessToken} = ExchangeBody.parse(req.body);

    /**
     * 1) Identify provider
     * For now this is always Supabase, but this becomes dynamic later
     */
    const provider = "supabase";

    /**
     * 2) Validate token with provider
     */
    const {data, error} = await supabaseAuth.auth.getUser(accessToken);
    if (error || !data?.user) {
      return reply.code(401).send({error: "Invalid token"});
    }

    const user = data.user;

    /**
     * 3) Extract provider subject + profile
     */
    const subject = user.id; // provider-specific stable ID
    const email = user.email ?? "";
    const displayName = "";

    /**
     * 4) Upsert member (Option A identity mapping)
     */
    const {rows} = await db.query(
      `
      insert into public.members (
        auth_provider,
        auth_subject,
        supabase_user_id,
        email,
        display_name
      )
      values ($1, $2, $3::uuid, $4, $5)
      on conflict (auth_provider, auth_subject)
      do update set
        email = excluded.email
      returning internal_id, email, username, display_name
      `,
      [provider, subject, subject, email, displayName]
    );

    const member = rows[0];

    /**
     * 5) Create backend session
     */
    req.session.set("memberId", member.internal_id);

    return reply.send({ok: true});
  });

  app.post("/auth/logout", async (req, reply) => {
    req.session.delete();
    return reply.send({ok: true});
  });
}
