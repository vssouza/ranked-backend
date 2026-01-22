import { z } from "zod"

export const OrgRefSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
})

export const MembershipSchema = z.object({
  org: OrgRefSchema,
  role: z.enum(["owner", "admin", "organiser", "member"]),
})

export const MeResponseSchema = z.object({
  ok: z.literal(true),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    username: z.string(),
    displayName: z.string(),
  }),

  isSuperAdmin: z.boolean(),

  memberships: z.array(MembershipSchema),

  hasAddresses: z.boolean(),

  // ✅ NEW: server-persisted active org (nullable)
  activeOrganisationId: z.string().uuid().nullable(),
})

// Strongly typed export for free
export type MeResponse = z.infer<typeof MeResponseSchema>
