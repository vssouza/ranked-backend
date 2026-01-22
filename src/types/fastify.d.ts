import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    org: { id: string; slug: string; name: string } | null;
    orgRole: "owner" | "admin" | "organiser" | "member" | null;
  }
}
