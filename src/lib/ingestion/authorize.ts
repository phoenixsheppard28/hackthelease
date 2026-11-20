import 'server-only';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

/** Returns null when the request carries a valid Supabase token for an allowed user, else 401 or 403. */
export async function refreshAuthorizationError(request: Request): Promise<401 | 403 | null> {
  const jwksUrl = process.env.SUPABASE_JWKS_URL;
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!jwksUrl || !token) {
    return 401;
  }

  jwks ??= createRemoteJWKSet(new URL(jwksUrl));
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, jwks, {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
    }));
  } catch {
    return 401;
  }

  // Authorize on the user id: the email claim can be unconfirmed.
  const allowedUserIds = (process.env.REFRESH_ALLOWED_USER_IDS ?? '')
    .split(',')
    .map((allowed) => allowed.trim())
    .filter(Boolean);
  const isAllowed =
    payload.role === 'authenticated' &&
    payload.is_anonymous !== true &&
    typeof payload.sub === 'string' &&
    allowedUserIds.includes(payload.sub);
  return isAllowed ? null : 403;
}
