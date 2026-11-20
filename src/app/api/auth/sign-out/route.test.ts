import { beforeEach, expect, it, vi } from 'vitest';
import { POST } from './route';

const { signOut, deleteCookie } = vi.hoisted(() => ({ signOut: vi.fn(), deleteCookie: vi.fn() }));
vi.mock('@/lib/supabase/auth', () => ({ authClient: async () => ({ auth: { signOut } }) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ delete: deleteCookie }) }));
beforeEach(() => { signOut.mockReset(); deleteCookie.mockReset(); });

it('confirms a successful sign out', async () => {
  signOut.mockResolvedValue({ error: null });
  const response = await POST();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ signedOut: true });
  expect(deleteCookie).toHaveBeenCalledWith({ name: 'housing_calendar_token', path: '/api/calendar' });
  expect(deleteCookie).toHaveBeenCalledWith({ name: 'housing_calendar_owner', path: '/api/calendar' });
});

it('does not report success when Supabase rejects sign out', async () => {
  signOut.mockResolvedValue({ error: { message: 'Service unavailable' } });
  const response = await POST();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Could not sign out. Please try again.' });
  expect(deleteCookie).not.toHaveBeenCalled();
});
