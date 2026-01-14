if (process.env.NODE_ENV !== "production") {
  await import("dotenv/config")
}

// validate after dotenv has loaded (dev) or directly (prod)
await import("./env.js")

// only now import the rest of the app (safe)
const { buildApp } = await import("./app.js")

const app = buildApp()

const port = Number(process.env.PORT) || 3000
await app.listen({ port, host: "0.0.0.0" })
