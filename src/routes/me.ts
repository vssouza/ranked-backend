import type { FastifyInstance } from "fastify"
import { MeResponseSchema } from "@/schemas/me.schema.js"

export async function registerMeRoute(app: FastifyInstance) {
  app.get("/me", async () => {
    const data = {
      user: {
        id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        email: "user@example.com",
        username: "user",
        displayName: "User",
      },
      isSuperAdmin: false,
      memberships: [],
      hasAddresses: true,
    }

    return MeResponseSchema.parse(data)
  })
}
