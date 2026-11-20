import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { validMailSignature } from './webhook';
const secret = 'whsec_' + Buffer.from('test-secret').toString('base64');
const now = 1800000000000;
const body = '{"event_type":"message.received"}';
function headers(time = now / 1000) {
  const signature = createHmac('sha256', Buffer.from('test-secret')).update(`event-1.${time}.${body}`).digest('base64');
  return new Headers({ 'svix-id': 'event-1', 'svix-timestamp': String(time), 'svix-signature': `v1,${signature}` });
}
describe('signed mail webhook', () => {
  it('accepts an authentic recent raw body', () => expect(validMailSignature(body, headers(), secret, now)).toBe(true));
  it('rejects tampered content', () => expect(validMailSignature(body + ' ', headers(), secret, now)).toBe(false));
  it.each([-301, 301])('rejects timestamps outside the replay window: %s', offset => expect(validMailSignature(body, headers(now / 1000 + offset), secret, now)).toBe(false));
  it('requires signatures and a configured secret', () => {
    expect(validMailSignature(body, new Headers(), secret, now)).toBe(false);
    expect(validMailSignature(body, headers(), '', now)).toBe(false);
  });
  it('supports overlapping signing keys', () => {
    const signed = headers();
    signed.set('svix-signature', 'v1,bad v2,ignored ' + signed.get('svix-signature'));
    expect(validMailSignature(body, signed, secret, now)).toBe(true);
  });
});
