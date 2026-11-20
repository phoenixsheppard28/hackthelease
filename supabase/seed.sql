insert into public.sources (provider, inventory_url, allowed_domains)
values
  ('Oxford Companies', 'https://residential.oxfordcompanies.com/searchlisting', array['residential.oxfordcompanies.com']),
  ('Cabrio Properties', 'https://showmojo.com/8f47a0401c/l', array['showmojo.com']),
  ('University of Michigan Off-Campus Housing', 'https://offcampushousing.umich.edu/listing', array['offcampushousing.umich.edu']),
  ('Pappas Rentals', 'https://www.pappasrentals.com/', array['www.pappasrentals.com']),
  ('CMB Ann Arbor Apartments', 'https://annarborapartments.net/all-properties/', array['annarborapartments.net']),
  ('Varsity Management', 'https://www.varsitymanagement.com/portfolio', array['www.varsitymanagement.com']),
  ('McKinley State Street Village', 'https://www.mckinley.com/apartments/michigan/ann-arbor/state-street-village/', array['www.mckinley.com']),
  ('Landmark Ann Arbor', 'https://livethelandmark.com/floorplans/', array['livethelandmark.com']),
  ('Foundry Lofts', 'https://www.foundryloftsannarbor.com/floorplans/', array['www.foundryloftsannarbor.com']),
  ('The Yard on South Main', 'https://livetheyard.com/floor-plans/', array['livetheyard.com']),
  ('Six11', 'https://livesix11.com/floor-plans/', array['livesix11.com']),
  ('Chapter Ann Arbor', 'https://chapterannarbor.com/floor-plans/', array['chapterannarbor.com']),
  ('The Standard at Ann Arbor', 'https://www.thestandardannarbor.com/floorplans/', array['www.thestandardannarbor.com']),
  ('Vic Village North', 'https://www.thevicvillagenorth.com/', array['www.thevicvillagenorth.com']),
  ('Woodbury Gardens', 'https://www.woodburygardens.com/Floor-plans.aspx', array['www.woodburygardens.com']),
  ('Ann Arbor City Club', 'https://www.cityclubannarbor.com/floorplans', array['www.cityclubannarbor.com']),
  ('The Haven of Ann Arbor', 'https://www.havenofannarbor.com/floorplans/', array['www.havenofannarbor.com'])
on conflict (inventory_url) do nothing;

update public.sources as source
set contact_email = contacts.email
from (values
  ('Oxford Companies', 'leasing@oxfordcompanies.com'),
  ('Cabrio Properties', 'leasing@cabrioproperties.com'),
  ('CMB Ann Arbor Apartments', 'cmb@annarborapartments.net'),
  ('Varsity Management', 'leasing@varsitymanagement.com'),
  ('McKinley State Street Village', 'StateStreetVillage.PropertyWebsite.McKinley@assist.rent'),
  ('Foundry Lofts', 'info@foundryloftsannarbor.com')
) as contacts(provider, email)
where source.provider = contacts.provider;

update public.sources as source
set listing_patterns = patterns.paths
from (values
  ('Oxford Companies', array['^/searchlisting$', '^/apartments/mi/ann-arbor/']),
  ('Cabrio Properties', array['^/8f47a0401c/l$', '^/l/.+-ann-arbor-mi-']),
  ('University of Michigan Off-Campus Housing', array['^/listing']),
  ('Pappas Rentals', array['^/$', '^/[0-9].*\.html$', '^/kingsley\.html$']),
  ('CMB Ann Arbor Apartments', array['^/all-properties/?$', '^/properties/']),
  ('Varsity Management', array['^/portfolio$', '^/[0-9]']),
  ('McKinley State Street Village', array['^/apartments/michigan/ann-arbor/state-street-village/']),
  ('Landmark Ann Arbor', array['^/floorplans/']),
  ('Foundry Lofts', array['^/floorplans/']),
  ('The Yard on South Main', array['^/floor-plans/', '^/floor-plan/']),
  ('Six11', array['^/floor-plans/', '^/floor-plan/']),
  ('Chapter Ann Arbor', array['^/floor-plans/', '^/floor-plan/']),
  ('The Standard at Ann Arbor', array['^/floorplans/']),
  ('Vic Village North', array['^/$', '^/floor-plans/?$', '^/cms-floor-plans/']),
  ('Woodbury Gardens', array['^/Floor-plans\.aspx$']),
  ('Ann Arbor City Club', array['^/floorplans']),
  ('The Haven of Ann Arbor', array['^/floorplans/'])
) as patterns(provider, paths)
where source.provider = patterns.provider;

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
