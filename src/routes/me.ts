// src/routes/me.ts
import type { FastifyInstance } from "fastify"
import { MeResponseSchema } from "../schemas/me.schema.js"
import { buildMePayload } from "../lib/me-payload.js"

export async function registerMeRoute(app: FastifyInstance) {
  app.get("/me", async (req, reply) => {
    // ✅ Prevent caching / 304 revalidation for auth state endpoints
    reply.header("Cache-Control", "no-store")
    reply.header("Pragma", "no-cache")
    reply.header("Vary", "Cookie")

    if (req.authExpiredReason === "ABSOLUTE_TTL") {
      return reply.code(401).send({ error: "SESSION_EXPIRED_ABSOLUTE_TTL" })
    }

    if (!req.member) {
      return reply.code(401).send({ error: "Unauthorized" })
    }

    const payload = await buildMePayload(req.member)

    return MeResponseSchema.parse(payload)
  })
}
