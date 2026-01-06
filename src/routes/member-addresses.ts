import type { FastifyInstance } from "fastify";
import {
  ListMemberAddressesResponseSchema,
} from "@/schemas/member-addresses.schema.js";

export async function registerMemberAddressesRoutes(app: FastifyInstance) {
  app.get("/member-addresses", async () => {
    const data = {
      items: [
        {
          id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          memberId: "9b2c0b6e-2c8e-4a2b-8b2d-5a7c2f5b0f13",

          label: "Home",
          fullName: "John Doe",

          line1: "123 Main Street",
          line2: null,
          city: "Springfield",
          region: "IL",
          postalCode: "62701",
          country: "US",
          phone: null,

          isDefault: true,

          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    return ListMemberAddressesResponseSchema.parse(data);
  });
}
