import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/auth', () => ({ currentStudent: vi.fn() }));
vi.mock('@/lib/availability/service', () => ({ availabilityView: vi.fn(), createInquiry: vi.fn(), publishConfirmation: vi.fn(), sendInquiry: vi.fn(), syncInquiry: vi.fn() }));
import { currentStudent } from '@/lib/supabase/auth';
import { availabilityView, createInquiry, sendInquiry, publishConfirmation } from '@/lib/availability/service';
import { AvailabilityError } from '@/lib/availability/storage';
import { GET, POST } from './route';
const id = '11111111-1111-4111-8111-111111111111';
function request(data: unknown) { return new Request('https://homework.test/api/availability', { method: 'POST', body: JSON.stringify(data) }); }
beforeEach(() => { vi.resetAllMocks(); vi.mocked(currentStudent).mockResolvedValue({ id: 'user-1', email: 'student@example.com' }); });
describe('availability API authorization', () => {
  it('requires sign-in before reading or sending', async () => {
    vi.mocked(currentStudent).mockResolvedValue(null);
    expect((await GET(new Request(`https://homework.test/api/availability?listingId=${id}`))).status).toBe(401);
    expect((await POST(request({ action: 'send', inquiryId: id, approved: true }))).status).toBe(401);
    expect(availabilityView).not.toHaveBeenCalled(); expect(sendInquiry).not.toHaveBeenCalled();
  });
  it('requires explicit send approval', async () => {
    expect((await POST(request({ action: 'send', inquiryId: id }))).status).toBe(400);
    expect(sendInquiry).not.toHaveBeenCalled();
  });
  it('requires the reviewer to acknowledge unit and dates', async () => {
    expect((await POST(request({ action: 'confirm', inquiryId: id, messageId: 'reply-1', status: 'available' }))).status).toBe(400);
    expect(publishConfirmation).not.toHaveBeenCalled();
  });
  it('does not accept a recipient or group override from the browser', async () => {
    await POST(request({ action: 'draft', input: { listingId: id, leaseStart: '2027-08-01', leaseEnd: '2028-08-01', recipient: 'attacker@example.com', groupId: 'other-group' } }));
    expect(createInquiry).toHaveBeenCalledWith('user-1', { listingId: id, leaseStart: '2027-08-01', leaseEnd: '2028-08-01' });
  });
  it('returns ownership errors without leaking another group', async () => {
    vi.mocked(sendInquiry).mockRejectedValue(new AvailabilityError('Inquiry not found.', 404));
    const response = await POST(request({ action: 'send', inquiryId: id, approved: true }));
    expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: 'Inquiry not found.' });
  });
  it('does not expose unexpected provider errors', async () => {
    vi.mocked(sendInquiry).mockRejectedValue(new Error('secret internal provider payload'));
    const response = await POST(request({ action: 'send', inquiryId: id, approved: true }));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret');
  });
});
