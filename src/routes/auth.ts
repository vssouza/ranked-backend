import type {FastifyInstance} from "fastify";
import {z} from "zod";
import crypto from "crypto";

import {supabaseAuth} from "@/lib/supabaseAuth.js";
import {db} from "@/lib/db.js";

const ExchangeBody = z.object({
  accessToken: z.string().min(10),
});

function newCsrfToken() {
  // URL-safe, header-safe token
  return crypto.randomBytes(32).toString("base64url");
}

export async function registerAuthRoutes(app: FastifyInstance) {
  /**
   * Exchange provider token -> backend session cookie
   */
  app.post("/auth/exchange", async (req, reply) => {
    const {accessToken} = ExchangeBody.parse(req.body);

    // 1) Identify provider (SSO-ready)
    const provider = "supabase";

    // 2) Validate token with provider
    const {data, error} = await supabaseAuth.auth.getUser(accessToken);
    if (error || !data?.user) {
      return reply.code(401).send({error: "Invalid token"});
    }

    const user = data.user;

    // 3) Extract provider subject + profile
    const subject = user.id; // provider-specific stable ID
    const email = user.email ?? "";
    const displayName = "";

    // 4) Upsert member (Option A identity mapping)
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

    // 5) Create backend session
    req.session.set("memberId", member.internal_id);

    // 6) Create CSRF token for cookie-based auth
    const csrfToken = newCsrfToken();
    req.session.set("csrfToken", csrfToken);

    return reply.send({ok: true, csrfToken});
  });

  /**
   * Refresh backend session + rotate CSRF token
   * (Does NOT refresh Supabase access token — client handles that.)
   */
  app.get("/auth/refresh-session", async (req, reply) => {
    const memberId = req.session.get("memberId") as string | undefined;
    if (!memberId) return reply.code(401).send({error: "Unauthorized"});

    // authContextPlugin should have loaded req.member if memberId is valid
    if (!req.member) {
      // Session refers to a missing member row; clear it
      req.session.delete();
      return reply.code(401).send({error: "Unauthorized"});
    }

    const csrfToken = newCsrfToken();
    req.session.set("csrfToken", csrfToken);

    // Optional: return minimal data so the client can update UI if needed
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

  /**
   * Logout (clears session cookie)
   */
  app.post("/auth/logout", async (req, reply) => {
    req.session.delete();
    return reply.send({ok: true});
  });
}
