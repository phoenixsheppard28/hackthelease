import 'server-only';

export class AvailabilityError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function storage<T>(path: string, query = '', init: RequestInit = {}): Promise<T> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new AvailabilityError('Availability storage is not configured.', 503);
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}${query ? '?' + query : ''}`, {
    ...init, headers: { apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }), 'Content-Type': 'application/json', Prefer: 'return=representation', ...init.headers },
    cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    if (response.status === 404) throw new AvailabilityError('Availability setup is pending. Apply the availability database migration.', 503);
    if (response.status === 409) throw new AvailabilityError('An availability inquiry for these dates is already pending.', 409);
    if (path === 'rpc/apply_listing_availability_reply') throw new AvailabilityError('The reply was saved, but the listing flag could not be updated. Check replies to retry.', 503);
    if (path.startsWith('rpc/')) throw new AvailabilityError('Could not reserve this inquiry. Check for a recent confirmation, a pending inquiry, or the group limit of five emails per day.', 409);
    throw new AvailabilityError('Could not access availability records. Please retry.', 503);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}
export async function memberGroup(userId: string): Promise<string | null> {
  const [member] = await storage<{ group_id: string }[]>('housing_group_members', `select=group_id&user_id=eq.${encodeURIComponent(userId)}`);
  return member?.group_id ?? null;
}
export function canReview(userId: string) {
  return (process.env.AVAILABILITY_REVIEWER_USER_IDS ?? '').split(',').map(value => value.trim()).filter(Boolean).includes(userId);
}
