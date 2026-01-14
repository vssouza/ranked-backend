import fp from "fastify-plugin";
import { db } from "../lib/db.js";

declare module "fastify" {
  interface FastifyRequest {
    member: null | {
      internal_id: string;
      email: string;
      username: string | null;
      display_name: string;
    };
    // request-scoped reason (not stored in session)
    authExpiredReason?: "ABSOLUTE_TTL" | "MISSING_ISSUED_AT" | "MISSING_MEMBER";
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
  app.decorateRequest("authExpiredReason", undefined);

  app.addHook("preHandler", async (req) => {
    const memberId = req.session.get("memberId") as string | undefined;
    if (!memberId) return;

    /**
     * Absolute max session age ("true logout")
     * If enabled, this caps session lifetime even if the user is active.
     */
    const absoluteTtlSeconds = intFromEnv("SESSION_ABSOLUTE_TTL_SECONDS", 0);
    if (absoluteTtlSeconds > 0) {
      const issuedAt = req.session.get("sessionIssuedAt") as number | undefined;

      // If missing, force re-login (safer than guessing)
      if (!issuedAt) {
        req.session.delete();
        req.member = null;
        req.authExpiredReason = "MISSING_ISSUED_AT";
        return;
      }

      const ageMs = Date.now() - issuedAt;
      if (ageMs > absoluteTtlSeconds * 1000) {
        req.session.delete();
        req.member = null;
        req.authExpiredReason = "ABSOLUTE_TTL";
        return;
      }
    }

    /**
     * Rolling idle timeout (sliding expiration)
     */
    const rolling = (process.env.SESSION_ROLLING ?? "true") === "true";
    if (rolling) {
      const ttlSeconds = intFromEnv("SESSION_TTL_SECONDS", 24 * 60 * 60);
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
      req.authExpiredReason = "MISSING_MEMBER";
      return;
    }

    req.member = rows[0];
  });
});
