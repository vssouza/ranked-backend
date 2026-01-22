// src/plugins/authContext.ts
import fp from "fastify-plugin"
import { db } from "../lib/db.js"
import { getSessionCookieName, getSessionCookieOptions } from "./session.js"

type Member = {
  internal_id: string
  email: string
  username: string | null
  display_name: string
}

const kMember = Symbol("member")
const kAuthExpiredReason = Symbol("authExpiredReason")

function intFromEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

export default fp(
  async (app) => {
    // ✅ Make decorators idempotent (prevents "already been added" in dev / double-register scenarios)
    if (!app.hasRequestDecorator("member")) {
      // Decorate using getter/setter so we don't need null defaults
      app.decorateRequest("member", {
        getter(this: any) {
          return this[kMember]
        },
        setter(this: any, value: any) {
          this[kMember] = value
        },
      })
    }

    if (!app.hasRequestDecorator("authExpiredReason")) {
      app.decorateRequest("authExpiredReason", {
        getter(this: any) {
          return this[kAuthExpiredReason]
        },
        setter(this: any, value: any) {
          this[kAuthExpiredReason] = value
        },
      })
    }

    const ttlSeconds = intFromEnv("SESSION_TTL_SECONDS", 24 * 60 * 60)
    const absoluteTtlSeconds = intFromEnv(
      "SESSION_ABSOLUTE_TTL_SECONDS",
      ttlSeconds
    )

    app.addHook("onRequest", async (req, reply) => {
      const memberId = req.session.get("memberId") as string | undefined
      if (!memberId) return

      const issuedAt = req.session.get("sessionIssuedAt") as number | undefined
      if (!issuedAt) {
        req.authExpiredReason = "MISSING_ISSUED_AT"
        req.session.delete()
        reply.clearCookie(
          getSessionCookieName(),
          getSessionCookieOptions(ttlSeconds)
        )
        return
      }

      const ageMs = Date.now() - issuedAt
      if (ageMs > absoluteTtlSeconds * 1000) {
        req.authExpiredReason = "ABSOLUTE_TTL"
        req.session.delete()
        reply.clearCookie(
          getSessionCookieName(),
          getSessionCookieOptions(ttlSeconds)
        )
        return
      }

      const { rows } = await db.query<Member>(
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
        reply.clearCookie(
          getSessionCookieName(),
          getSessionCookieOptions(ttlSeconds)
        )
        return
      }

      req.member = member
    })
  },
  // ✅ Give the plugin a stable name to help Fastify identify it consistently
  { name: "auth-context" }
)
