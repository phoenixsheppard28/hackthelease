insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
on conflict (id) do nothing;

create table public.listing_images (
  listing_id uuid not null references public.listings (id) on delete cascade,
  source_url text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  primary key (listing_id, source_url)
);

alter table public.listing_images enable row level security;
