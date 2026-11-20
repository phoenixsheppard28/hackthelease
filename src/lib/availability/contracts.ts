import { z } from 'zod';

export const inquiryInput = z.object({ listingId: z.uuid(), leaseStart: z.iso.date(), leaseEnd: z.iso.date() })
  .refine(value => value.leaseEnd > value.leaseStart, 'End date must be after the start date.');
export const availabilityStatus = z.enum(['available', 'unavailable', 'renewal_undecided', 'unclear']);
export const proposalSchema = z.object({ status: availabilityStatus, evidence: z.string().max(1000), matchesUnitAndDates: z.boolean() });
export type Proposal = z.infer<typeof proposalSchema>;
export type Inquiry = {
  id: string; group_id: string; listing_id: string; requested_by: string;
  lease_start: string; lease_end: string; recipient: string; subject: string; body: string;
  inbox_id: string | null; thread_id: string | null; message_id: string | null;
  status: 'draft' | 'sending' | 'sent' | 'delivery_unknown' | 'reply_received' | 'closed';
  attempted_at: string | null; created_at: string; is_test: boolean;
};
export type Reply = { message_id: string; inquiry_id: string; sender: string; body: string; received_at: string; expected_sender: boolean; proposal: Proposal | null };
export type Confirmation = { id: string; lease_start: string; lease_end: string; status: 'available' | 'unavailable' | 'renewal_undecided'; confirmed_at: string; expires_at: string };
export type AvailabilityView = { configured: boolean; groupId: string | null; inboxEmail: string | null; canReview: boolean; inquiries: Inquiry[]; replies: Reply[]; confirmations: Confirmation[] };
export const statusLabels = { available: 'Landlord-confirmed available', unavailable: 'Unavailable for these dates', renewal_undecided: 'Renewal undecided', unclear: 'Needs clarification' };

export function inquiryEmail(address: string, unit: string | null, start: string, end: string) {
  const home = address.replace(/[\r\n]+/g, ' ') + (unit ? `, unit ${unit.replace(/[\r\n]+/g, ' ')}` : '');
  return { subject: `Availability: ${home} · ${start} to ${end}`,
    body: `Hello,\n\nWe’re contacting you through HomeWork on behalf of a student housing group. Is ${home} available for a lease from ${start} to ${end}?\n\nHave the current tenants confirmed renewal, or is renewal still undecided? Please confirm the unit and lease dates in your reply.\n\nThank you,\nHomeWork\n\nIf you are not the right contact or prefer not to receive inquiries, please let us know.` };
}
