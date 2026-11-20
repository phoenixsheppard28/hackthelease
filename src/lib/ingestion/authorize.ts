import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

/** Returns null when the request carries a valid Supabase token for an allowed email, else 401 or 403. */
export async function refreshAuthorizationError(request: Request): Promise<401 | 403 | null> {
  const jwksUrl = process.env.SUPABASE_JWKS_URL;
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!jwksUrl || !token) {
    return 401;
  }

  jwks ??= createRemoteJWKSet(new URL(jwksUrl));
  let email: unknown;
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
    });
    email = payload.email;
  } catch {
    return 401;
  }

  const allowedEmails = (process.env.REFRESH_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((allowed) => allowed.trim().toLowerCase())
    .filter(Boolean);
  return typeof email === 'string' && allowedEmails.includes(email.toLowerCase()) ? null : 403;
}
