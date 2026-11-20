-- Deactivates listings of a source after two succeeded crawls of that source omit them.
-- Partial and failed crawls never count, so they never deactivate a listing.
create function public.deactivate_stale_listings(p_source_id uuid)
returns integer
language sql
set search_path = ''
as $$
  with last_seen as (
    select observation.listing_id, max(observation.fetched_at) as fetched_at
    from public.listing_observations as observation
    join public.crawl_run_sources as run_source on run_source.id = observation.crawl_run_source_id
    where observation.listing_id is not null
    group by observation.listing_id
    -- Keep the listing active while another source reports it.
    having bool_and(run_source.source_id = p_source_id)
  ),
  deactivated as (
    update public.listings as listing
    set is_active = false, updated_at = now()
    from last_seen
    where listing.id = last_seen.listing_id
      and listing.is_active
      and (
        select count(*)
        from public.crawl_run_sources as run_source
        where run_source.source_id = p_source_id
          and run_source.status = 'succeeded'
          and run_source.started_at > last_seen.fetched_at
      ) >= 2
    returning 1
  )
  select count(*)::integer from deactivated;
$$;

revoke all on function public.deactivate_stale_listings(uuid) from public, anon, authenticated;
grant execute on function public.deactivate_stale_listings(uuid) to service_role;
