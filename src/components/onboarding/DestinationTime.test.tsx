import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { DestinationTime } from './DestinationTime';

vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }));
beforeEach(() => { vi.stubGlobal('React', React); vi.mocked(useQuery).mockReturnValue({ data: undefined, isPending: false, isError: false } as ReturnType<typeof useQuery>); });
afterEach(() => vi.unstubAllGlobals());
function render(minutes: number | null, limit?: number) {
  return renderToStaticMarkup(<DestinationTime origin="123 Main St, Ann Arbor" destination="2200 Hayward St, Ann Arbor" loading={false} limit={limit}
    place={{ name: 'Leinweber', minutes, distanceMeters: 3000, status: minutes === null ? 'unavailable' : 'ok', checkedAt: null }} />);
}
it.each([20, 30, null])('does not request bus time for a %s-minute or unavailable walk', minutes => {
  render(minutes);
  expect(vi.mocked(useQuery).mock.lastCall?.[0].enabled).toBe(false);
});
it('switches a walk over 30 minutes to the actual bus duration', () => {
  vi.mocked(useQuery).mockReturnValue({ data: { routes: { bus: { durationMinutes: 17, distanceMeters: 4500 } } }, isPending: false, isError: false } as ReturnType<typeof useQuery>);
  const html = render(45, 20);
  expect(vi.mocked(useQuery).mock.lastCall?.[0].enabled).toBe(true);
  expect(html).toContain('17 min by bus');
  expect(html).toContain('Walking alternative: 45 min');
  expect(html).toContain('25 min over your 20 min walking preference');
});
it('keeps the walk when Google has no bus route', () => {
  vi.mocked(useQuery).mockReturnValue({ data: { routes: { bus: null } }, isPending: false, isError: false } as ReturnType<typeof useQuery>);
  const html = render(45);
  expect(html).toContain('45 min'); expect(html).toContain('No bus route found'); expect(html).not.toContain('min by bus');
});
it('keeps walking evidence on a bus lookup failure', () => {
  vi.mocked(useQuery).mockReturnValue({ isPending: false, isError: true } as ReturnType<typeof useQuery>);
  expect(render(45)).toContain('Bus estimate unavailable; showing walk');
});
