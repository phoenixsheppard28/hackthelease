insert into public.sources (provider, inventory_url, allowed_domains)
values
  ('Oxford Companies', 'https://residential.oxfordcompanies.com/searchlisting', array['residential.oxfordcompanies.com']),
  ('Cabrio Properties', 'https://showmojo.com/8f47a0401c/l', array['showmojo.com'])
on conflict (inventory_url) do nothing;

-- Demo data: synthetic fixture listings from src/lib/fixtures/listings.ts, marked with is_demo.
-- Their merge keys use the source ID "demo" because no crawled source owns them.
-- searchable_text must match listingToRow in src/lib/supabase/listing-rows.ts.
insert into public.listings (
  merge_key, address, normalized_address, unit, normalized_unit,
  rent_min, rent_max, rent_basis, recurring_fees_monthly, beds, available_from, accessible,
  amenities, features, description, contact, sources,
  searchable_text, text_hash, is_demo, refreshed_at
)
select
  demo.merge_key, demo.address, demo.normalized_address, demo.unit, demo.normalized_unit,
  demo.rent_min, demo.rent_max, demo.rent_basis::public.rent_basis, demo.recurring_fees_monthly,
  demo.beds, demo.available_from::date, demo.accessible,
  demo.amenities::jsonb, demo.features, demo.description, null, demo.sources::jsonb,
  demo.searchable_text, encode(extensions.digest(demo.searchable_text, 'sha256'), 'hex'),
  true, '2026-11-19T20:00:00Z'
from (
  values
    (
      'unit:demo:625 s state st ann arbor mi#2b',
      '625 South State Street, Ann Arbor, MI', '625 s state st ann arbor mi', '2B', '2b',
      980, 980, 'per_person', 0, 2, '2027-08-20', null::boolean,
      '{"laundry": true, "parking": false}',
      array['Shared kitchen', 'Near Central Campus'],
      'Demo listing for ranking and layout work.',
      '[{"url": "https://example.com/demo/oxford-1", "fetchedAt": "2026-11-19T20:00:00Z", "evidence": "Synthetic fixture. Monthly rent is per person."}]',
      E'Address: 625 South State Street, Ann Arbor, MI\nAmenities: laundry\nFeatures: Shared kitchen, Near Central Campus\nDescription: Demo listing for ranking and layout work.'
    ),
    (
      'unit:demo:1100 broadway st ann arbor mi#4a',
      '1100 Broadway Street, Ann Arbor, MI', '1100 broadway st ann arbor mi', '4A', '4a',
      2200, 2200, 'per_unit', 0, 2, '2027-08-20', true,
      '{"laundry": true, "parking": true}',
      array['Modern kitchen', 'Near North Campus'],
      'Demo listing for ranking and layout work.',
      '[{"url": "https://example.com/demo/cabrio-1", "fetchedAt": "2026-11-19T20:00:00Z", "evidence": "Synthetic fixture. Monthly rent is per unit."}]',
      E'Address: 1100 Broadway Street, Ann Arbor, MI\nAmenities: laundry, parking\nFeatures: Modern kitchen, Near North Campus\nDescription: Demo listing for ranking and layout work.'
    )
) as demo (
  merge_key, address, normalized_address, unit, normalized_unit,
  rent_min, rent_max, rent_basis, recurring_fees_monthly, beds, available_from, accessible,
  amenities, features, description, sources, searchable_text
)
on conflict (merge_key) do nothing;
