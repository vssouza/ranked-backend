-- =========================================================
-- 008_protect_org_approval_fields.sql
-- Prevent client-side updates to org approval fields
-- Allows only privileged/backend updates.
-- =========================================================

create or replace function public.is_platform_privileged()
returns boolean
language sql
stable
as $$
  select
    -- Supabase service role (available as JWT claim in Supabase contexts)
    coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role'
    -- Optional escape hatch for tests / non-supabase backends
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
     or (new.reviewed_by is distinct from old.reviewed_by)
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
