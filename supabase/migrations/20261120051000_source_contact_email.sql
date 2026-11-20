alter table public.sources
  add column contact_email text
  check (contact_email is null or contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$');

update public.sources as source
set contact_email = contacts.email
from (values
  ('Oxford Companies', 'leasing@oxfordcompanies.com'),
  ('Cabrio Properties', 'leasing@cabrioproperties.com')
) as contacts(provider, email)
where source.provider = contacts.provider;

with source_contacts as (
  select distinct on (observation.listing_id)
    observation.listing_id,
    source.contact_email
  from public.listing_observations as observation
  join public.crawl_run_sources as run_source on run_source.id = observation.crawl_run_source_id
  join public.sources as source on source.id = run_source.source_id
  where source.contact_email is not null and observation.listing_id is not null
  order by observation.listing_id, observation.fetched_at desc
)
update public.listings as listing
set contact = jsonb_build_object(
  'name', listing.contact->>'name',
  'email', source_contacts.contact_email,
  'phone', listing.contact->>'phone'
)
from source_contacts
where listing.id = source_contacts.listing_id
  and not listing.is_demo
  and nullif(trim(listing.contact->>'email'), '') is null;
