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

SESSION_COOKIE_SECURE=true (on Render)