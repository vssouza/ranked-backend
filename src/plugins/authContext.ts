import fp from "fastify-plugin";
import {db} from "@/lib/db.js";

declare module "fastify" {
  interface FastifyRequest {
    member: null | {
      internal_id: string;
      email: string;
      username: string | null;
      display_name: string;
    };
  }
}

export default fp(async (app) => {
  app.decorateRequest("member", null);

  app.addHook("preHandler", async (req) => {
    const memberId = req.session.get("memberId") as string | undefined;
    if (!memberId) return;

    const {rows} = await db.query(
      `select internal_id, email, username, display_name
       from public.members
       where internal_id = $1
       limit 1`,
      [memberId]
    );

    req.member = rows[0] ?? null;
  });
});
