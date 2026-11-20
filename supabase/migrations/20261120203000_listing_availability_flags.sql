begin;

-- Extend renewal reports to include leases signed by new tenants.
alter table public.listings rename column tenant_renewal to availability_report;
update public.listings set availability_report = (availability_report - 'renewing') || jsonb_build_object(
  'status', case when availability_report->>'renewing' = 'true' then 'tenants_renewing' else 'available' end
) where availability_report is not null;

create function public.apply_listing_availability_reply(p_message_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  reply public.availability_replies;
  inquiry public.availability_inquiries;
  previous jsonb;
  next_status text;
begin
  select * into reply from public.availability_replies where message_id = p_message_id;
  if not found or not reply.expected_sender or reply.proposal->>'matchesUnitAndDates' is distinct from 'true'
    or coalesce(reply.proposal->>'evidence', '') = ''
    or position(reply.proposal->>'evidence' in reply.body) = 0
    or reply.received_at < now() - interval '30 days' or reply.received_at > now() + interval '5 minutes' then return; end if;
  select * into inquiry from public.availability_inquiries where id = reply.inquiry_id;
  if not found or inquiry.is_test or inquiry.lease_end < current_date then return; end if;

  if reply.proposal->>'status' = 'unavailable' and reply.proposal->>'tenantsRenewing' = 'true' then
    next_status := 'tenants_renewing';
  elsif reply.proposal->>'status' = 'unavailable' and reply.proposal->>'leaseSigned' = 'true' then
    next_status := 'lease_signed';
  elsif reply.proposal->>'status' in ('available', 'renewal_undecided') then
    next_status := reply.proposal->>'status';
  else
    return;
  end if;

  select availability_report into previous from public.listings where id = inquiry.listing_id for update;
  if previous is not null and (previous->>'reportedAt')::timestamptz >= reply.received_at then return; end if;
  -- Do not clear an unavailable lease term based on availability for a different term.
  if next_status in ('available', 'renewal_undecided') and previous is not null
    and (previous->>'leaseStart' is distinct from inquiry.lease_start::text or previous->>'leaseEnd' is distinct from inquiry.lease_end::text) then return; end if;

  -- Keep clear/correction timestamps too, so an older renewal cannot reappear.
  update public.listings set availability_report = jsonb_build_object(
    'reportedAt', reply.received_at, 'source', 'landlord_email', 'status', next_status,
    'leaseStart', inquiry.lease_start, 'leaseEnd', inquiry.lease_end
  ) where id = inquiry.listing_id;
end;
$$;
revoke all on function public.apply_listing_availability_reply(text) from public, anon, authenticated;
grant execute on function public.apply_listing_availability_reply(text) to service_role;
drop function public.apply_tenant_renewal_reply(text);

commit;
