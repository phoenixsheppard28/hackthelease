import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Svix's documented raw-body HMAC protocol; never parse before verification.
export function validMailSignature(body: string, headers: Headers, secret: string, now = Date.now()) {
  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signatures = headers.get('svix-signature');
  if (!id || !timestamp || !/^\d+$/.test(timestamp) || !signatures || !secret.startsWith('whsec_')) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const key = Buffer.from(secret.slice(6), 'base64');
  if (!key.length) return false;
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();
  return signatures.split(' ').some(signature => {
    const [version, value] = signature.split(',');
    if (version !== 'v1' || !value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
    const actual = Buffer.from(value, 'base64');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}
