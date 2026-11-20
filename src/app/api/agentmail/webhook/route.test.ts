import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/availability/storage', () => ({ storage: vi.fn() }));
vi.mock('@/lib/availability/service', () => ({ recordReply: vi.fn() }));
vi.mock('@/lib/availability/agentmail', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/availability/agentmail')>(), agentmail: vi.fn() }));
import { storage } from '@/lib/availability/storage';
import { agentmail } from '@/lib/availability/agentmail';
import { recordReply } from '@/lib/availability/service';
import { POST } from './route';
const body = JSON.stringify({ event_type: 'message.received', message: { inbox_id: 'inbox-1', thread_id: 'thread-1', message_id: 'message-1', text: 'Untrusted webhook body' } });
function request(signed: boolean) {
  const time = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', Buffer.from('test-secret')).update(`event-1.${time}.${body}`).digest('base64');
  return new Request('https://homework.test/api/agentmail/webhook', { method: 'POST', body, headers: signed ? { 'svix-id': 'event-1', 'svix-timestamp': String(time), 'svix-signature': `v1,${signature}` } : {} });
}
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('AGENTMAIL_WEBHOOK_SECRET', 'whsec_' + Buffer.from('test-secret').toString('base64')); });
afterEach(() => vi.unstubAllEnvs());
describe('AgentMail delivery webhook', () => {
  it('rejects unsigned requests before reading private data', async () => { expect((await POST(request(false))).status).toBe(401); expect(storage).not.toHaveBeenCalled(); });
  it('fetches canonical message content before recording a known thread', async () => {
    const inquiry = { id: 'inquiry-1' };
    const message = { inbox_id: 'inbox-1', thread_id: 'thread-1', message_id: 'message-1', from: 'landlord@example.com', timestamp: new Date().toISOString(), labels: ['received'], text: 'Canonical reply' };
    vi.mocked(storage).mockResolvedValue([inquiry]); vi.mocked(agentmail).mockResolvedValue(message);
    expect((await POST(request(true))).status).toBe(204);
    expect(recordReply).toHaveBeenCalledWith(inquiry, message);
  });
  it('ignores unknown conversations', async () => { vi.mocked(storage).mockResolvedValue([]); expect((await POST(request(true))).status).toBe(204); expect(agentmail).not.toHaveBeenCalled(); });
  it('requests redelivery after a transient storage failure', async () => { vi.mocked(storage).mockRejectedValue(new Error('timeout')); expect((await POST(request(true))).status).toBe(503); });
});
