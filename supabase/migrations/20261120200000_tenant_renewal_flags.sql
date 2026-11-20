-- Kept separate from scraped fields so a catalog refresh cannot erase a report.
alter table public.listings add column if not exists tenant_renewal jsonb;

-- Apply only a trusted, non-test reply about this inquiry's unit and dates.
-- Lock the listing so delayed/retried webhooks cannot overwrite newer evidence.
create or replace function public.apply_tenant_renewal_reply(p_message_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  reply public.availability_replies;
  inquiry public.availability_inquiries;
  previous jsonb;
begin
  select * into reply from public.availability_replies where message_id = p_message_id;
  if not found or not reply.expected_sender or reply.proposal->>'matchesUnitAndDates' is distinct from 'true'
    or reply.received_at < now() - interval '30 days' or reply.received_at > now() + interval '5 minutes' then return; end if;
  select * into inquiry from public.availability_inquiries where id = reply.inquiry_id;
  if not found or inquiry.is_test or inquiry.lease_end < current_date then return; end if;
  select tenant_renewal into previous from public.listings where id = inquiry.listing_id for update;
  if previous is not null and (previous->>'reportedAt')::timestamptz >= reply.received_at then return; end if;

  if reply.proposal->>'status' = 'unavailable' and reply.proposal->>'tenantsRenewing' = 'true' then
    update public.listings set tenant_renewal = jsonb_build_object(
      'reportedAt', reply.received_at, 'source', 'landlord_email', 'renewing', true,
      'leaseStart', inquiry.lease_start, 'leaseEnd', inquiry.lease_end
    ) where id = inquiry.listing_id;
  elsif reply.proposal->>'status' in ('available', 'renewal_undecided')
    and previous->>'leaseStart' = inquiry.lease_start::text and previous->>'leaseEnd' = inquiry.lease_end::text then
    update public.listings set tenant_renewal = previous || jsonb_build_object(
      'reportedAt', reply.received_at, 'renewing', false
    ) where id = inquiry.listing_id;
  end if;
end;
$$;
revoke all on function public.apply_tenant_renewal_reply(text) from public, anon, authenticated;
grant execute on function public.apply_tenant_renewal_reply(text) to service_role;

-- Confirmed by the project owner; no landlord email or lease dates were supplied.
update public.listings set tenant_renewal = jsonb_build_object(
  'reportedAt', now(), 'source', 'user_report', 'renewing', true, 'leaseStart', null, 'leaseEnd', null
) where id = 'd1593730-54dd-4624-9f54-6c5903156bd5' and tenant_renewal is null;
