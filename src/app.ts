import Fastify from "fastify"
import cors from "@fastify/cors"
import { ZodError } from "zod"

import sessionPlugin from "./plugins/session.js"
import authContextPlugin from "./plugins/authContext.js"
import csrfPlugin from "./plugins/csrf.js"

import { registerAuthRoutes } from "./routes/auth.js"
import { registerMeRoute } from "./routes/me.js"
import { registerMemberAddressesRoutes } from "./routes/member-addresses.js"

function parseCorsOrigins(raw: string | undefined): string[] {
  // Example: "http://localhost:5173,https://ranked-app.onrender.com"
  const list = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  return list.length > 0 ? list : ["http://localhost:5173"]
}

export async function buildApp() {
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

  // --- CORS (must be BEFORE routes/plugins that handle requests) ---
  const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGINS)

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow non-browser requests (curl, server-to-server) that have no Origin header
      if (!origin) return cb(null, true)

      if (allowedOrigins.includes(origin)) return cb(null, true)

      // Disallow everything else
      return cb(new Error("Not allowed by CORS"), false)
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  })

  app.get("/health", async () => "ok")

  // 1) Cookies + encrypted session
  app.register(sessionPlugin)

  // 2) Load req.member from session (if present)
  app.register(authContextPlugin)

  // 3) CSRF protection for cookie auth (unsafe methods)
  app.register(csrfPlugin)

  // 4) Register routes
  app.register(async (routes) => {
    registerAuthRoutes(routes)
    registerMeRoute(routes)
    registerMemberAddressesRoutes(routes)
  })

  return app
}
