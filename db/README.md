# RankEd DB Instructions

TODO

### 001_init.sql

extensions (uuid-ossp, citext)
core tables (organisations, org_memberships)
no RLS yet

### Feature migrations (002+)

new tables
new columns
indexes
constraints

### 005_rls.sql

enable RLS on tables
policies
helper functions (current_user_id())


### 006_admin_support.sql

ranked_admins
audit_logs
indexes
no RLS (these tables are backend-only)


001_init.sql	Core tenancy primitives
002_*	Tournament domain
003_*	Rounds & matches
004_*	Standings & ratings
005_rls.sql	Security & access control
006_admin_support.sql	Platform-level (Ranked) operations


TODO

alter table public.organisations force row level security; 
alter table public.org_memberships force row level security; 
alter table public.org_invitations force row level security;

By default in Postgres:
RLS applies to normal roles
Table owners and some privileged roles can still bypass it
When you add:

alter table public.organisations force row level security;

You’re saying:
“No one bypasses RLS on this table — ever — unless they use a role that explicitly bypasses it (like Supabase’s service role).”
This is very good for production safety, but it can slow you down during early development if you’re not ready.