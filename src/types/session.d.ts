export {}

declare module "fastify" {
  interface SessionData {
    csrfToken?: string
    memberId?: string
    sessionIssuedAt?: number
  }
}
