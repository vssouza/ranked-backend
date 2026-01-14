import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  DATABASE_URL: z.string().url(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),

  SESSION_TTL_SECONDS: z.coerce.number().positive(),
  SESSION_ABSOLUTE_TTL_SECONDS: z.coerce.number().positive(),
  SESSION_ROLLING: z.coerce.boolean(),
  SESSION_COOKIE_SECURE: z.coerce.boolean(),
  SESSION_KEY_BASE64: z.string().min(40),
})

export const env = envSchema.parse(process.env)
