import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('./storage', async importOriginal => ({ ...await importOriginal<typeof import('./storage')>(), storage: vi.fn(), memberGroup: vi.fn(), canReview: vi.fn() }));
vi.mock('./agentmail', async importOriginal => ({ ...await importOriginal<typeof import('./agentmail')>(), agentmail: vi.fn(), createGroupInbox: vi.fn() }));
vi.mock('./proposal', () => ({ proposeAvailability: vi.fn() }));
vi.mock('./followup', () => ({ draftFollowup: vi.fn() }));
vi.mock('./compose', async importOriginal => ({ ...await importOriginal<typeof import('./compose')>(), composeInquiry: vi.fn() }));
import { storage, memberGroup, canReview } from './storage';
import { agentmail, safeIncoming, type MailMessage } from './agentmail';
import { proposeAvailability } from './proposal';
import { draftFollowup } from './followup';
import { ownedInquiry, sendInquiry, recordReply, publishConfirmation, createInquiry, sendFollowup, groupInbox } from './service';
import { emailEdit, inquiryInput, type Inquiry } from './contracts';
import { composeInquiry, fallbackEmail } from './compose';
const inquiry: Inquiry = { id: 'id-1', group_id: 'group-1', listing_id: 'listing-1', requested_by: 'user-1', lease_start: '2027-08-01', lease_end: '2028-08-01', recipient: 'landlord@example.com', subject: 'Availability', body: 'Is unit 1 available?', inbox_id: 'group@example.com', thread_id: 'thread-1', message_id: 'outgoing-1', status: 'draft', attempted_at: null, created_at: new Date().toISOString(), is_test: false };
const message: MailMessage = { message_id: 'reply-1', inbox_id: inquiry.inbox_id!, thread_id: inquiry.thread_id!, from: 'Landlord <landlord@example.com>', timestamp: new Date().toISOString(), labels: ['received'], text: 'Yes, available.' };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(memberGroup).mockResolvedValue('group-1'); vi.stubEnv('AGENTMAIL_API_KEY', 'test-key'); vi.stubEnv('AGENTMAIL_TEST_RECIPIENT', ''); });
afterEach(() => vi.unstubAllEnvs());
describe('availability ownership and delivery', () => {
  it('refuses inquiries outside the signed-in group', async () => {
    vi.mocked(storage).mockResolvedValue([]);
    await expect(ownedInquiry('user-2', 'id-1')).rejects.toThrow('not found');
    expect(storage).toHaveBeenCalledWith('availability_inquiries', 'id=eq.id-1&group_id=eq.group-1');
  });
  it('requires membership before accessing correspondence', async () => {
    vi.mocked(memberGroup).mockResolvedValue(null);
    await expect(sendInquiry('outsider', 'id-1')).rejects.toThrow('group');
    expect(storage).not.toHaveBeenCalled(); expect(agentmail).not.toHaveBeenCalled();
  });
  it('does not resend already sent mail', async () => {
    vi.mocked(storage).mockResolvedValue([{ ...inquiry, status: 'sent' }]);
    await sendInquiry('user-1', inquiry.id);
    expect(agentmail).not.toHaveBeenCalled();
  });
  it('reserves the inquiry before sending with a stable idempotency key', async () => {
    vi.mocked(storage).mockResolvedValueOnce([inquiry]).mockResolvedValueOnce([{ inbox_id: inquiry.inbox_id }]).mockResolvedValueOnce([]).mockResolvedValueOnce([inquiry]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ ...inquiry, status: 'sent' }]);
    vi.mocked(agentmail).mockImplementation(async () => {
      expect(storage).toHaveBeenCalledWith('rpc/claim_availability_inquiry', '', expect.any(Object));
      return { message_id: 'outgoing-1', thread_id: 'thread-1' } as never;
    });
    await sendInquiry('user-1', inquiry.id);
    expect(agentmail).toHaveBeenCalledWith(expect.stringContaining('/messages/send'), expect.objectContaining({ headers: { 'Idempotency-Key': 'availability-id-1' }, body: JSON.stringify({ to: [inquiry.recipient], subject: inquiry.subject, text: inquiry.body, labels: ['availability-id-1'] }) }));
  });
  it('does not contact the provider when the database claim fails', async () => {
    vi.mocked(storage).mockResolvedValueOnce([inquiry]).mockResolvedValueOnce([{ inbox_id: inquiry.inbox_id }]).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('pending inquiry'));
    await expect(sendInquiry('user-1', inquiry.id)).rejects.toThrow('pending');
    expect(agentmail).not.toHaveBeenCalled();
  });
  it('uses the server listing contact and never creates an inbox while drafting', async () => {
    vi.mocked(storage).mockResolvedValueOnce([]).mockResolvedValueOnce([{ address: '123 Main', unit: '2', contact: { email: 'Landlord@example.com' } }]).mockResolvedValueOnce([inquiry]);
    vi.mocked(composeInquiry).mockResolvedValue({ subject: 'Utilities', body: 'Are utilities included at 123 Main, unit 2?', leaseStart: null, leaseEnd: null });
    await createInquiry('user-1', { listingId: inquiry.listing_id, question: 'utilities included?' });
    expect(composeInquiry).toHaveBeenCalledWith('123 Main', '2', 'utilities included?');
    const payload = JSON.parse(String(vi.mocked(storage).mock.calls[2][2]?.body));
    expect(payload.recipient).toBe('landlord@example.com'); expect(payload.body).toContain('unit 2'); expect(payload.lease_start).toBeNull();
    expect(agentmail).not.toHaveBeenCalled();
  });
});
describe('reply trust and publication', () => {
  it('marks a signed lease unavailable without calling it a tenant renewal', async () => {
    vi.mocked(storage).mockResolvedValue([]);
    vi.mocked(proposeAvailability).mockResolvedValue({ status: 'unavailable', evidence: 'The lease has already been signed.', matchesUnitAndDates: true, tenantsRenewing: false, leaseSigned: true });
    await recordReply(inquiry, { ...message, text: 'The lease has already been signed.' });
    expect(storage).toHaveBeenCalledWith('rpc/apply_listing_availability_reply', '', { method: 'POST', body: JSON.stringify({ p_message_id: message.message_id }) });
  });
  it('can classify an older stored reply that predates the new flags', async () => {
    vi.mocked(storage).mockResolvedValueOnce([{ message_id: message.message_id, expected_sender: true, body: 'Lease signed.', proposal: { status: 'unavailable', evidence: 'Lease signed.', matchesUnitAndDates: true } }]).mockResolvedValue([]);
    vi.mocked(proposeAvailability).mockResolvedValue({ status: 'unavailable', evidence: 'Lease signed.', matchesUnitAndDates: true, tenantsRenewing: false, leaseSigned: true });
    await recordReply(inquiry, message);
    expect(proposeAvailability).toHaveBeenCalledWith(inquiry, 'Lease signed.');
    expect(storage).toHaveBeenCalledWith('rpc/apply_listing_availability_reply', '', expect.any(Object));
  });
  it('updates the listing automatically for a trusted confirmed renewal', async () => {
    vi.mocked(storage).mockResolvedValue([]);
    vi.mocked(proposeAvailability).mockResolvedValue({ status: 'unavailable', evidence: 'Tenants renewed.', matchesUnitAndDates: true, tenantsRenewing: true, leaseSigned: false });
    await recordReply(inquiry, { ...message, text: 'Tenants renewed.' });
    expect(storage).toHaveBeenCalledWith('rpc/apply_listing_availability_reply', '', { method: 'POST', body: JSON.stringify({ p_message_id: message.message_id }) });
  });
  it('retries a failed flag update from an already stored reply without calling AI again', async () => {
    vi.mocked(storage).mockResolvedValue([{ message_id: message.message_id, expected_sender: true, proposal: { status: 'unavailable', matchesUnitAndDates: true, tenantsRenewing: true, leaseSigned: false } }]);
    await recordReply(inquiry, message);
    expect(proposeAvailability).not.toHaveBeenCalled();
    expect(storage).toHaveBeenCalledWith('rpc/apply_listing_availability_reply', '', expect.any(Object));
  });
  it.each([
    { isTest: true, matches: true, renewing: true },
    { isTest: false, matches: false, renewing: true },
  ])('does not auto-flag test or ambiguous mail: %o', async ({ isTest, matches, renewing }) => {
    vi.mocked(storage).mockResolvedValue([]);
    vi.mocked(proposeAvailability).mockResolvedValue({ status: 'unavailable', evidence: 'Reply.', matchesUnitAndDates: matches, tenantsRenewing: renewing, leaseSigned: false });
    await recordReply({ ...inquiry, is_test: isTest }, message);
    expect(vi.mocked(storage).mock.calls.some(call => call[0] === 'rpc/apply_listing_availability_reply')).toBe(false);
  });
  it('flags an unavailable home even when the landlord gives no reason', async () => {
    vi.mocked(storage).mockResolvedValue([]);
    vi.mocked(proposeAvailability).mockResolvedValue({ status: 'unavailable', evidence: 'Reply.', matchesUnitAndDates: true, tenantsRenewing: false, leaseSigned: false });
    await recordReply(inquiry, message);
    expect(storage).toHaveBeenCalledWith('rpc/apply_listing_availability_reply', '', expect.any(Object));
  });
  it('passes newer availability corrections to the atomic update', async () => {
    vi.mocked(storage).mockResolvedValue([]);
    vi.mocked(proposeAvailability).mockResolvedValue({ status: 'available', evidence: 'Yes, available.', matchesUnitAndDates: true, tenantsRenewing: false, leaseSigned: false });
    await recordReply(inquiry, message);
    expect(storage).toHaveBeenCalledWith('rpc/apply_listing_availability_reply', '', expect.any(Object));
  });
  it('ignores a message for another inbox', async () => { await recordReply(inquiry, { ...message, inbox_id: 'other' }); expect(storage).not.toHaveBeenCalled(); });
  it('deduplicates a repeated webhook before invoking AI', async () => { vi.mocked(storage).mockResolvedValue([{}]); await recordReply(inquiry, message); expect(proposeAvailability).not.toHaveBeenCalled(); expect(storage).toHaveBeenCalledTimes(1); });
  it('stores unexpected senders without AI or publication', async () => {
    vi.mocked(storage).mockResolvedValue([]);
    await recordReply(inquiry, { ...message, from: 'someone@example.com' });
    expect(proposeAvailability).not.toHaveBeenCalled();
    expect(storage).toHaveBeenCalledWith('availability_replies', expect.any(String), expect.objectContaining({ body: expect.stringContaining('"expected_sender":false') }));
    expect(vi.mocked(storage).mock.calls.some(call => call[0] === 'availability_confirmations')).toBe(false);
  });
  it.each(['spam', 'blocked', 'unauthenticated'])('rejects flagged mail: %s', label => expect(safeIncoming({ ...message, labels: ['received', label] }, inquiry.recipient)).toBe(false));
  it('prevents an ordinary group member from publishing', async () => { vi.mocked(canReview).mockReturnValue(false); await expect(publishConfirmation('user', inquiry.id, message.message_id, 'available')).rejects.toThrow('reviewer'); expect(storage).not.toHaveBeenCalled(); });
  it('prevents test emails from changing public availability', async () => { vi.mocked(canReview).mockReturnValue(true); vi.mocked(storage).mockResolvedValue([{ ...inquiry, is_test: true }]); await expect(publishConfirmation('user', inquiry.id, message.message_id, 'available')).rejects.toThrow('Test messages'); });
  it('does not refresh an old reply into a new confirmation', async () => {
    vi.mocked(canReview).mockReturnValue(true); vi.mocked(storage).mockResolvedValueOnce([inquiry]).mockResolvedValueOnce([{ expected_sender: true, received_at: '2000-01-01T00:00:00Z' }]);
    await expect(publishConfirmation('user', inquiry.id, message.message_id, 'available')).rejects.toThrow('too old');
  });
});
describe('email contract', () => {
  it('requires a question', () => expect(inquiryInput.safeParse({ listingId: '11111111-1111-4111-8111-111111111111', question: ' ' }).success).toBe(false));
  it('rejects edited subjects with newlines', () => expect(emailEdit.safeParse({ subject: 'Hi\nBcc: x', body: 'Hello' }).success).toBe(false));
  it('keeps the question in the fallback email', () => expect(fallbackEmail('123 Main, unit 2', 'Is parking included?').body).toContain('Is parking included?'));
  it('saves edits to a draft before sending it', async () => {
    vi.mocked(storage).mockResolvedValueOnce([inquiry]).mockResolvedValue([]);
    vi.mocked(agentmail).mockResolvedValue({} as never);
    await sendInquiry('user-1', inquiry.id, { subject: 'New', body: 'Edited' }).catch(() => undefined);
    expect(storage).toHaveBeenCalledWith('availability_inquiries', 'id=eq.id-1&status=eq.draft', { method: 'PATCH', body: JSON.stringify({ subject: 'New', body: 'Edited' }) });
  });
});

describe('agent follow-up replies', () => {
  const followup = { id: 'f-1', inquiry_id: inquiry.id, reply_message_id: 'reply-1', body: 'Draft', status: 'draft', sent_by: null, sent_at: null, created_at: '' };
  it('stores an agent draft for a reply from the landlord', async () => {
    vi.mocked(storage).mockResolvedValue([]);
    vi.mocked(draftFollowup).mockResolvedValue('Thanks! What are the next steps?');
    await recordReply(inquiry, message);
    expect(storage).toHaveBeenCalledWith('availability_followups', 'on_conflict=reply_message_id', expect.objectContaining({ body: JSON.stringify({ inquiry_id: inquiry.id, reply_message_id: 'reply-1', body: 'Thanks! What are the next steps?' }) }));
  });
  it('does not draft replies to unexpected senders', async () => {
    vi.mocked(storage).mockResolvedValue([]);
    await recordReply(inquiry, { ...message, from: 'someone@example.com' });
    expect(draftFollowup).not.toHaveBeenCalled();
  });
  it('sends the edited draft as a reply in the landlord thread', async () => {
    vi.mocked(storage).mockResolvedValueOnce([followup]).mockResolvedValueOnce([{ ...inquiry, status: 'reply_received' }]).mockResolvedValueOnce([followup]).mockResolvedValueOnce([]);
    vi.mocked(agentmail).mockResolvedValue({ message_id: 'out-2' } as never);
    await sendFollowup('user-1', 'f-1', 'Edited');
    expect(agentmail).toHaveBeenCalledWith(`inboxes/${encodeURIComponent(inquiry.inbox_id!)}/messages/reply-1/reply`, expect.objectContaining({ headers: { 'Idempotency-Key': 'followup-f-1' }, body: JSON.stringify({ text: 'Edited', labels: ['availability-id-1'] }) }));
  });
  it('does not send a draft another member already claimed', async () => {
    vi.mocked(storage).mockResolvedValueOnce([followup]).mockResolvedValueOnce([inquiry]).mockResolvedValueOnce([]);
    await sendFollowup('user-1', 'f-1', 'Edited');
    expect(agentmail).not.toHaveBeenCalled();
  });
  it('refuses drafts outside the signed-in group', async () => {
    vi.mocked(storage).mockResolvedValueOnce([followup]).mockResolvedValueOnce([]);
    await expect(sendFollowup('user-2', 'f-1', 'Edited')).rejects.toThrow('not found');
    expect(agentmail).not.toHaveBeenCalled();
  });
});

describe('group inbox', () => {
  it('pulls replies for sent inquiries when the inbox loads', async () => {
    const sent = { ...inquiry, status: 'sent' as const };
    vi.mocked(storage).mockImplementation(async path => (path === 'availability_inquiries' ? [sent] : []) as never);
    vi.mocked(agentmail).mockResolvedValue({ messages: [] } as never);
    const inbox = await groupInbox('user-1');
    expect(agentmail).toHaveBeenCalledWith(`inboxes/${encodeURIComponent(inquiry.inbox_id!)}/threads/thread-1?limit=100`);
    expect(inbox.threads).toHaveLength(1);
  });
});
