-- Private group correspondence is only accessible through authorized server routes.
create table public.group_mailboxes (
  group_id uuid primary key references public.housing_groups(id) on delete cascade,
  inbox_id text not null unique,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.availability_inquiries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.housing_groups(id) on delete cascade,
  listing_id uuid not null references public.listings(id),
  requested_by uuid not null references auth.users(id),
  lease_start date not null,
  lease_end date not null check (lease_end > lease_start),
  recipient text not null,
  subject text not null,
  body text not null,
  inbox_id text,
  thread_id text,
  message_id text,
  status text not null default 'draft' check (status in ('draft','sending','sent','delivery_unknown','reply_received','closed')),
  attempted_at timestamptz,
  created_at timestamptz not null default now(),
  is_test boolean not null default false
);
create index availability_inquiries_group_idx on public.availability_inquiries(group_id, listing_id);
create unique index availability_inquiries_thread_idx on public.availability_inquiries(inbox_id, thread_id) where thread_id is not null;
-- Other groups may benefit from a confirmation, but never see the private thread.
create unique index availability_pending_term_idx on public.availability_inquiries(listing_id, lease_start, lease_end)
  where status in ('sending','sent','delivery_unknown','reply_received') and not is_test;

create table public.availability_replies (
  message_id text primary key,
  inquiry_id uuid not null references public.availability_inquiries(id) on delete cascade,
  sender text not null,
  body text not null,
  received_at timestamptz not null,
  expected_sender boolean not null,
  proposal jsonb,
  created_at timestamptz not null default now()
);

create table public.availability_confirmations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  lease_start date not null,
  lease_end date not null check (lease_end > lease_start),
  status text not null check (status in ('available','unavailable','renewal_undecided')),
  inquiry_id uuid not null references public.availability_inquiries(id),
  message_id text not null references public.availability_replies(message_id),
  reviewed_by uuid not null references auth.users(id),
  confirmed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  unique (listing_id, lease_start, lease_end)
);

alter table public.group_mailboxes enable row level security;
alter table public.availability_inquiries enable row level security;
alter table public.availability_replies enable row level security;
alter table public.availability_confirmations enable row level security;
revoke all on public.group_mailboxes, public.availability_inquiries, public.availability_replies, public.availability_confirmations from anon, authenticated;
grant select, insert, update, delete on public.group_mailboxes, public.availability_inquiries, public.availability_replies, public.availability_confirmations to service_role;

-- Serialize sends per group; duplicate clicks and requests from other groups
-- cannot bypass the daily limit or reserve the same listing/lease period.
create function public.claim_availability_inquiry(p_id uuid, p_user_id uuid)
returns setof public.availability_inquiries language plpgsql security definer set search_path = public as $$
declare inquiry public.availability_inquiries;
begin
  select * into inquiry from public.availability_inquiries where id = p_id;
  if not found or not exists (select 1 from public.housing_group_members where group_id = inquiry.group_id and user_id = p_user_id) then
    raise exception 'Inquiry unavailable';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(inquiry.group_id::text, 0));
  select * into inquiry from public.availability_inquiries where id = p_id for update;
  if inquiry.status in ('sending','delivery_unknown') then
    if inquiry.attempted_at < now() - interval '23 hours' then raise exception 'Delivery requires review before retry'; end if;
    return next inquiry;
    return;
  end if;
  if inquiry.status <> 'draft' then return; end if;
  if (select count(*) from public.availability_inquiries where group_id = inquiry.group_id and attempted_at > now() - interval '24 hours') >= 5 then
    raise exception 'Daily group email limit reached';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(inquiry.listing_id::text, 1));
  if not inquiry.is_test and exists (select 1 from public.availability_confirmations where listing_id = inquiry.listing_id and lease_start = inquiry.lease_start and lease_end = inquiry.lease_end and expires_at > now()) then
    raise exception 'Recent confirmation already available';
  end if;
  return query update public.availability_inquiries set status = 'sending', attempted_at = now() where id = p_id returning *;
end;
$$;
revoke all on function public.claim_availability_inquiry(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_availability_inquiry(uuid, uuid) to service_role;
