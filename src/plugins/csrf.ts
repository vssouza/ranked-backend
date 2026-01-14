import fp from "fastify-plugin"
import crypto from "crypto"

function isUnsafeMethod(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())
}

function newToken() {
  return crypto.randomBytes(32).toString("base64url")
}

function getPath(url: string) {
  // strip querystring
  const q = url.indexOf("?")
  return q === -1 ? url : url.slice(0, q)
}

function isCsrfExempt(path: string) {
  // Exempt auth bootstrap endpoints (no session yet / session being created)
  return (
    path === "/auth/register" ||
    path === "/auth/login" ||
    path === "/auth/exchange" ||
    path === "/auth/logout" // optional: keeps logout simple
  )
}

export default fp(async (app) => {
  app.addHook("preHandler", async (req, reply) => {
    const path = getPath(req.url)

    // Skip CSRF for safe methods or exempt paths
    if (!isUnsafeMethod(req.method)) return
    if (isCsrfExempt(path)) return

    // If there is no session / no logged-in user, let route auth handle 401
    const memberId = req.session.get("memberId") as string | undefined
    if (!memberId) return

    // Ensure a token exists
    let csrfToken = req.session.get("csrfToken") as string | undefined
    if (!csrfToken) {
      csrfToken = newToken()
      req.session.set("csrfToken", csrfToken)
    }

    // Validate header
    const headerToken = req.headers["x-csrf-token"]
    const token = Array.isArray(headerToken) ? headerToken[0] : headerToken

    if (!token || token !== csrfToken) {
      return reply.code(403).send({ error: "CSRF" })
    }
  })
})
