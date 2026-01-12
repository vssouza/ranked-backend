import type {FastifyInstance} from "fastify";
import {z} from "zod";
import crypto from "crypto";

import {supabaseAuth} from "@/lib/supabaseAuth.js";
import {db} from "@/lib/db.js";

const ExchangeBody = z.object({
  accessToken: z.string().min(10),
});

function newCsrfToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/exchange", async (req, reply) => {
    const {accessToken} = ExchangeBody.parse(req.body);

    const provider = "supabase";

    const {data, error} = await supabaseAuth.auth.getUser(accessToken);
    if (error || !data?.user) {
      return reply.code(401).send({error: "Invalid token"});
    }

    const user = data.user;
    const subject = user.id;
    const email = user.email ?? "";
    const displayName = "";

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

    req.session.set("memberId", member.internal_id);
    req.session.set("sessionIssuedAt", Date.now());

    const csrfToken = newCsrfToken();
    req.session.set("csrfToken", csrfToken);

    return reply.send({ok: true, csrfToken});
  });

  /**
   * Refresh backend session + rotate CSRF token
   */
  app.get("/auth/refresh-session", async (req, reply) => {
    // If authContext cleared the session due to absolute TTL, signal that explicitly
    if (req.authExpiredReason === "ABSOLUTE_TTL") {
      return reply.code(401).send({error: "SESSION_EXPIRED_ABSOLUTE_TTL"});
    }

    const memberId = req.session.get("memberId") as string | undefined;
    if (!memberId) return reply.code(401).send({error: "Unauthorized"});

    if (!req.member) {
      // Could be missing member row or missing issuedAt; treat as generic unauthorized
      req.session.delete();
      return reply.code(401).send({error: "Unauthorized"});
    }

    const csrfToken = newCsrfToken();
    req.session.set("csrfToken", csrfToken);

    return reply.send({
      ok: true,
      csrfToken,
      user: {
        id: req.member.internal_id,
        email: req.member.email,
        username: req.member.username ?? "",
        displayName: req.member.display_name ?? "",
      },
    });
  });

  app.post("/auth/logout", async (req, reply) => {
    req.session.delete();
    return reply.send({ok: true});
  });
}
