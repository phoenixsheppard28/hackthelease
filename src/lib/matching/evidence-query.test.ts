import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { listingEvidenceOptions } from './evidence-query';
import { previewProfile } from './preview-profile';
import { reweightMatches } from './location-score';
import { rankCatalog } from './catalog-matches';
import { demoListings } from '../fixtures/listings';

afterEach(() => vi.unstubAllGlobals());

it('fetches evidence once across slider changes, detail navigation, and return to shortlist', async () => {
  const client = new QueryClient();
  const data = rankCatalog(previewProfile, previewProfile.weights, [{ listing: demoListings[0], isDemo: false, embedding: null, images: [], refreshedAt: '2026-11-20' }], null);
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(data)));
  vi.stubGlobal('fetch', fetchMock);
  const options = listingEvidenceOptions(client, 'student-1', previewProfile);
  const evidence = await client.fetchQuery(options);
  for (let value = 0; value <= 100; value++) reweightMatches(evidence.matches, { ...previewProfile.weights, Location: value });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const detail = new QueryObserver(client, listingEvidenceOptions(client, 'student-1', previewProfile, data.matches[0].id));
  const unsubscribe = detail.subscribe(() => {});
  expect(detail.getCurrentResult().data?.matches).toHaveLength(1);
  expect(detail.getCurrentResult().isFetching).toBe(false);
  await client.fetchQuery(listingEvidenceOptions(client, 'student-1', previewProfile));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  // A changed walking preference needs fresh evidence, unlike a results slider.
  const changed = listingEvidenceOptions(client, 'student-1', { ...previewProfile, walk: {} });
  expect(changed.queryKey).not.toEqual(options.queryKey);
  unsubscribe(); client.clear();
});
