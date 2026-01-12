import fp from "fastify-plugin";
import crypto from "crypto";

function isUnsafeMethod(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function newToken() {
  // Node 18+: base64url is safe for headers
  return crypto.randomBytes(32).toString("base64url");
}

export default fp(async (app) => {
  app.addHook("preHandler", async (req, reply) => {
    // Only enforce CSRF on unsafe methods
    if (!isUnsafeMethod(req.method)) return;

    // If there is no session / no logged-in user, let your route auth handle 401
    const memberId = req.session.get("memberId") as string | undefined;
    if (!memberId) return;

    // Ensure a token exists
    let csrfToken = req.session.get("csrfToken") as string | undefined;
    if (!csrfToken) {
      csrfToken = newToken();
      req.session.set("csrfToken", csrfToken);
    }

    // Validate header
    const headerToken = req.headers["x-csrf-token"];
    const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;

    if (!token || token !== csrfToken) {
      return reply.code(403).send({error: "CSRF"});
    }
  });
});
