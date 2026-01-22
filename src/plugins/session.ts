// src/plugins/session.ts
import fp from "fastify-plugin"
import cookie from "@fastify/cookie"
import secureSession from "@fastify/secure-session"
import { db } from "../lib/db.js"

function intFromEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function boolFromEnv(name: string, fallback: boolean) {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  return raw === "true"
}

export function getSessionCookieName() {
  return process.env.SESSION_COOKIE_NAME ?? "ranked_session"
}

export function getSessionCookieOptions(ttlSeconds: number) {
  const secure = boolFromEnv(
    "SESSION_COOKIE_SECURE",
    process.env.NODE_ENV === "production"
  )

  const sameSite: "lax" | "none" = secure ? "none" : "lax"

  return {
    path: "/",
    httpOnly: true as const,
    secure,
    sameSite,
    maxAge: ttlSeconds,
  }
}

type MemberRow = {
  internal_id: string
  email: string
  username: string | null
  display_name: string
}

const kMember = Symbol("member")
const kAuthExpiredReason = Symbol("authExpiredReason")

export default fp(async (app) => {
  const keyB64 = process.env.SESSION_KEY_BASE64
  if (!keyB64) throw new Error("Missing SESSION_KEY_BASE64")

  const ttlSeconds = intFromEnv("SESSION_TTL_SECONDS", 24 * 60 * 60)
  const absoluteTtlSeconds = intFromEnv(
    "SESSION_ABSOLUTE_TTL_SECONDS",
    ttlSeconds
  )

  await app.register(cookie)

  await app.register(secureSession, {
    key: Buffer.from(keyB64, "base64"),
    cookieName: getSessionCookieName(),
    expiry: ttlSeconds,
    cookie: getSessionCookieOptions(ttlSeconds),
  })

  // Decorate using getter/setter so we don't need a default value (avoids null/undefined typing issues)
  app.decorateRequest("member", {
    getter(this: any) {
      return this[kMember]
    },
    setter(this: any, value: any) {
      this[kMember] = value
    },
  })

  app.decorateRequest("authExpiredReason", {
    getter(this: any) {
      return this[kAuthExpiredReason]
    },
    setter(this: any, value: any) {
      this[kAuthExpiredReason] = value
    },
  })

  app.addHook("onRequest", async (req, reply) => {
    const memberId = req.session.get("memberId") as string | undefined
    if (!memberId) return

    const issuedAt = req.session.get("sessionIssuedAt") as number | undefined
    if (!issuedAt) {
      req.authExpiredReason = "MISSING_ISSUED_AT"
      req.session.delete()
      reply.clearCookie(getSessionCookieName(), getSessionCookieOptions(ttlSeconds))
      return
    }

    const ageMs = Date.now() - issuedAt
    if (ageMs > absoluteTtlSeconds * 1000) {
      req.authExpiredReason = "ABSOLUTE_TTL"
      req.session.delete()
      reply.clearCookie(getSessionCookieName(), getSessionCookieOptions(ttlSeconds))
      return
    }

    const { rows } = await db.query<MemberRow>(
      `
      select internal_id, email, username, display_name
      from public.members
      where internal_id = $1
      limit 1
      `,
      [memberId]
    )

    const member = rows[0]
    if (!member) {
      req.authExpiredReason = "MISSING_MEMBER"
      req.session.delete()
      reply.clearCookie(getSessionCookieName(), getSessionCookieOptions(ttlSeconds))
      return
    }

    req.member = member
  })
})
