import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { proposeAvailability } from './proposal';
import type { Inquiry } from './contracts';

const inquiry = { body: 'Is 1709 S University available from 2027-08-01 to 2028-08-01?' } as Inquiry;
function response(proposal: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(proposal) }] }] })));
}
beforeEach(() => vi.stubEnv('OPENAI_API_KEY', 'test'));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('renewal evidence extraction', () => {
  it('accepts explicit signed-lease evidence separately from renewal', async () => {
    const evidence = 'A new tenant has already signed the lease for those dates.';
    response({ status: 'unavailable', evidence, matchesUnitAndDates: true, tenantsRenewing: false, leaseSigned: true });
    const result = await proposeAvailability(inquiry, evidence);
    expect(result?.leaseSigned).toBe(true);
    expect(result?.tenantsRenewing).toBe(false);
  });
  it('rejects a signed-lease classification that contradicts availability', async () => {
    response({ status: 'available', evidence: 'No one has signed yet.', matchesUnitAndDates: true, tenantsRenewing: false, leaseSigned: true });
    expect(await proposeAvailability(inquiry, 'No one has signed yet.')).toBeNull();
  });
  it('accepts explicit renewal evidence for the requested unit and dates', async () => {
    const evidence = 'The current tenants have renewed for those dates.';
    response({ status: 'unavailable', evidence, matchesUnitAndDates: true, tenantsRenewing: true });
    expect((await proposeAvailability(inquiry, evidence))?.tenantsRenewing).toBe(true);
    const payload = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(payload.instructions).toContain('re-leasing');
    expect(payload.text.format.schema.required).toContain('tenantsRenewing');
  });
  it.each([
    { status: 'available', matchesUnitAndDates: true },
    { status: 'renewal_undecided', matchesUnitAndDates: true },
    { status: 'unavailable', matchesUnitAndDates: false },
  ])('rejects inconsistent or ambiguous renewal output: %o', async values => {
    response({ ...values, evidence: 'Tenants are renewing.', tenantsRenewing: true });
    expect(await proposeAvailability(inquiry, 'Tenants are renewing.')).toBeNull();
  });
  it('rejects evidence invented by the classifier', async () => {
    response({ status: 'unavailable', evidence: 'Tenants are renewing.', matchesUnitAndDates: true, tenantsRenewing: true });
    expect(await proposeAvailability(inquiry, 'Tenants are leaving.')).toBeNull();
  });
  it('does not label general unavailability as renewal', async () => {
    response({ status: 'unavailable', evidence: 'The property is being renovated.', matchesUnitAndDates: true, tenantsRenewing: false });
    expect((await proposeAvailability(inquiry, 'The property is being renovated.'))?.tenantsRenewing).toBe(false);
  });
});
