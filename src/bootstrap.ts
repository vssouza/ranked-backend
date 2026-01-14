// Load .env only in development
if (process.env.NODE_ENV !== "production") {
  await import("dotenv/config")
}

// Validate and freeze environment variables
// (this should throw immediately if something is missing)
await import("./env.js")

// Import app builder AFTER env is ready
const { buildApp } = await import("./app.js")

// buildApp is async now (because of await app.register(cors))
const app = await buildApp()

const port = Number(process.env.PORT) || 3000

await app.listen({
  port,
  host: "0.0.0.0", // required for Docker/Render
})

app.log.info(`Backend listening on port ${port}`)
