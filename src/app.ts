import Fastify from "fastify"
import { ZodError } from "zod"

import sessionPlugin from "./plugins/session.js"
import authContextPlugin from "./plugins/authContext.js"
import csrfPlugin from "./plugins/csrf.js"

import { registerAuthRoutes } from "./routes/auth.js"
import { registerMeRoute } from "./routes/me.js"
import { registerMemberAddressesRoutes } from "./routes/member-addresses.js"

export function buildApp() {
  const app = Fastify({ logger: true })

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        issues: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      })
    }
    return reply.send(error)
  })

  app.get("/health", async () => "ok")

  app.register(sessionPlugin)
  app.register(authContextPlugin)
  app.register(csrfPlugin)

  app.register(async (routes) => {
    registerAuthRoutes(routes)
    registerMeRoute(routes)
    registerMemberAddressesRoutes(routes)
  })

  return app
}
