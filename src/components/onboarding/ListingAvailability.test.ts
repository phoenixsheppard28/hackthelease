import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingAvailability } from './ListingAvailability';
import { currentListingAvailability, type ListingAvailability as Report } from '@/lib/availability/listing-status';
const report: Report = { source: 'landlord_email', status: 'tenants_renewing', reportedAt: '2026-11-20T12:00:00Z', leaseStart: '2027-08-01', leaseEnd: '2028-08-01' };
beforeEach(() => { vi.stubGlobal('React', React); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-20T13:00:00Z')); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const render = (value: Report | null, compact = false) => renderToStaticMarkup(React.createElement(ListingAvailability, { report: value, compact }));

describe('tenant renewal listing flag', () => {
  it('marks a signed lease as unavailable on cards and details', () => {
    const signed = { ...report, status: 'lease_signed' as const };
    for (const compact of [false, true]) {
      expect(render(signed, compact)).toContain('Not available · Lease signed');
      expect(render(signed, compact)).not.toContain('Tenants renewing');
    }
  });
  it('shows the same label on cards and details, with source and lease dates', () => {
    expect(render(report, true)).toContain('Tenants renewing');
    const html = render(report);
    expect(html).toContain('Landlord email');
    expect(html).toContain('2027-08-01 to 2028-08-01');
    expect(html).toContain('Nov 20, 2026');
  });
  it('does not misrepresent a user report as landlord confirmation', () => {
    const html = render({ ...report, source: 'user_report', leaseStart: null, leaseEnd: null });
    expect(html).toContain('User reported');
    expect(html).toContain('Lease dates not specified');
    expect(html).not.toContain('Landlord email');
  });
  it('hides missing, corrected, expired, and ended-term reports', () => {
    for (const value of [null, { ...report, status: 'available' as const }, { ...report, reportedAt: '2026-10-20T12:00:00Z' }, { ...report, leaseEnd: '2026-11-19' }]) {
      expect(currentListingAvailability(value)).toBeNull();
      expect(render(value)).toBe('');
    }
  });
});
