import { z } from 'zod';
import type { ListingAvailability } from './listing-status';

export const inquiryInput = z.object({ listingId: z.uuid(), question: z.string().trim().min(3).max(1000) });
export const emailEdit = z.object({ subject: z.string().trim().min(1).max(200).regex(/^[^\r\n]+$/), body: z.string().trim().min(1).max(4000) });
export const availabilityStatus = z.enum(['available', 'unavailable', 'renewal_undecided', 'unclear']);
export const proposalSchema = z.object({ status: availabilityStatus, evidence: z.string().max(1000), matchesUnitAndDates: z.boolean(), tenantsRenewing: z.boolean().default(false), leaseSigned: z.boolean().default(false) });
export type Proposal = z.infer<typeof proposalSchema>;
export type Inquiry = {
  id: string; group_id: string; listing_id: string; requested_by: string;
  lease_start: string | null; lease_end: string | null; recipient: string; subject: string; body: string;
  inbox_id: string | null; thread_id: string | null; message_id: string | null;
  status: 'draft' | 'sending' | 'sent' | 'delivery_unknown' | 'reply_received' | 'closed';
  attempted_at: string | null; created_at: string; is_test: boolean;
};
export type Reply = { message_id: string; inquiry_id: string; sender: string; body: string; received_at: string; expected_sender: boolean; proposal: Proposal | null };
export type Confirmation = { id: string; lease_start: string; lease_end: string; status: 'available' | 'unavailable' | 'renewal_undecided'; confirmed_at: string; expires_at: string };
export type AvailabilityView = { configured: boolean; groupId: string | null; inboxEmail: string | null; canReview: boolean; inquiries: Inquiry[]; replies: Reply[]; confirmations: Confirmation[]; availabilityReport: ListingAvailability | null };
export type Followup = { id: string; inquiry_id: string; reply_message_id: string; body: string; status: 'draft' | 'sending' | 'sent'; sent_by: string | null; sent_at: string | null; created_at: string };
export type InboxThread = { inquiry: Inquiry; listing: { id: string; title: string; availabilityReport: ListingAvailability | null }; replies: Reply[]; followups: Followup[] };
export type GroupInbox = { configured: boolean; groupId: string | null; inboxEmail: string | null; threads: InboxThread[] };
export const followupInput = z.object({ followupId: z.uuid(), body: z.string().trim().min(1).max(4000) });
export const statusLabels = { available: 'Landlord-confirmed available', unavailable: 'Unavailable for these dates', renewal_undecided: 'Renewal undecided', unclear: 'Needs clarification' };

