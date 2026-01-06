import { z } from "zod"

export const MeResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.email(),
    username: z.string(),
    displayName: z.string(),
  }),
  isSuperAdmin: z.boolean(),
  memberships: z.array(
    z.object({
      org: z.object({
        id: z.uuid(),
        slug: z.string(),
        name: z.string(),
      }),
      role: z.enum(["owner", "admin", "organiser", "member"]),
    })
  ),
  hasAddresses: z.boolean().optional(),
})

// Strongly typed export for free
export type MeResponse = z.infer<typeof MeResponseSchema>
