import "fastify"

export type Member = {
  internal_id: string
  email: string
  username: string | null
  display_name: string
}

export type AuthExpiredReason =
  | "ABSOLUTE_TTL"
  | "MISSING_ISSUED_AT"
  | "MISSING_MEMBER"

declare module "fastify" {
  interface FastifyRequest {
    member?: Member
    authExpiredReason?: AuthExpiredReason
  }
}
