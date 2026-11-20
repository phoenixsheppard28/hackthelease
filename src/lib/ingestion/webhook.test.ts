import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as embeddings from '../embeddings/listings';
import * as crawlRuns from '../supabase/crawl-runs';
import * as listings from '../supabase/listings';
import * as images from './images';
import { listingMergeKey } from '../supabase/listing-rows';
import { processFirecrawlEvent } from './webhook';

vi.mock('server-only', () => ({}));
vi.mock('../supabase/crawl-runs');
vi.mock('../supabase/listings');
vi.mock('../embeddings/listings');
vi.mock('./images');

const secret = 'test-webhook-secret';
const runSourceId = '6f1c2b8e-4a0d-4c47-9a53-0d6c1f2e7b10';

const runSourceRow = {
  id: runSourceId,
  inventoryUrl: 'https://example.com/inventory',
  crawl_run_id: 'run-1',
  source_id: 'source-1',
  status: 'running' as const,
  firecrawl_job_id: 'job-1',
  discovered: 0,
  processed: 0,
  new_listings: 0,
  updated_listings: 0,
  rent_changes: 0,
  failed_pages: 0,
  error: null,
  started_at: '2026-11-19T20:00:00Z',
  finished_at: null,
};

const extractedListing = {
  address: '625 South State Street, Ann Arbor, MI',
  unit: 'Apt 2B',
  rentMin: 980,
  rentMax: 980,
  rentBasis: 'per_person',
  recurringFeesMonthly: null,
  beds: 2,
  availableFrom: '2027-08-20',
  accessible: null,
  amenities: [{ name: 'laundry', available: true }],
  features: ['Shared kitchen'],
  description: 'Two bedroom near campus.',
  contact: null,
};

function sign(body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

function pageEvent(url: string, json: unknown): string {
  return JSON.stringify({
    success: true,
    type: 'crawl.page',
    id: 'job-1',
    data: [{ json, metadata: { url, sourceURL: url } }],
    metadata: { crawlRunSourceId: runSourceId },
  });
}

function eventOfType(type: string, extra: object = {}): string {
  return JSON.stringify({
    success: true,
    type,
    id: 'job-1',
    data: [],
    metadata: { crawlRunSourceId: runSourceId },
    ...extra,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('FIRECRAWL_WEBHOOK_SECRET', secret);
  vi.mocked(crawlRuns.getCrawlRunSource).mockResolvedValue(runSourceRow);
  vi.mocked(crawlRuns.getCrawlRunStatus).mockResolvedValue(null);
  vi.mocked(listings.recordObservedListing).mockResolvedValue({
    listingId: 'listing-1',
    wasInserted: true,
    rentChanged: false,
  });
});

describe('processFirecrawlEvent signature check', () => {
  it('rejects a forged signature without any database call', async () => {
    const body = pageEvent('https://example.com/a', { isListingPage: true, listing: extractedListing });

    const result = await processFirecrawlEvent(body, `sha256=${'0'.repeat(64)}`);

    expect(result).toEqual({ status: 'unauthorized' });
    expect(crawlRuns.getCrawlRunSource).not.toHaveBeenCalled();
    expect(crawlRuns.storeObservation).not.toHaveBeenCalled();
  });

  it('rejects a missing or malformed signature', async () => {
    const body = eventOfType('crawl.completed');

    expect(await processFirecrawlEvent(body, null)).toEqual({ status: 'unauthorized' });
    expect(await processFirecrawlEvent(body, 'sha256=abc')).toEqual({ status: 'unauthorized' });
    expect(crawlRuns.getCrawlRunSource).not.toHaveBeenCalled();
  });

  it('rejects a body changed after signing', async () => {
    const body = eventOfType('crawl.completed');

    const result = await processFirecrawlEvent(body.replace('job-1', 'job-2'), sign(body));

    expect(result).toEqual({ status: 'unauthorized' });
    expect(crawlRuns.getCrawlRunSource).not.toHaveBeenCalled();
  });
});

describe('processFirecrawlEvent input checks', () => {
  it('rejects a valid signature with extra non-hex characters', async () => {
    const body = eventOfType('crawl.completed');

    expect(await processFirecrawlEvent(body, `${sign(body)}zz`)).toEqual({ status: 'unauthorized' });
    expect(crawlRuns.getCrawlRunSource).not.toHaveBeenCalled();
  });

  it('rejects a run source id that is not a uuid without a database call', async () => {
    const body = JSON.stringify({
      success: true,
      type: 'crawl.completed',
      id: 'job-1',
      data: [],
      metadata: { crawlRunSourceId: 'not-a-uuid' },
    });

    expect(await processFirecrawlEvent(body, sign(body))).toEqual({ status: 'invalid' });
    expect(crawlRuns.getCrawlRunSource).not.toHaveBeenCalled();
  });
});

describe('processFirecrawlEvent page events', () => {
  it('does not publish a listing extracted from the inventory page', async () => {
    vi.mocked(crawlRuns.storeObservation).mockResolvedValue('observation-1');
    const body = pageEvent(runSourceRow.inventoryUrl, { isListingPage: true, listing: extractedListing });

    expect(await processFirecrawlEvent(body, sign(body))).toEqual({ status: 'processed' });
    expect(listings.recordObservedListing).not.toHaveBeenCalled();
  });

  it('ignores page events after the run source failed', async () => {
    vi.mocked(crawlRuns.getCrawlRunSource).mockResolvedValue({ ...runSourceRow, status: 'failed' });
    const body = pageEvent('https://example.com/a', { isListingPage: true, listing: extractedListing });

    expect(await processFirecrawlEvent(body, sign(body))).toEqual({ status: 'duplicate' });
    expect(crawlRuns.storeObservation).not.toHaveBeenCalled();
  });

  it('stores the observation, upserts the listing with the source id, and counts once', async () => {
    vi.mocked(crawlRuns.storeObservation).mockResolvedValue('observation-1');
    const body = pageEvent('https://example.com/a', { isListingPage: true, listing: extractedListing });

    const result = await processFirecrawlEvent(body, sign(body));

    expect(result).toEqual({ status: 'processed' });
    expect(listings.recordObservedListing).toHaveBeenCalledWith(
      expect.objectContaining({
        address: extractedListing.address,
        unit: 'Apt 2B',
        sources: [expect.objectContaining({ url: 'https://example.com/a' })],
      }),
      'source-1',
      'observation-1',
      runSourceId,
    );
    expect(crawlRuns.incrementCrawlRunSourceCounts).not.toHaveBeenCalled();
  });

  it('embeds the recorded listing when its embedding is missing', async () => {
    vi.mocked(crawlRuns.storeObservation).mockResolvedValue('observation-1');
    const unembedded = [{ listing: {} as never, isDemo: false, searchableText: 'text', textHash: 'hash', embedding: null }];
    vi.mocked(listings.listUnembeddedListings).mockResolvedValue(unembedded);
    const body = pageEvent('https://example.com/a', { isListingPage: true, listing: extractedListing });

    await processFirecrawlEvent(body, sign(body));

    expect(listings.listUnembeddedListings).toHaveBeenCalledWith(['listing-1']);
    expect(embeddings.embedMissingListings).toHaveBeenCalledWith(unembedded);
  });

  it('stores extracted images for the recorded listing', async () => {
    vi.mocked(crawlRuns.storeObservation).mockResolvedValue('observation-1');
    const body = pageEvent('https://example.com/a', {
      isListingPage: true,
      listing: { ...extractedListing, imageUrls: ['https://images.example.com/home.jpg'] },
    });

    await processFirecrawlEvent(body, sign(body));

    expect(images.storeListingImages).toHaveBeenCalledWith('listing-1', ['https://images.example.com/home.jpg']);
  });

  it('logs an embedding failure and still processes the page', async () => {
    vi.mocked(crawlRuns.storeObservation).mockResolvedValue('observation-1');
    vi.mocked(listings.listUnembeddedListings).mockResolvedValue([]);
    vi.mocked(embeddings.embedMissingListings).mockRejectedValue(new Error('OpenAI is down'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const body = pageEvent('https://example.com/a', { isListingPage: true, listing: extractedListing });

    const result = await processFirecrawlEvent(body, sign(body));

    expect(result).toEqual({ status: 'processed' });
    expect(consoleError).toHaveBeenCalledWith('Listing embedding failed: OpenAI is down');
    consoleError.mockRestore();
  });

  it('reports a duplicate when a concurrent delivery already claimed the observation', async () => {
    vi.mocked(crawlRuns.storeObservation).mockResolvedValue(null);
    vi.mocked(crawlRuns.findObservation).mockResolvedValue({
      id: 'observation-1',
      listing_id: null,
      normalized: { address: extractedListing.address },
    });
    vi.mocked(listings.recordObservedListing).mockResolvedValue(null);
    const body = pageEvent('https://example.com/a', { isListingPage: true, listing: extractedListing });

    const result = await processFirecrawlEvent(body, sign(body));

    expect(result).toEqual({ status: 'duplicate' });
    expect(crawlRuns.incrementCrawlRunSourceCounts).not.toHaveBeenCalled();
  });

  it('stores a page without json as a failed page with a non-null raw extraction', async () => {
    vi.mocked(crawlRuns.storeObservation).mockResolvedValue('observation-1');
    const body = JSON.stringify({
      success: true,
      type: 'crawl.page',
      id: 'job-1',
      data: [{ metadata: { url: 'https://example.com/a' } }],
      metadata: { crawlRunSourceId: runSourceId },
    });

    const result = await processFirecrawlEvent(body, sign(body));

    expect(result).toEqual({ status: 'processed' });
    expect(crawlRuns.storeObservation).toHaveBeenCalledWith(
      expect.objectContaining({ rawExtraction: {}, normalized: null }),
    );
    expect(crawlRuns.incrementCrawlRunSourceCounts).toHaveBeenCalledWith(runSourceId, {
      discovered: 1,
      processed: 1,
      failedPages: 1,
    });
  });

  it('treats a repeated, fully processed page event as a no-op', async () => {
    vi.mocked(crawlRuns.storeObservation).mockResolvedValue(null);
    vi.mocked(crawlRuns.findObservation).mockResolvedValue({
      id: 'observation-1',
      listing_id: 'listing-1',
      normalized: { address: extractedListing.address },
    });
    const body = pageEvent('https://example.com/a', { isListingPage: true, listing: extractedListing });

    const result = await processFirecrawlEvent(body, sign(body));

    expect(result).toEqual({ status: 'duplicate' });
    expect(listings.recordObservedListing).not.toHaveBeenCalled();
    expect(crawlRuns.incrementCrawlRunSourceCounts).not.toHaveBeenCalled();
  });

  it('finishes a page whose first delivery stored the observation but failed before the upsert', async () => {
    vi.mocked(crawlRuns.storeObservation).mockResolvedValue(null);
    vi.mocked(crawlRuns.findObservation).mockResolvedValue({
      id: 'observation-1',
      listing_id: null,
      normalized: { address: extractedListing.address },
    });
    const body = pageEvent('https://example.com/a', { isListingPage: true, listing: extractedListing });

    const result = await processFirecrawlEvent(body, sign(body));

    expect(result).toEqual({ status: 'processed' });
    expect(listings.recordObservedListing).toHaveBeenCalledWith(
      expect.anything(),
      'source-1',
      'observation-1',
      runSourceId,
    );
  });

  it('stores an invalid extraction and counts it as a failed page without an upsert', async () => {
    vi.mocked(crawlRuns.storeObservation).mockResolvedValue('observation-1');
    const body = pageEvent('https://example.com/a', {
      isListingPage: true,
      listing: { ...extractedListing, rentMin: 1200, rentMax: 900 },
    });

    const result = await processFirecrawlEvent(body, sign(body));

    expect(result).toEqual({ status: 'processed' });
    expect(crawlRuns.storeObservation).toHaveBeenCalledWith(
      expect.objectContaining({ pageUrl: 'https://example.com/a', normalized: null }),
    );
    expect(listings.recordObservedListing).not.toHaveBeenCalled();
    expect(crawlRuns.incrementCrawlRunSourceCounts).toHaveBeenCalledWith(runSourceId, {
      discovered: 1,
      processed: 1,
      failedPages: 1,
    });
  });

  it('does not count a repeated invalid extraction twice', async () => {
    vi.mocked(crawlRuns.storeObservation).mockResolvedValue(null);
    vi.mocked(crawlRuns.findObservation).mockResolvedValue({
      id: 'observation-1',
      listing_id: null,
      normalized: null,
    });
    const body = pageEvent('https://example.com/a', { isListingPage: true, listing: { address: '' } });

    const result = await processFirecrawlEvent(body, sign(body));

    expect(result).toEqual({ status: 'duplicate' });
    expect(crawlRuns.incrementCrawlRunSourceCounts).not.toHaveBeenCalled();
  });

  it('skips a page that is not a listing without a failure', async () => {
    vi.mocked(crawlRuns.storeObservation).mockResolvedValue('observation-1');
    const body = pageEvent('https://example.com/index', { isListingPage: false, listing: null });

    await processFirecrawlEvent(body, sign(body));

    expect(listings.recordObservedListing).not.toHaveBeenCalled();
    expect(crawlRuns.incrementCrawlRunSourceCounts).toHaveBeenCalledWith(runSourceId, {
      discovered: 1,
      processed: 1,
    });
  });

  it('reconciles two pages for the same address and unit into one merge key', async () => {
    vi.mocked(crawlRuns.storeObservation).mockResolvedValue('observation-1');
    const first = pageEvent('https://example.com/a', { isListingPage: true, listing: extractedListing });
    const second = pageEvent('https://example.com/b', {
      isListingPage: true,
      listing: { ...extractedListing, address: '625 S State St, Ann Arbor, MI', unit: '2b' },
    });
    const unitless = pageEvent('https://example.com/c', {
      isListingPage: true,
      listing: { ...extractedListing, unit: null },
    });

    await processFirecrawlEvent(first, sign(first));
    await processFirecrawlEvent(second, sign(second));
    await processFirecrawlEvent(unitless, sign(unitless));

    const keys = vi
      .mocked(listings.recordObservedListing)
      .mock.calls.map(([listing, sourceId]) => listingMergeKey(listing, sourceId));
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });
});

describe('processFirecrawlEvent crawl results', () => {
  it('marks the run source failed on a failed crawl and keeps prior listings', async () => {
    const body = eventOfType('crawl.failed', { success: false, error: 'Blocked by robots.txt' });

    const result = await processFirecrawlEvent(body, sign(body));

    expect(result).toEqual({ status: 'processed' });
    expect(crawlRuns.updateCrawlRunSource).toHaveBeenCalledWith(
      runSourceId,
      expect.objectContaining({ status: 'failed', error: 'Blocked by robots.txt' }),
    );
    expect(crawlRuns.deactivateStaleListings).not.toHaveBeenCalled();
    expect(crawlRuns.markSourceRefreshed).not.toHaveBeenCalled();
    expect(listings.recordObservedListing).not.toHaveBeenCalled();
  });

  it('marks the run source failed when a completed event reports no success', async () => {
    const body = eventOfType('crawl.completed', { success: false, error: 'Timed out' });

    await processFirecrawlEvent(body, sign(body));

    expect(crawlRuns.updateCrawlRunSource).toHaveBeenCalledWith(
      runSourceId,
      expect.objectContaining({ status: 'failed' }),
    );
    expect(crawlRuns.deactivateStaleListings).not.toHaveBeenCalled();
  });

  it('marks a clean crawl succeeded, records the refresh, and checks stale listings', async () => {
    const body = eventOfType('crawl.completed');

    await processFirecrawlEvent(body, sign(body));

    expect(crawlRuns.updateCrawlRunSource).toHaveBeenCalledWith(
      runSourceId,
      expect.objectContaining({ status: 'succeeded' }),
    );
    expect(crawlRuns.markSourceRefreshed).toHaveBeenCalledWith('source-1', expect.any(String));
    expect(crawlRuns.deactivateStaleListings).toHaveBeenCalledWith('source-1');
  });

  it('marks a crawl with failed pages partial and does not check stale listings', async () => {
    vi.mocked(crawlRuns.getCrawlRunSource).mockResolvedValue({ ...runSourceRow, failed_pages: 2 });
    const body = eventOfType('crawl.completed');

    await processFirecrawlEvent(body, sign(body));

    expect(crawlRuns.updateCrawlRunSource).toHaveBeenCalledWith(
      runSourceId,
      expect.objectContaining({ status: 'partial' }),
    );
    expect(crawlRuns.deactivateStaleListings).not.toHaveBeenCalled();
  });

  it('ignores a repeated completion for a finished run source', async () => {
    vi.mocked(crawlRuns.getCrawlRunSource).mockResolvedValue({ ...runSourceRow, status: 'succeeded' });
    const body = eventOfType('crawl.completed');

    const result = await processFirecrawlEvent(body, sign(body));

    expect(result).toEqual({ status: 'duplicate' });
    expect(crawlRuns.updateCrawlRunSource).not.toHaveBeenCalled();
  });

  it('closes the run when every source is finished', async () => {
    vi.mocked(crawlRuns.getCrawlRunStatus).mockResolvedValue({
      runId: 'run-1',
      status: 'running',
      startedAt: '2026-11-19T20:00:00Z',
      finishedAt: null,
      counts: { discovered: 0, processed: 0, newListings: 0, updatedListings: 0, rentChanges: 0, failedPages: 0 },
      sources: [
        { sourceId: 'source-1', status: 'succeeded', counts: { discovered: 0, processed: 0, newListings: 0, updatedListings: 0, rentChanges: 0, failedPages: 0 }, error: null },
        { sourceId: 'source-2', status: 'failed', counts: { discovered: 0, processed: 0, newListings: 0, updatedListings: 0, rentChanges: 0, failedPages: 0 }, error: 'x' },
      ],
    });
    const body = eventOfType('crawl.completed');

    await processFirecrawlEvent(body, sign(body));

    expect(crawlRuns.updateCrawlRun).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ status: 'partial', finished_at: expect.any(String) }),
    );
  });
});
