import type { FastifyInstance } from "fastify";
import { z } from "zod";
import crypto from "crypto";

import { supabaseAuth } from "../lib/supabaseAuth.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { db } from "../lib/db.js";

const ExchangeBody = z.object({
  accessToken: z.string().min(10),
});

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username may only contain letters, numbers, underscore."
    ),
  displayName: z.string().min(2).max(64),
});

function newCsrfToken() {
  // URL-safe, header-safe token
  return crypto.randomBytes(32).toString("base64url");
}

type MemberRow = {
  internal_id: string;
  email: string;
  username: string | null;
  display_name: string;
};

export async function registerAuthRoutes(app: FastifyInstance) {
  /**
   * Register (backend-owned signup)
   * Client sends email/password/username/displayName.
   * Backend creates auth identity (Supabase admin) + member row + session cookie.
   */
  app.post("/auth/register", async (req, reply) => {
  const { email, password, username, displayName } = RegisterBody.parse(req.body)

  // 1) Create user in Supabase (admin)
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: displayName },
  })

  if (error || !data?.user) {
    req.log.warn({ error }, "supabase createUser failed")
    return reply.code(400).send({
      error: "REGISTER_FAILED",
      message: error?.message ?? "Supabase createUser failed",
    })
  }

  const provider = "supabase"
  const subject = data.user.id

  // 2) Create member row
  try {
    const { rows } = await db.query<MemberRow>(
      `
      insert into public.members (
        auth_provider,
        auth_subject,
        supabase_user_id,
        email,
        username,
        display_name
      )
      values ($1, $2, $3::uuid, $4, $5, $6)
      on conflict (auth_provider, auth_subject)
      do update set
        email = excluded.email,
        username = excluded.username,
        display_name = excluded.display_name
      returning internal_id, email, username, display_name
      `,
      [provider, subject, subject, email, username, displayName]
    )

    const member = rows[0]
    if (!member) {
      req.log.error("member upsert returned no rows")
      return reply.code(500).send({ error: "REGISTER_FAILED" })
    }

    // 3) Session + CSRF
    req.session.set("memberId", member.internal_id)
    req.session.set("sessionIssuedAt", Date.now())
    const csrfToken = newCsrfToken()
    req.session.set("csrfToken", csrfToken)

    return reply.send({ ok: true, csrfToken })
  } catch (err: unknown) {
    // If member insert fails after supabase user was created, log it clearly.
    req.log.error({ err }, "member insert failed after supabase user creation")

    return reply.code(400).send({
      error: "REGISTER_FAILED",
      message: err instanceof Error ? err.message : "DB insert failed",
    })
  }
})


  /**
   * Exchange provider token -> backend session cookie
   * (Useful if you ever do provider login on the client side; safe to keep.)
   */
  app.post("/auth/exchange", async (req, reply) => {
    const { accessToken } = ExchangeBody.parse(req.body);

    const provider = "supabase";

    const { data, error } = await supabaseAuth.auth.getUser(accessToken);
    if (error || !data?.user) {
      return reply.code(401).send({ error: "Invalid token" });
    }

    const user = data.user;
    const subject = user.id;
    const email = user.email ?? "";
    const displayName = "";

    const { rows } = await db.query<MemberRow>(
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
    if (!member) return reply.code(500).send({ error: "EXCHANGE_FAILED" });

    req.session.set("memberId", member.internal_id);
    req.session.set("sessionIssuedAt", Date.now());

    const csrfToken = newCsrfToken();
    req.session.set("csrfToken", csrfToken);

    return reply.send({ ok: true, csrfToken });
  });

  /**
   * Refresh backend session + rotate CSRF token
   */
  app.get("/auth/refresh-session", async (req, reply) => {
    // If authContext cleared the session due to absolute TTL, signal that explicitly
    if (req.authExpiredReason === "ABSOLUTE_TTL") {
      return reply.code(401).send({ error: "SESSION_EXPIRED_ABSOLUTE_TTL" });
    }

    const memberId = req.session.get("memberId");
    if (!memberId) return reply.code(401).send({ error: "Unauthorized" });

    if (!req.member) {
      // Could be missing member row or missing issuedAt; treat as generic unauthorized
      req.session.delete();
      return reply.code(401).send({ error: "Unauthorized" });
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
    return reply.send({ ok: true });
  });
}
