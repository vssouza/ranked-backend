-- =========================================================
-- 013_create_members.sql
-- Members (app profile) table + RLS
-- =========================================================

-- -----------------------------
-- Helper: current_user_id()
-- -----------------------------
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    auth.uid(),
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    nullif(current_setting('app.current_user_id', true), '')::uuid
  );
$$;


create table if not exists public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,

  username varchar(32)
    check (char_length(username) between 3 and 32)
    check (username = lower(username))
    check (username ~ '^[a-z0-9_]+$'),

  display_name varchar(64) not null
    check (char_length(trim(display_name)) between 1 and 64),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive uniqueness (and allows multiple NULL usernames)
create unique index if not exists members_username_lower_unique
on public.members (lower(username));

alter table public.members enable row level security;
alter table public.members force row level security;

-- -----------------------------
-- Policies
-- -----------------------------

drop policy if exists members_select_own on public.members;
create policy members_select_own
on public.members
for select
to authenticated
using (id = public.current_user_id());

drop policy if exists members_update_own on public.members;
create policy members_update_own
on public.members
for update
to authenticated
using (id = public.current_user_id())
with check (id = public.current_user_id());

-- -----------------------------
-- updated_at helper
-- -----------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_members_updated_at on public.members;
create trigger set_members_updated_at
before update on public.members
for each row execute procedure public.set_updated_at();

-- -----------------------------
-- Create member row on signup
-- -----------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.members (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger only if it doesn't exist (safer than dropping in auth schema)
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
  end if;
end
$$;
