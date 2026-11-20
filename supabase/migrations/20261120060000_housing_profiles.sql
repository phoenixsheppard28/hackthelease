create table if not exists public.housing_profiles (
  id uuid primary key,
  profile jsonb not null check (jsonb_typeof(profile) = 'object' and profile ? 'name'),
  created_at timestamptz not null default now()
);
alter table public.housing_profiles enable row level security;
grant select, insert, update on public.housing_profiles to service_role;
