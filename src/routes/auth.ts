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

    const {data, error} = await supabaseAuth.auth.getUser(accessToken);
    if (error || !data?.user) {
      return reply.code(401).send({error: "Invalid token"});
    }

    const user = data.user;
    const supaUserId = user.id; // uuid string
    const email = user.email ?? "";

    // Upsert by provider mapping (Option A)
    const {rows} = await db.query(
      `insert into public.members (auth_provider, auth_subject, supabase_user_id, email, display_name)
       values ($1, $2, $3::uuid, $4, $5)
       on conflict (auth_provider, auth_subject)
       do update set
         email = excluded.email
       returning internal_id, email, username, display_name`,
      ["supabase", supaUserId, supaUserId, email, ""]
    );

    const member = rows[0];

    // Set encrypted session cookie
    req.session.set("memberId", member.internal_id);

    return reply.send({ok: true});
  });

  app.post("/auth/logout", async (req, reply) => {
    req.session.delete();
    return reply.send({ok: true});
  });
}
