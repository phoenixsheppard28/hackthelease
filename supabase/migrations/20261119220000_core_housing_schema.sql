create extension if not exists vector with schema extensions;

create type public.crawl_state as enum ('queued', 'running', 'succeeded', 'partial', 'failed');
create type public.rent_basis as enum ('per_person', 'per_unit', 'unknown');

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  inventory_url text not null unique,
  allowed_domains text[] not null default '{}',
  listing_patterns text[] not null default '{}',
  is_enabled boolean not null default true,
  last_successful_refresh_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.crawl_runs (
  id uuid primary key default gen_random_uuid(),
  status public.crawl_state not null default 'queued',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table public.crawl_run_sources (
  id uuid primary key default gen_random_uuid(),
  crawl_run_id uuid not null references public.crawl_runs (id) on delete cascade,
  source_id uuid not null references public.sources (id) on delete cascade,
  status public.crawl_state not null default 'queued',
  firecrawl_job_id text unique,
  discovered integer not null default 0 check (discovered >= 0),
  processed integer not null default 0 check (processed >= 0),
  new_listings integer not null default 0 check (new_listings >= 0),
  updated_listings integer not null default 0 check (updated_listings >= 0),
  rent_changes integer not null default 0 check (rent_changes >= 0),
  failed_pages integer not null default 0 check (failed_pages >= 0),
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  unique (crawl_run_id, source_id)
);

create unique index crawl_run_sources_one_active_per_source
  on public.crawl_run_sources (source_id)
  where status in ('queued', 'running');

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  merge_key text not null unique,
  address text not null,
  normalized_address text not null,
  unit text,
  normalized_unit text,
  rent_min numeric(10, 2) check (rent_min >= 0),
  rent_max numeric(10, 2) check (rent_max >= 0),
  rent_basis public.rent_basis not null default 'unknown',
  recurring_fees_monthly numeric(10, 2) check (recurring_fees_monthly >= 0),
  beds integer check (beds >= 0),
  available_from date,
  accessible boolean,
  amenities jsonb not null default '{}',
  features text[] not null default '{}',
  description text,
  contact jsonb,
  sources jsonb not null check (jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) > 0),
  searchable_text text not null,
  text_hash text not null,
  embedding extensions.vector(1536),
  is_active boolean not null default true,
  is_demo boolean not null default false,
  refreshed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rent_max is null or (rent_min is not null and rent_max >= rent_min))
);

create table public.listing_observations (
  id uuid primary key default gen_random_uuid(),
  crawl_run_source_id uuid not null references public.crawl_run_sources (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  page_url text not null,
  fetched_at timestamptz not null,
  raw_extraction jsonb not null,
  normalized jsonb,
  evidence text,
  created_at timestamptz not null default now(),
  unique (crawl_run_source_id, page_url)
);

create index listing_observations_listing_id on public.listing_observations (listing_id);

alter table public.sources enable row level security;
alter table public.crawl_runs enable row level security;
alter table public.crawl_run_sources enable row level security;
alter table public.listings enable row level security;
alter table public.listing_observations enable row level security;

create function public.create_crawl_run(p_source_ids uuid[])
returns table (crawl_run_id uuid, crawl_run_source_id uuid, source_id uuid)
language plpgsql
set search_path = ''
as $$
declare
  new_run_id uuid;
begin
  if coalesce(cardinality(p_source_ids), 0) = 0 then
    raise exception 'A crawl run needs at least one source.';
  end if;

  insert into public.crawl_runs default values returning id into new_run_id;

  return query
  with created as (
    insert into public.crawl_run_sources (crawl_run_id, source_id)
    select distinct new_run_id, requested.id from unnest(p_source_ids) as requested (id)
    returning public.crawl_run_sources.crawl_run_id, public.crawl_run_sources.id, public.crawl_run_sources.source_id
  )
  select created.crawl_run_id, created.id, created.source_id from created;
end;
$$;

-- Webhook events for one source can arrive concurrently, so counts change in place.
create function public.increment_crawl_run_source_counts(
  p_crawl_run_source_id uuid,
  p_discovered integer default 0,
  p_processed integer default 0,
  p_new_listings integer default 0,
  p_updated_listings integer default 0,
  p_rent_changes integer default 0,
  p_failed_pages integer default 0
)
returns void
language sql
set search_path = ''
as $$
  update public.crawl_run_sources
  set
    discovered = discovered + p_discovered,
    processed = processed + p_processed,
    new_listings = new_listings + p_new_listings,
    updated_listings = updated_listings + p_updated_listings,
    rent_changes = rent_changes + p_rent_changes,
    failed_pages = failed_pages + p_failed_pages
  where id = p_crawl_run_source_id;
$$;

create function public.upsert_listing(p_listing jsonb, p_observation_id uuid default null)
returns table (listing_id uuid, was_inserted boolean, rent_changed boolean)
language plpgsql
set search_path = ''
as $$
declare
  incoming public.listings;
  previous public.listings;
  saved public.listings;
  had_previous boolean;
begin
  incoming := jsonb_populate_record(null::public.listings, p_listing);

  select * into previous from public.listings where merge_key = incoming.merge_key for update;
  had_previous := found;

  insert into public.listings as existing (
    merge_key, address, normalized_address, unit, normalized_unit,
    rent_min, rent_max, rent_basis, recurring_fees_monthly, beds, available_from, accessible,
    amenities, features, description, contact, sources, searchable_text, text_hash, refreshed_at
  )
  values (
    incoming.merge_key, incoming.address, incoming.normalized_address, incoming.unit, incoming.normalized_unit,
    incoming.rent_min, incoming.rent_max, incoming.rent_basis, incoming.recurring_fees_monthly,
    incoming.beds, incoming.available_from, incoming.accessible,
    incoming.amenities, incoming.features, incoming.description, incoming.contact, incoming.sources,
    incoming.searchable_text, incoming.text_hash, incoming.refreshed_at
  )
  on conflict (merge_key) do update set
    address = excluded.address,
    normalized_address = excluded.normalized_address,
    unit = excluded.unit,
    normalized_unit = excluded.normalized_unit,
    rent_min = excluded.rent_min,
    rent_max = excluded.rent_max,
    rent_basis = excluded.rent_basis,
    recurring_fees_monthly = excluded.recurring_fees_monthly,
    beds = excluded.beds,
    available_from = excluded.available_from,
    accessible = excluded.accessible,
    amenities = excluded.amenities,
    features = excluded.features,
    description = excluded.description,
    contact = excluded.contact,
    -- Keep every source page that ever reported the listing, with its latest fetch.
    sources = (
      select jsonb_agg(latest.source order by (latest.source ->> 'fetchedAt')::timestamptz desc)
      from (
        select distinct on (source ->> 'url') source
        from jsonb_array_elements(excluded.sources || existing.sources) as source
        order by source ->> 'url', (source ->> 'fetchedAt')::timestamptz desc
      ) as latest
    ),
    searchable_text = excluded.searchable_text,
    text_hash = excluded.text_hash,
    embedding = case when existing.text_hash = excluded.text_hash then existing.embedding end,
    is_active = true,
    refreshed_at = greatest(existing.refreshed_at, excluded.refreshed_at),
    updated_at = now()
  returning * into saved;

  if p_observation_id is not null then
    update public.listing_observations set listing_id = saved.id where id = p_observation_id;
  end if;

  return query select
    saved.id,
    not had_previous,
    had_previous and (previous.rent_min, previous.rent_max, previous.rent_basis)
      is distinct from (saved.rent_min, saved.rent_max, saved.rent_basis);
end;
$$;

revoke all on function public.create_crawl_run(uuid[]) from public, anon, authenticated;
revoke all on function public.increment_crawl_run_source_counts(uuid, integer, integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.upsert_listing(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_crawl_run(uuid[]) to service_role;
grant execute on function public.increment_crawl_run_source_counts(uuid, integer, integer, integer, integer, integer, integer) to service_role;
grant execute on function public.upsert_listing(jsonb, uuid) to service_role;
