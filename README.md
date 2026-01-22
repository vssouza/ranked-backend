Db migration 15 - 20

npm i @fastify/cookie @fastify/secure-session @supabase/supabase-js pg zod

node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

Env vars to add (if you haven’t already)

SESSION_TTL_SECONDS=1209600 (14 days, example)

SESSION_ROLLING=true

4) Add env vars (Render + local)

You need:

SUPABASE_URL

SUPABASE_ANON_KEY

DATABASE_URL

SESSION_KEY_BASE64

SESSION_ABSOLUTE_TTL_SECONDS=2592000

SESSION_COOKIE_SECURE=true (on Render)

NODE_ENV=development | production

APP_BASE_URL=https://api.yourdomain.com

SESSION_COOKIE_DOMAIN=.rankedapp.gg

LOG_LEVEL=debug | info | warn | error


Now any route that needs org context can do:

app.get("/something", { preHandler: requireOrg }, async (req, reply) => {
  // req.org is guaranteed
})


Example: org-scoped route usage

import type { FastifyInstance } from "fastify"
import { requireOrg } from "../lib/requireOrg.js"
import { db } from "../lib/db.js"

export async function registerOrgDemoRoutes(app: FastifyInstance) {
  app.get("/org-demo", { preHandler: requireOrg }, async (req) => {
    const orgId = req.org!.id

    const { rows } = await db.query(
      `select $1::uuid as org_id, $2::text as org_name`,
      [orgId, req.org!.name]
    )

    return { ok: true, org: req.org, role: req.orgRole, debug: rows[0] }
  })
}
