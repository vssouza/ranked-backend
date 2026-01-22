import { buildApp } from "./app.js"

const app = await buildApp()

const port = Number(process.env.PORT) || 3000

const isProd = process.env.NODE_ENV === "production"

// Bind host:
// - dev: localhost (avoid localhost vs 127.0.0.1 cookie issues)
// - prod/container: 0.0.0.0 (standard)
const host = process.env.HOST ?? (isProd ? "0.0.0.0" : "localhost")

try {
  await app.ready()
  await app.listen({ port, host })

  // Log a user-friendly URL
  const displayHost = host === "0.0.0.0" ? "localhost" : host
  app.log.info(`Server listening on http://${displayHost}:${port}`)
} catch (err: unknown) {
  app.log.error(err)
  process.exit(1)
}
