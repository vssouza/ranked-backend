export {}

declare module "@fastify/secure-session" {
  interface SessionData {
    memberId?: string
    csrfToken?: string
    sessionIssuedAt?: number
  }
}
