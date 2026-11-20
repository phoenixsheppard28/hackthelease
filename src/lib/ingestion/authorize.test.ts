import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshAuthorizationError } from './authorize';

const supabaseUrl = 'https://project.supabase.co';
let privateKey: CryptoKey;

async function token(email: string, issuer = `${supabaseUrl}/auth/v1`): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'ES256', kid: 'key-1' })
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setExpirationTime('5m')
    .sign(privateKey);
}

function request(authorization?: string): Request {
  return new Request('http://localhost/api/refresh', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
  });
}

beforeAll(async () => {
  const keys = await generateKeyPair('ES256');
  privateKey = keys.privateKey;
  const publicJwk = { ...(await exportJWK(keys.publicKey)), kid: 'key-1', alg: 'ES256' };
  vi.stubGlobal('fetch', async () => Response.json({ keys: [publicJwk] }));
});

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', supabaseUrl);
  vi.stubEnv('SUPABASE_JWKS_URL', `${supabaseUrl}/auth/v1/.well-known/jwks.json`);
  vi.stubEnv('REFRESH_ALLOWED_EMAILS', 'team@example.com, lead@example.com');
});

describe('refreshAuthorizationError', () => {
  it('allows a valid token for an allowed email', async () => {
    expect(await refreshAuthorizationError(request(`Bearer ${await token('Lead@example.com')}`))).toBeNull();
  });

  it('returns 401 without a bearer token', async () => {
    expect(await refreshAuthorizationError(request())).toBe(401);
  });

  it('returns 401 for a token from another issuer', async () => {
    const forged = await token('team@example.com', 'https://evil.example.com/auth/v1');

    expect(await refreshAuthorizationError(request(`Bearer ${forged}`))).toBe(401);
  });

  it('returns 403 for a valid token with an email that is not allowed', async () => {
    expect(await refreshAuthorizationError(request(`Bearer ${await token('student@example.com')}`))).toBe(403);
  });
});
