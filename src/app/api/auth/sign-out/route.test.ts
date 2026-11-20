import { beforeEach, expect, it, vi } from 'vitest';
import { POST } from './route';

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock('@/lib/supabase/auth', () => ({ authClient: async () => ({ auth: { signOut } }) }));
beforeEach(() => signOut.mockReset());

it('confirms a successful sign out', async () => {
  signOut.mockResolvedValue({ error: null });
  const response = await POST();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ signedOut: true });
});

it('does not report success when Supabase rejects sign out', async () => {
  signOut.mockResolvedValue({ error: { message: 'Service unavailable' } });
  const response = await POST();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Could not sign out. Please try again.' });
});
