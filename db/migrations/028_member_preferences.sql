-- 2026xxxxxx_create_member_preferences.sql

create table if not exists public.member_preferences (
  member_id uuid primary key references public.members(internal_id) on delete cascade,
  active_organisation_id uuid references public.organisations(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists member_preferences_active_org_idx
  on public.member_preferences(active_organisation_id);
