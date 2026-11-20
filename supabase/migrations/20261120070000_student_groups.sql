alter table public.housing_profiles
  add column owner_id uuid references auth.users(id);

create index housing_profiles_owner_id_idx on public.housing_profiles(owner_id);

create table public.housing_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.housing_group_members (
  group_id uuid not null references public.housing_groups(id) on delete cascade,
  user_id uuid not null unique references auth.users(id),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.housing_group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.housing_groups(id) on delete cascade,
  email text not null check (email = lower(trim(email))),
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (group_id, email)
);

create index housing_group_invites_email_idx on public.housing_group_invites(email);

create table public.housing_group_saves (
  group_id uuid not null references public.housing_groups(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  saved_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (group_id, listing_id)
);

alter table public.housing_groups enable row level security;
alter table public.housing_group_members enable row level security;
alter table public.housing_group_invites enable row level security;
alter table public.housing_group_saves enable row level security;

grant select, insert, update, delete on public.housing_groups to service_role;
grant select, insert, update, delete on public.housing_group_members to service_role;
grant select, insert, update, delete on public.housing_group_invites to service_role;
grant select, insert, update, delete on public.housing_group_saves to service_role;
