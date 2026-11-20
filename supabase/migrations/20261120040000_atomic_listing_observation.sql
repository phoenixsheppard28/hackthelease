-- Upserts the listing for an observation and counts it in one transaction.
-- The row lock on the observation makes concurrent redeliveries wait, and the
-- listing_id check makes every delivery after the first one return no row.
create function public.record_observed_listing(
  p_listing jsonb,
  p_observation_id uuid,
  p_crawl_run_source_id uuid
)
returns table (listing_id uuid, was_inserted boolean, rent_changed boolean)
language plpgsql
set search_path = ''
as $$
declare
  saved record;
begin
  perform 1
  from public.listing_observations as observation
  where observation.id = p_observation_id
    and observation.crawl_run_source_id = p_crawl_run_source_id
    and observation.listing_id is null
  for update;
  if not found then
    return;
  end if;

  select * into saved from public.upsert_listing(p_listing, p_observation_id);

  perform public.increment_crawl_run_source_counts(
    p_crawl_run_source_id,
    p_discovered => 1,
    p_processed => 1,
    p_new_listings => case when saved.was_inserted then 1 else 0 end,
    p_updated_listings => case when saved.was_inserted then 0 else 1 end,
    p_rent_changes => case when saved.rent_changed then 1 else 0 end
  );

  return query select saved.listing_id, saved.was_inserted, saved.rent_changed;
end;
$$;

-- Same as before, but each run source starts with started_at, so the refresh timeout can clear a queued row.
create or replace function public.create_crawl_run(p_source_ids uuid[])
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
    insert into public.crawl_run_sources (crawl_run_id, source_id, started_at)
    select distinct new_run_id, requested.id, now() from unnest(p_source_ids) as requested (id)
    returning public.crawl_run_sources.crawl_run_id, public.crawl_run_sources.id, public.crawl_run_sources.source_id
  )
  select created.crawl_run_id, created.id, created.source_id from created;
end;
$$;

revoke all on function public.record_observed_listing(jsonb, uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_observed_listing(jsonb, uuid, uuid) to service_role;
revoke all on function public.create_crawl_run(uuid[]) from public, anon, authenticated;
grant execute on function public.create_crawl_run(uuid[]) to service_role;
