export function sessionCookieName(): string {
  // If you didn’t set a name, secure-session defaults to "session"
  return process.env.SESSION_COOKIE_NAME ?? "session"
}

function boolFromEnv(name: string, fallback: boolean) {
  const v = process.env[name]
  if (v === undefined) return fallback
  return v === "true"
}

export function sessionCookieOptions() {
  const secure = boolFromEnv(
    "SESSION_COOKIE_SECURE",
    process.env.NODE_ENV === "production"
  )

  // For cross-site (different frontend/backend domains) you typically need:
  // secure=true + sameSite="none"
  // For localhost/http you need secure=false and sameSite can be "lax"
  const sameSite = secure ? "none" : "lax"

  return {
    path: "/",
    httpOnly: true as const,
    secure,
    sameSite: sameSite as "lax" | "none",
  }
}
