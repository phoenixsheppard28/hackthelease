import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshAuthorizationError } from './authorize';

vi.mock('server-only', () => ({}));

const supabaseUrl = 'https://project.supabase.co';
const allowedUserId = '8a6f3e2c-1b4d-4f0a-9c7e-2d5b6a8f1e30';
let privateKey: CryptoKey;

type TokenOptions = {
  claims?: JWTPayload;
  issuer?: string;
  audience?: string;
  expiresAt?: number | string;
};

async function token({
  claims = {},
  issuer = `${supabaseUrl}/auth/v1`,
  audience = 'authenticated',
  expiresAt = '5m',
}: TokenOptions = {}): Promise<string> {
  return new SignJWT({ sub: allowedUserId, role: 'authenticated', is_anonymous: false, ...claims })
    .setProtectedHeader({ alg: 'ES256', kid: 'key-1' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime(expiresAt)
    .sign(privateKey);
}

function request(authorization?: string): Request {
  return new Request('http://localhost/api/refresh', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
  });
}

async function authorize(options?: TokenOptions) {
  return refreshAuthorizationError(request(`Bearer ${await token(options)}`));
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
  vi.stubEnv('REFRESH_ALLOWED_USER_IDS', `00000000-0000-4000-8000-000000000000, ${allowedUserId}`);
});

describe('refreshAuthorizationError', () => {
  it('allows a valid token for an allowed user id', async () => {
    expect(await authorize()).toBeNull();
  });

  it('returns 401 without a bearer token', async () => {
    expect(await refreshAuthorizationError(request())).toBe(401);
  });

  it('returns 401 for a token from another issuer', async () => {
    expect(await authorize({ issuer: 'https://evil.example.com/auth/v1' })).toBe(401);
  });

  it('returns 401 for a token with the wrong audience', async () => {
    expect(await authorize({ audience: 'anon' })).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    expect(await authorize({ expiresAt: Math.floor(Date.now() / 1000) - 60 })).toBe(401);
  });

  it('returns 403 for a user id that is not allowed', async () => {
    expect(await authorize({ claims: { sub: '11111111-1111-4111-8111-111111111111' } })).toBe(403);
  });

  it('returns 403 for an anonymous user, even with an allowed user id', async () => {
    expect(await authorize({ claims: { is_anonymous: true } })).toBe(403);
  });

  it('returns 403 for a token whose role is not authenticated', async () => {
    expect(await authorize({ claims: { role: 'service_role' } })).toBe(403);
  });

  it('does not authorize on an allowlisted email claim', async () => {
    vi.stubEnv('REFRESH_ALLOWED_USER_IDS', 'team@example.com');

    expect(await authorize({ claims: { email: 'team@example.com' } })).toBe(403);
  });
});
