// src/routes/auth.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import crypto from "crypto"

import { supabaseAuth } from "../lib/supabaseAuth.js"
import { supabaseAdmin } from "../lib/supabaseAdmin.js"
import { db } from "../lib/db.js"
import { exists } from "../lib/db-helpers.js"
import {
  getSessionCookieName,
  getSessionCookieOptions,
} from "../plugins/session.js"

const ExchangeBodySchema = z.object({
  accessToken: z.string().min(10),
})

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const RegisterBodySchema = z.object({
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
})

function newCsrfToken() {
  return crypto.randomBytes(32).toString("base64url")
}

type MemberRow = {
  internal_id: string
  email: string
  username: string | null
  display_name: string
}

type MembershipRow = {
  organisation_id: string
  roles: string[] | null
  slug: string
  name: string
}

function pickRole(
  roles: string[] | null | undefined
): "owner" | "admin" | "organiser" | "member" {
  const set = new Set((roles ?? []).map((r) => String(r).toUpperCase()))
  if (set.has("OWNER")) return "owner"
  if (set.has("ADMIN")) return "admin"
  if (set.has("ORGANISER") || set.has("ORGANIZER")) return "organiser"
  return "member"
}

async function buildMeLikePayload(member: MemberRow) {
  const memberId = member.internal_id

  const [isSuperAdmin, memberships, hasAddresses] = await Promise.all([
    exists(
      db,
      `select 1 from public.ranked_admins where member_id = $1 limit 1`,
      [memberId]
    ),
    db.query<MembershipRow>(
      `
      select
        m.organisation_id,
        m.roles,
        o.slug,
        o.name
      from public.org_memberships m
      join public.organisations o
        on o.id = m.organisation_id
      where m.member_id = $1
        and m.status = 'ACTIVE'
      order by o.name asc
      `,
      [memberId]
    ),
    exists(
      db,
      `select 1 from public.member_addresses where member_id = $1 limit 1`,
      [memberId]
    ),
  ])

  return {
    user: {
      id: memberId,
      email: member.email,
      username: member.username ?? "",
      displayName: member.display_name ?? "",
    },
    isSuperAdmin,
    memberships: memberships.rows.map((r) => ({
      org: {
        id: r.organisation_id,
        slug: r.slug,
        name: r.name,
      },
      role: pickRole(r.roles),
    })),
    hasAddresses,
  }
}

function intFromEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function isPgUniqueViolation(err: unknown) {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  )
}

function pgConstraint(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null
  if (!("constraint" in err)) return null
  const c = (err as { constraint?: unknown }).constraint
  return typeof c === "string" ? c : null
}

function errorIncludes(msg: string | undefined, needle: string) {
  return (msg ?? "").toLowerCase().includes(needle.toLowerCase())
}

type RegisterBody = z.infer<typeof RegisterBodySchema>
type ExchangeBody = z.infer<typeof ExchangeBodySchema>
type LoginBody = z.infer<typeof LoginBodySchema>

type RegisterRequest = FastifyRequest<{ Body: RegisterBody }>
type ExchangeRequest = FastifyRequest<{ Body: ExchangeBody }>
type LoginRequest = FastifyRequest<{ Body: LoginBody }>

export async function registerAuthRoutes(app: FastifyInstance) {
  /**
   * Register (backend-owned signup)
   */
  app.post(
    "/auth/register",
    async (req: RegisterRequest, reply: FastifyReply) => {
      const { email, password, username, displayName } =
        RegisterBodySchema.parse(req.body)

      // 0) Fail fast on username
      const usernameTaken = await db.query(
        `select 1 from public.members where username = $1 limit 1`,
        [username]
      )
      if ((usernameTaken.rowCount ?? 0) > 0) {
        return reply.code(400).send({ error: "USERNAME_IN_USE" })
      }

      // Optional: fail fast on email in members table
      const emailTaken = await db.query(
        `select 1 from public.members where email = $1 limit 1`,
        [email]
      )
      if ((emailTaken.rowCount ?? 0) > 0) {
        return reply.code(400).send({ error: "EMAIL_IN_USE" })
      }

      // 1) Create user in Supabase (admin)
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, display_name: displayName },
      })

      if (error || !data?.user) {
        req.log.warn({ error }, "supabase createUser failed")

        // Common case: email already exists in Supabase
        if (
          errorIncludes(error?.message, "already") ||
          errorIncludes(error?.message, "exists")
        ) {
          return reply.code(400).send({ error: "EMAIL_IN_USE" })
        }

        return reply.code(400).send({
          error: "REGISTER_FAILED",
          message: error?.message ?? "Supabase createUser failed",
        })
      }

      const provider = "supabase"
      const subject = data.user.id

      // 2) Create member row (compensating rollback on failure)
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
        if (!member) throw new Error("member upsert returned no rows")

        // 3) Session + CSRF
        req.session.set("memberId", member.internal_id)
        req.session.set("sessionIssuedAt", Date.now())

        const csrfToken = newCsrfToken()
        req.session.set("csrfToken", csrfToken)

        // ✅ Return core shape immediately (no extra /me call)
        const payload = await buildMeLikePayload(member)
        return reply.send({ ...payload, ok: true, csrfToken })
      } catch (err: unknown) {
        req.log.error(
          { err, subject },
          "member insert failed; rolling back supabase user"
        )

        // Best-effort rollback: delete auth user we just created
        const del = await supabaseAdmin.auth.admin.deleteUser(subject)
        if (del.error) {
          req.log.error(
            { err: del.error, subject },
            "failed to rollback supabase user after db failure"
          )
        }

        // Map common DB conflicts nicely
        if (isPgUniqueViolation(err)) {
          const c = pgConstraint(err) ?? ""
          if (c.includes("username"))
            return reply.code(400).send({ error: "USERNAME_IN_USE" })
          if (c.includes("email"))
            return reply.code(400).send({ error: "EMAIL_IN_USE" })
          return reply.code(400).send({ error: "CONFLICT" })
        }

        return reply.code(400).send({
          error: "REGISTER_FAILED",
          message: err instanceof Error ? err.message : "DB insert failed",
        })
      }
    }
  )

  /**
   * Login (backend-owned sign-in)
   *
   * Client posts email/password to backend.
   * Backend authenticates with provider (currently Supabase) and creates cookie session.
   */
  app.post("/auth/login", async (req: LoginRequest, reply: FastifyReply) => {
    const { email, password } = LoginBodySchema.parse(req.body)

    // Provider authentication stays backend-side
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data?.user) {
      return reply.code(401).send({
        error: "INVALID_CREDENTIALS",
        message: error?.message ?? "Invalid email or password",
      })
    }

    const user = data.user
    const provider = "supabase"
    const subject = user.id

    // Upsert member (same as exchange)
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
      [provider, subject, subject, email, ""]
    )

    const member = rows[0]
    if (!member) return reply.code(500).send({ error: "LOGIN_FAILED" })

    // Session + CSRF
    req.session.set("memberId", member.internal_id)
    req.session.set("sessionIssuedAt", Date.now())

    const csrfToken = newCsrfToken()
    req.session.set("csrfToken", csrfToken)

    // ✅ Return core shape immediately (no extra /me call)
    const payload = await buildMeLikePayload(member)
    return reply.send({ ...payload, ok: true, csrfToken })
  })

  /**
   * Exchange provider token -> backend session cookie
   *
   * Still supported for SSO flows, but the client can remain vendor-agnostic
   * by using /auth/login instead of calling the provider directly.
   */
  app.post(
    "/auth/exchange",
    async (req: ExchangeRequest, reply: FastifyReply) => {
      const { accessToken } = ExchangeBodySchema.parse(req.body)

      const provider = "supabase"

      const { data, error } = await supabaseAuth.auth.getUser(accessToken)
      if (error || !data?.user) {
        return reply.code(401).send({ error: "Invalid token" })
      }

      const user = data.user
      const subject = user.id
      const email = user.email ?? ""
      const displayName = ""

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
      )

      const member = rows[0]
      if (!member) return reply.code(500).send({ error: "EXCHANGE_FAILED" })

      req.session.set("memberId", member.internal_id)
      req.session.set("sessionIssuedAt", Date.now())

      const csrfToken = newCsrfToken()
      req.session.set("csrfToken", csrfToken)

      // ✅ Return core shape immediately (no extra /me call)
      const payload = await buildMeLikePayload(member)
      return reply.send({ ...payload, ok: true, csrfToken })
    }
  )

  /**
   * Refresh backend session + rotate CSRF token
   * Returns SAME core shape as /me, plus csrfToken.
   */
  app.get("/auth/refresh-session", async (req, reply) => {
    if (req.authExpiredReason === "ABSOLUTE_TTL") {
      return reply.code(401).send({ error: "SESSION_EXPIRED_ABSOLUTE_TTL" })
    }

    const memberId = req.session.get("memberId") as string | undefined
    if (!memberId) return reply.code(401).send({ error: "Unauthorized" })

    if (!req.member) {
      req.session.delete()
      const ttlSeconds = intFromEnv("SESSION_TTL_SECONDS", 24 * 60 * 60)
      reply.clearCookie(
        getSessionCookieName(),
        getSessionCookieOptions(ttlSeconds)
      )
      return reply.code(401).send({ error: "Unauthorized" })
    }

    const csrfToken = newCsrfToken()
    req.session.set("csrfToken", csrfToken)

    // ✅ Same core shape as /me
    const payload = await buildMeLikePayload(req.member as MemberRow)
    return reply.send({ ...payload, ok: true, csrfToken })
  })

  /**
   * Logout: delete session + clear cookie explicitly
   */
  app.post("/auth/logout", async (req, reply) => {
    req.session.delete()

    const ttlSeconds = intFromEnv("SESSION_TTL_SECONDS", 24 * 60 * 60)
    reply.clearCookie(
      getSessionCookieName(),
      getSessionCookieOptions(ttlSeconds)
    )

    return reply.send({ ok: true })
  })
}
