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

function intFromEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export default fp(async (app) => {
  app.decorateRequest("member", null);

  app.addHook("preHandler", async (req) => {
    const memberId = req.session.get("memberId") as string | undefined;
    if (!memberId) return;

    // Rolling idle timeout (sliding expiration)
    const rolling = (process.env.SESSION_ROLLING ?? "true") === "true";
    if (rolling) {
      const ttlSeconds = intFromEnv("SESSION_TTL_SECONDS", 24 * 60 * 60);
      // Extend cookie expiry on activity
      req.session.options({maxAge: ttlSeconds});
      req.session.touch();
    }

    const {rows} = await db.query(
      `select internal_id, email, username, display_name
       from public.members
       where internal_id = $1
       limit 1`,
      [memberId]
    );

    // If member is missing (deleted), clear the session
    if (!rows[0]) {
      req.session.delete();
      req.member = null;
      return;
    }

    req.member = rows[0];
  });
});
