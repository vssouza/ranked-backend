import fp from "fastify-plugin";
import cookie from "@fastify/cookie";
import secureSession from "@fastify/secure-session";

export default fp(async (app) => {
  const keyB64 = process.env.SESSION_KEY_BASE64;
  if (!keyB64) throw new Error("Missing SESSION_KEY_BASE64");

  const secure = (process.env.SESSION_COOKIE_SECURE ?? "true") === "true";

  await app.register(cookie);

  await app.register(secureSession, {
    key: Buffer.from(keyB64, "base64"),
    cookieName: process.env.SESSION_COOKIE_NAME ?? "ranked_session",
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure,
    },
  });
});
