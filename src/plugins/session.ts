import fp from "fastify-plugin"
import cookie from "@fastify/cookie"
import secureSession from "@fastify/secure-session"

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

  /**
   * Cookie SameSite:
   * - If secure=true (HTTPS), and your frontend/backend are on different origins,
   *   you typically must use SameSite=None. Browsers require Secure when SameSite=None.
   * - If secure=false (HTTP localhost), SameSite=None would be rejected, so use Lax.
   */
  const sameSite: "lax" | "none" = secure ? "none" : "lax"

  return {
    path: "/",
    httpOnly: true as const,
    secure,
    sameSite,
    // Browser cookie lifetime (maxAge is seconds)
    maxAge: ttlSeconds,
  }
}

export default fp(async (app) => {
  const keyB64 = process.env.SESSION_KEY_BASE64
  if (!keyB64) throw new Error("Missing SESSION_KEY_BASE64")

  // TTL in seconds (default 1 day)
  const ttlSeconds = intFromEnv("SESSION_TTL_SECONDS", 24 * 60 * 60)

  await app.register(cookie)

  await app.register(secureSession, {
    key: Buffer.from(keyB64, "base64"),
    cookieName: getSessionCookieName(),

    // Session validity window (seconds)
    expiry: ttlSeconds,

    cookie: getSessionCookieOptions(ttlSeconds),
  })
})
