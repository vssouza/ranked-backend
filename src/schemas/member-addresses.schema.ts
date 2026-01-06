import { z } from "zod";

export const MemberAddressSchema = z.object({
  id: z.uuid(),
  memberId: z.uuid(),

  label: z.string().trim().min(1).max(100).nullable(),
  fullName: z.string().trim().min(1).max(200).nullable(),

  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().min(1).max(200).nullable(),
  city: z.string().trim().min(1).max(120),
  region: z.string().trim().min(1).max(120).nullable(),
  postalCode: z.string().trim().min(1).max(40).nullable(),
  country: z.string().trim().min(2).max(2),
  phone: z.string().trim().min(1).max(40).nullable(),

  isDefault: z.boolean(),

  createdAt: z.string(),
  updatedAt: z.string(),
});

export type MemberAddress = z.infer<typeof MemberAddressSchema>;

/* =========================
   Collection / list shapes
   ========================= */

export const ListMemberAddressesResponseSchema = z.object({
  items: z.array(MemberAddressSchema),
});

export type ListMemberAddressesResponse =
  z.infer<typeof ListMemberAddressesResponseSchema>;
