-- Students now write free-form questions; lease dates are optional.
alter table public.availability_inquiries alter column lease_start drop not null;
alter table public.availability_inquiries alter column lease_end drop not null;
