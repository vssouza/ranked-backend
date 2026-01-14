-- =========================================================
-- 023_fix_protect_org_approval_fields.sql
-- Option A: Protect org approval fields (status, reviewed_by_member_id,
-- reviewed_at, review_note) from non-privileged updates.
--
-- Notes:
-- - Uses is_platform_privileged() which checks service_role OR app.platform_admin flag.
-- - Designed to work with the Option A column name: reviewed_by_member_id.
-- =========================================================

create or replace function public.is_platform_privileged()
returns boolean
language sql
stable
as $$
  select
    coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role'
    or coalesce(current_setting('app.platform_admin', true), '') = 'true';
$$;

create or replace function public.block_org_approval_field_updates()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if (new.status is distinct from old.status)
     or (new.reviewed_by_member_id is distinct from old.reviewed_by_member_id)
     or (new.reviewed_at is distinct from old.reviewed_at)
     or (new.review_note is distinct from old.review_note)
  then
    if not public.is_platform_privileged() then
      raise exception 'Not allowed to modify organisation approval fields';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_block_org_approval_field_updates on public.organisations;

create trigger trg_block_org_approval_field_updates
before update on public.organisations
for each row
execute function public.block_org_approval_field_updates();

----------------------------------------------------------
-- If you use the Supabase service role key from ranked-backend, 
--it will pass the service_role check automatically in many Supabase 
-- contexts. If you’re connecting to Postgres directly 
-- (not via Supabase API), you can set:

-- select set_config('app.platform_admin', 'true', true);

-- for privileged maintenance operations, and omit it for normal requests.
----------------------------------------------------------