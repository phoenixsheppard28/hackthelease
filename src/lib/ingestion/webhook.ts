import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  deactivateStaleListings,
  findObservation,
  getCrawlRunSource,
  incrementCrawlRunSourceCounts,
  markSourceRefreshed,
  storeObservation,
  updateCrawlRunSource,
  type CrawlRunSourceWithInventory,
} from '../supabase/crawl-runs';
import type { Json } from '../supabase/database.types';
import { embedMissingListings } from '../embeddings/listings';
import { listUnembeddedListings, recordObservedListing } from '../supabase/listings';
import { listingFromExtraction } from './extraction';
import { storeListingImages } from './images';
import { finishCrawlRunIfDone } from './refresh';

export type FirecrawlEventResult = { status: 'unauthorized' | 'invalid' | 'duplicate' | 'processed' };

const FirecrawlEventSchema = z.object({
  success: z.boolean(),
  type: z.string(),
  id: z.string(),
  data: z.array(z.unknown()).default([]),
  metadata: z.object({ crawlRunSourceId: z.uuid() }),
  error: z.string().nullish(),
});

const FirecrawlPagesSchema = z.array(
  z
    .object({
      json: z.unknown().optional(),
      metadata: z.object({ sourceURL: z.string().optional(), url: z.string().optional() }),
    })
    .transform(({ json, metadata }, context) => {
      const pageUrl = metadata.sourceURL || metadata.url;
      if (!pageUrl) {
        context.addIssue({ code: 'custom', message: 'The page has no URL.' });
        return z.NEVER;
      }

      return { json, pageUrl };
    }),
);

type FirecrawlPage = z.infer<typeof FirecrawlPagesSchema>[number];

// Format: "X-Firecrawl-Signature: sha256=<hex HMAC-SHA256 of the raw body>".
// https://docs.firecrawl.dev/webhooks/security
function hasValidSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.FIRECRAWL_WEBHOOK_SECRET;
  const [algorithm, hash] = signature?.split('=') ?? [];
  if (!secret || algorithm !== 'sha256' || !hash || !/^[0-9a-f]{64}$/i.test(hash)) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest();
  return timingSafeEqual(Buffer.from(hash, 'hex'), expected);
}

export async function processFirecrawlEvent(
  rawBody: string,
  signature: string | null,
): Promise<FirecrawlEventResult> {
  if (!hasValidSignature(rawBody, signature)) {
    return { status: 'unauthorized' };
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { status: 'invalid' };
  }

  const event = FirecrawlEventSchema.safeParse(json);
  if (!event.success) {
    return { status: 'invalid' };
  }

  const runSource = await getCrawlRunSource(event.data.metadata.crawlRunSourceId);
  if (!runSource) {
    return { status: 'invalid' };
  }

  switch (event.data.type) {
    case 'crawl.page': {
      if (runSource.status === 'failed') {
        return { status: 'duplicate' };
      }

      const pages = FirecrawlPagesSchema.safeParse(event.data.success ? event.data.data : []);
      return pages.success ? processPages(runSource, pages.data) : { status: 'invalid' };
    }
    case 'crawl.completed':
    case 'crawl.failed':
      return finishSource(runSource, event.data.type === 'crawl.completed' && event.data.success, event.data.error);
    default:
      return { status: 'processed' };
  }
}

async function processPages(runSource: CrawlRunSourceWithInventory, pages: FirecrawlPage[]): Promise<FirecrawlEventResult> {
  const results = [];
  for (const page of pages) {
    results.push(await processPage(runSource, page));
  }

  return results.includes('processed') ? { status: 'processed' } : { status: 'duplicate' };
}

async function processPage(
  runSource: CrawlRunSourceWithInventory,
  { json, pageUrl }: FirecrawlPage,
): Promise<'processed' | 'duplicate'> {
  const fetchedAt = new Date().toISOString();
  const extraction = pageUrl.split('?')[0] === runSource.inventoryUrl.split('?')[0]
    ? { kind: 'not_listing' as const }
    : listingFromExtraction(json, pageUrl, fetchedAt);
  const listing = extraction.kind === 'listing' ? extraction.listing : null;

  let observationId = await storeObservation({
    crawlRunSourceId: runSource.id,
    pageUrl,
    fetchedAt,
    rawExtraction: (json ?? {}) as Json,
    normalized: listing as Json | null,
    evidence: null,
  });
  if (!observationId) {
    // A redelivery finishes only a listing whose first delivery stopped before the upsert.
    const existing = await findObservation(runSource.id, pageUrl);
    if (!existing || existing.listing_id !== null || existing.normalized === null || !listing) {
      return 'duplicate';
    }
    observationId = existing.id;
  }

  if (!listing) {
    await incrementCrawlRunSourceCounts(runSource.id, {
      discovered: 1,
      processed: 1,
      ...(extraction.kind === 'invalid' && { failedPages: 1 }),
    });
    return 'processed';
  }

  const result = await recordObservedListing(listing, runSource.source_id, observationId, runSource.id);
  if (!result) {
    return 'duplicate';
  }

  await embedListingSafely(result.listingId);
  if (extraction.kind === 'listing') {
    await storeListingImages(result.listingId, extraction.imageUrls);
  }

  return 'processed';
}

async function embedListingSafely(listingId: string): Promise<void> {
  try {
    await embedMissingListings(await listUnembeddedListings([listingId]));
  } catch (error) {
    console.error(`Listing embedding failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

async function finishSource(
  runSource: CrawlRunSourceWithInventory,
  succeeded: boolean,
  error: string | null | undefined,
): Promise<FirecrawlEventResult> {
  if (runSource.status !== 'queued' && runSource.status !== 'running') {
    return { status: 'duplicate' };
  }

  const finishedAt = new Date().toISOString();
  if (succeeded) {
    const status = runSource.failed_pages > 0 ? 'partial' : 'succeeded';
    await updateCrawlRunSource(runSource.id, { status, finished_at: finishedAt });
    await markSourceRefreshed(runSource.source_id, finishedAt);
    if (status === 'succeeded') {
      await deactivateStaleListings(runSource.source_id);
    }
  } else {
    await updateCrawlRunSource(runSource.id, {
      status: 'failed',
      error: error ?? 'Firecrawl reported a failed crawl.',
      finished_at: finishedAt,
    });
  }

  await finishCrawlRunIfDone(runSource.crawl_run_id);

  return { status: 'processed' };
}
