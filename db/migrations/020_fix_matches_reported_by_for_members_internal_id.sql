-- =========================================================
-- 020_fix_matches_reported_by_for_members_internal_id.sql
-- Change matches.reported_by from auth.users to members.internal_id
-- =========================================================

-- Drop the old FK constraint (name is unknown, so use DO block)
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
    and tc.table_name = 'matches'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'reported_by'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.matches drop constraint %I', constraint_name);
  end if;
end $$;

-- Rename column
alter table public.matches
  rename column reported_by to reported_by_member_id;

-- Add new FK
alter table public.matches
  add constraint matches_reported_by_member_fk
  foreign key (reported_by_member_id)
  references public.members(internal_id)
  on delete set null;

-- RLS posture (Option A)
alter table public.matches disable row level security;
