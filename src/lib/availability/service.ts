import 'server-only';
import { z } from 'zod';
import { agentmail, createGroupInbox, mailMessageSchema, safeIncoming, type MailMessage } from './agentmail';
import { inquiryEmail, type Inquiry, type Reply, type Confirmation, type AvailabilityView } from './contracts';
import { AvailabilityError, canReview, memberGroup, storage } from './storage';
import { proposeAvailability } from './proposal';
import { currentListingAvailability, listingAvailabilitySchema } from './listing-status';

type Mailbox = { group_id: string; inbox_id: string; email: string };
const enc = encodeURIComponent;
const patch = (body: unknown) => ({ method: 'PATCH', body: JSON.stringify(body) });

export async function ownedInquiry(userId: string, id: string): Promise<Inquiry> {
  const groupId = await memberGroup(userId);
  if (!groupId) throw new AvailabilityError('Create or join a housing group first.', 403);
  const [inquiry] = await storage<Inquiry[]>('availability_inquiries', `id=eq.${enc(id)}&group_id=eq.${enc(groupId)}`);
  if (!inquiry) throw new AvailabilityError('Inquiry not found.', 404);
  return inquiry;
}

export async function availabilityView(userId: string, listingId: string): Promise<AvailabilityView> {
  const groupId = await memberGroup(userId);
  const [inquiries, confirmations, mailboxes, listings] = await Promise.all([
    groupId ? storage<Inquiry[]>('availability_inquiries', `group_id=eq.${enc(groupId)}&listing_id=eq.${enc(listingId)}&order=created_at.desc&limit=20`) : [],
    storage<Confirmation[]>('availability_confirmations', `select=id,lease_start,lease_end,status,confirmed_at,expires_at&listing_id=eq.${enc(listingId)}&order=confirmed_at.desc&limit=10`),
    groupId ? storage<Mailbox[]>('group_mailboxes', `group_id=eq.${enc(groupId)}`) : [],
    storage<{ availability_report: unknown }[]>('listings', `select=availability_report&id=eq.${enc(listingId)}`),
  ]);
  const replies = inquiries.length ? await storage<Reply[]>('availability_replies', `inquiry_id=in.(${inquiries.map(item => item.id).join(',')})&order=received_at.asc`) : [];
  const report = listingAvailabilitySchema.nullable().parse(listings[0]?.availability_report ?? null);
  return { configured: Boolean(process.env.AGENTMAIL_API_KEY), groupId, canReview: canReview(userId), inboxEmail: mailboxes[0]?.email ?? null, inquiries, replies, confirmations, availabilityReport: currentListingAvailability(report) };
}

export async function createInquiry(userId: string, input: { listingId: string; leaseStart: string; leaseEnd: string }) {
  const groupId = await memberGroup(userId);
  if (!groupId) throw new AvailabilityError('Create or join a housing group first.', 403);
  if (new Date(input.leaseEnd + 'T23:59:59Z').getTime() < Date.now()) throw new AvailabilityError('Choose a lease period that has not ended.');
  const recent = await storage<{ id: string }[]>('availability_inquiries', `select=id&group_id=eq.${enc(groupId)}&created_at=gte.${enc(new Date(Date.now() - 86400000).toISOString())}&limit=20`);
  if (recent.length >= 20) throw new AvailabilityError('Your group has reached its daily draft limit.', 429);
  const [listing] = await storage<{ address: string; unit: string | null; contact: { email?: string } | null }[]>('listings', `select=address,unit,contact&id=eq.${enc(input.listingId)}&is_active=eq.true`);
  if (!listing) throw new AvailabilityError('This listing is unavailable.', 404);
  const recipient = z.email().safeParse(process.env.AGENTMAIL_TEST_RECIPIENT || listing.contact?.email);
  if (!recipient.success) throw new AvailabilityError('This listing has no valid landlord email.');
  const email = inquiryEmail(listing.address, listing.unit, input.leaseStart, input.leaseEnd);
  const [inquiry] = await storage<Inquiry[]>('availability_inquiries', '', { method: 'POST', body: JSON.stringify({ group_id: groupId, requested_by: userId, listing_id: input.listingId,
    lease_start: input.leaseStart, lease_end: input.leaseEnd, recipient: recipient.data.toLowerCase(), ...email, is_test: Boolean(process.env.AGENTMAIL_TEST_RECIPIENT) }) });
  return inquiry;
}

async function mailbox(groupId: string) {
  const [existing] = await storage<Mailbox[]>('group_mailboxes', `group_id=eq.${enc(groupId)}`);
  if (existing) return existing;
  const created = await createGroupInbox(groupId);
  const data = { group_id: groupId, inbox_id: created.inbox_id, email: created.email ?? created.inbox_id };
  await storage('group_mailboxes', 'on_conflict=group_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(data) });
  return data;
}

export async function sendInquiry(userId: string, id: string) {
  const inquiry = await ownedInquiry(userId, id);
  if (['sent','reply_received','closed'].includes(inquiry.status)) return inquiry;
  if (!process.env.AGENTMAIL_API_KEY) throw new AvailabilityError('Group email is not configured.', 503);
  // Inbox creation can be retried safely; no email is sent until the claim succeeds.
  const inbox = await mailbox(inquiry.group_id);
  await storage('availability_inquiries', `id=eq.${enc(id)}&status=eq.draft`, patch({ inbox_id: inbox.inbox_id }));
  const [claimed] = await storage<Inquiry[]>('rpc/claim_availability_inquiry', '', { method: 'POST', body: JSON.stringify({ p_id: id, p_user_id: userId }) });
  if (!claimed) return ownedInquiry(userId, id);
  try {
    const sent = z.object({ message_id: z.string(), thread_id: z.string() }).parse(await agentmail(`inboxes/${enc(inbox.inbox_id)}/messages/send`, {
      method: 'POST', headers: { 'Idempotency-Key': `availability-${id}` }, body: JSON.stringify({ to: [claimed.recipient], subject: claimed.subject, text: claimed.body, labels: [`availability-${id}`] }),
    }));
    await storage('availability_inquiries', `id=eq.${enc(id)}&status=in.(sending,delivery_unknown)`, patch({ ...sent, status: 'sent', inbox_id: inbox.inbox_id }));
    return ownedInquiry(userId, id);
  } catch {
    await storage('availability_inquiries', `id=eq.${enc(id)}&status=eq.sending`, patch({ status: 'delivery_unknown' }));
    throw new AvailabilityError('Delivery could not be confirmed. Use Check replies first. Retrying within 23 hours uses the same send ID to prevent duplicate email.', 503);
  }
}

async function applyListingStatusReply(inquiry: Inquiry, reply: Reply) {
  const proposal = reply.proposal;
  if (inquiry.is_test || !reply.expected_sender || !proposal?.matchesUnitAndDates) return;
  if (!(proposal.status === 'unavailable' && (proposal.tenantsRenewing || proposal.leaseSigned)) && !['available', 'renewal_undecided'].includes(proposal.status)) return;
  await storage('rpc/apply_listing_availability_reply', '', { method: 'POST', body: JSON.stringify({ p_message_id: reply.message_id }) });
}

export async function recordReply(inquiry: Inquiry, message: MailMessage) {
  if (message.inbox_id !== inquiry.inbox_id || message.thread_id !== inquiry.thread_id || !message.labels.includes('received')) return;
  const [existing] = await storage<Reply[]>('availability_replies', `message_id=eq.${enc(message.message_id)}`);
  // Retry the idempotent flag update if a previous webhook saved the reply but failed afterward.
  if (existing) {
    if (existing.expected_sender && (!existing.proposal || typeof existing.proposal.leaseSigned !== 'boolean' || typeof existing.proposal.tenantsRenewing !== 'boolean')) {
      const proposal = await proposeAvailability(inquiry, existing.body);
      if (proposal) {
        await storage('availability_replies', `message_id=eq.${enc(message.message_id)}`, patch({ proposal }));
        existing.proposal = proposal;
      }
    }
    await applyListingStatusReply(inquiry, existing);
    return;
  }
  const body = (message.extracted_text || message.text || '').slice(0, 64000);
  const expected = safeIncoming(message, inquiry.recipient);
  const proposal = expected && body ? await proposeAvailability(inquiry, body) : null;
  await storage('availability_replies', 'on_conflict=message_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ message_id: message.message_id, inquiry_id: inquiry.id, sender: message.from, body: body || 'Email body unavailable. Review the original message in AgentMail.', received_at: message.timestamp, expected_sender: expected, proposal }) });
  await applyListingStatusReply(inquiry, { message_id: message.message_id, inquiry_id: inquiry.id, sender: message.from, body, received_at: message.timestamp, expected_sender: expected, proposal });
  await storage('availability_inquiries', `id=eq.${inquiry.id}&status=in.(sending,sent,delivery_unknown)`, patch({ status: 'reply_received' }));
}

export async function syncInquiry(userId: string, id: string) {
  let inquiry = await ownedInquiry(userId, id);
  if (!inquiry.inbox_id || inquiry.status === 'draft') return;
  if (!inquiry.thread_id) {
    const data = await agentmail<{ messages?: unknown[] }>(`inboxes/${enc(inquiry.inbox_id)}/messages?labels=${enc(`availability-${id}`)}&limit=10`);
    const outgoing = data.messages?.map(item => mailMessageSchema.parse(item)).find(item => item.labels.includes('sent'));
    if (!outgoing) throw new AvailabilityError('No sent message is visible yet. Wait briefly and check again.');
    const [updated] = await storage<Inquiry[]>('availability_inquiries', `id=eq.${id}`, patch({ thread_id: outgoing.thread_id, message_id: outgoing.message_id, status: 'sent' }));
    inquiry = updated;
  }
  let pageToken: string | undefined;
  do {
    const data: { messages?: unknown[]; next_page_token?: string } = await agentmail(`inboxes/${enc(inquiry.inbox_id!)}/threads/${enc(inquiry.thread_id!)}?limit=100${pageToken ? '&page_token=' + enc(pageToken) : ''}`);
    for (const raw of data.messages ?? []) {
      const message = mailMessageSchema.parse(raw);
      if (message.labels.includes('received')) {
        // The full-message endpoint supplies bodies omitted from thread summaries.
        const full = mailMessageSchema.parse(await agentmail(`inboxes/${enc(inquiry.inbox_id!)}/messages/${enc(message.message_id)}`));
        await recordReply(inquiry, full);
      }
    }
    pageToken = data.next_page_token;
  } while (pageToken);
}

export async function publishConfirmation(userId: string, id: string, messageId: string, status: Confirmation['status']) {
  if (!canReview(userId)) throw new AvailabilityError('Only an availability reviewer can publish confirmations.', 403);
  const inquiry = await ownedInquiry(userId, id);
  if (inquiry.is_test) throw new AvailabilityError('Test messages cannot change public listing availability.');
  const [reply] = await storage<Reply[]>('availability_replies', `message_id=eq.${enc(messageId)}&inquiry_id=eq.${id}`);
  if (!reply?.expected_sender) throw new AvailabilityError('Confirmations require a reply from the expected landlord contact.');
  const expiresAt = Date.parse(reply.received_at) + 30 * 86400000;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new AvailabilityError('This reply is too old to confirm current availability. Request an updated reply.');
  const now = new Date();
  await storage('availability_confirmations', 'on_conflict=listing_id,lease_start,lease_end', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({
    listing_id: inquiry.listing_id, lease_start: inquiry.lease_start, lease_end: inquiry.lease_end, status, inquiry_id: id, message_id: messageId, reviewed_by: userId,
    confirmed_at: now.toISOString(), expires_at: new Date(expiresAt).toISOString(),
  }) });
  await storage('availability_inquiries', `id=eq.${id}`, patch({ status: 'closed' }));
}
