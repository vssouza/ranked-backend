import { buildApp } from "./app.js"

const app = await buildApp()

const port = Number(process.env.PORT) || 3000
const host = process.env.HOST ?? "0.0.0.0"

try {
  await app.ready()
  await app.listen({ port, host })
  app.log.info(`Server listening on http://${host}:${port}`)
} catch (err: unknown) {
  app.log.error(err)
  process.exit(1)
}
