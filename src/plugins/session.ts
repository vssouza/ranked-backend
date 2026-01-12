import fp from "fastify-plugin";
import cookie from "@fastify/cookie";
import secureSession from "@fastify/secure-session";

function intFromEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export default fp(async (app) => {
  const keyB64 = process.env.SESSION_KEY_BASE64;
  if (!keyB64) throw new Error("Missing SESSION_KEY_BASE64");

  const secure = (process.env.SESSION_COOKIE_SECURE ?? "true") === "true";

  // TTL in seconds (e.g. 14 days)
  const ttlSeconds = intFromEnv("SESSION_TTL_SECONDS", 24 * 60 * 60);

  await app.register(cookie);

  await app.register(secureSession, {
    key: Buffer.from(keyB64, "base64"),
    cookieName: process.env.SESSION_COOKIE_NAME ?? "ranked_session",

    // Session validity window (checked using data inside the session cookie)
    // Default is 1 day; set it explicitly so sessions don't last forever. :contentReference[oaicite:3]{index=3}
    expiry: ttlSeconds,

    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure,

      // Browser cookie lifetime (separate from `expiry`). maxAge is seconds here. :contentReference[oaicite:4]{index=4}
      maxAge: ttlSeconds,
    },
  });
});
