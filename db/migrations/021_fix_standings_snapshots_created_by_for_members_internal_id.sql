-- =========================================================
-- 021_fix_standings_snapshots_created_by_for_members_internal_id.sql
-- Change standings_snapshots.created_by from auth.users -> members.internal_id
-- =========================================================

-- Drop old FK constraint on created_by (name unknown)
do $$
declare
  constraint_name text;
begin
  select tc.constraint_name into constraint_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'standings_snapshots'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'created_by'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.standings_snapshots drop constraint %I', constraint_name);
  end if;
end $$;

-- Rename column
alter table public.standings_snapshots
  rename column created_by to created_by_member_id;

-- Add new FK
alter table public.standings_snapshots
  add constraint standings_snapshots_created_by_member_fk
  foreign key (created_by_member_id)
  references public.members(internal_id)
  on delete set null;

-- Option A posture: backend-owned
alter table public.standings_snapshots disable row level security;
alter table public.standings_snapshot_rows disable row level security;
