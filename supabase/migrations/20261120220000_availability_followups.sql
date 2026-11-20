-- AI-drafted replies to landlord emails. A group member sends each one.
create table public.availability_followups (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.availability_inquiries(id) on delete cascade,
  reply_message_id text not null unique references public.availability_replies(message_id) on delete cascade,
  body text not null,
  status text not null default 'draft' check (status in ('draft','sending','sent')),
  sent_by uuid references auth.users(id),
  sent_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index availability_followups_inquiry_idx on public.availability_followups(inquiry_id);

alter table public.availability_followups enable row level security;
revoke all on public.availability_followups from anon, authenticated;
grant select, insert, update, delete on public.availability_followups to service_role;
