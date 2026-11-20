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
} from '../supabase/crawl-runs';
import type { CrawlRunSourceRow } from '../supabase/crawl-run-rows';
import type { Json } from '../supabase/database.types';
import { upsertListing } from '../supabase/listings';
import { listingFromExtraction } from './extraction';
import { finishCrawlRunIfDone } from './refresh';

export type FirecrawlEventResult = { status: 'unauthorized' | 'invalid' | 'duplicate' | 'processed' };

const FirecrawlEventSchema = z.object({
  success: z.boolean(),
  type: z.string(),
  id: z.string(),
  data: z.array(z.unknown()).default([]),
  metadata: z.object({ crawlRunSourceId: z.string().min(1) }),
  error: z.string().nullish(),
});

const FirecrawlPagesSchema = z.array(
  z
    .object({
      json: z.unknown(),
      metadata: z.object({ sourceURL: z.string().optional(), url: z.string().optional() }),
    })
    .transform(({ json, metadata }) => ({ json, pageUrl: metadata.sourceURL ?? metadata.url }))
    .pipe(z.object({ json: z.unknown(), pageUrl: z.string().min(1) })),
);

type FirecrawlPage = z.infer<typeof FirecrawlPagesSchema>[number];

// Format: "X-Firecrawl-Signature: sha256=<hex HMAC-SHA256 of the raw body>".
// https://docs.firecrawl.dev/webhooks/security
function hasValidSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.FIRECRAWL_WEBHOOK_SECRET;
  const [algorithm, hash] = signature?.split('=') ?? [];
  if (!secret || algorithm !== 'sha256' || !hash) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const received = Buffer.from(hash, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
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

async function processPages(runSource: CrawlRunSourceRow, pages: FirecrawlPage[]): Promise<FirecrawlEventResult> {
  const results = [];
  for (const page of pages) {
    results.push(await processPage(runSource, page));
  }

  return results.includes('processed') ? { status: 'processed' } : { status: 'duplicate' };
}

async function processPage(
  runSource: CrawlRunSourceRow,
  { json, pageUrl }: FirecrawlPage,
): Promise<'processed' | 'duplicate'> {
  const fetchedAt = new Date().toISOString();
  const extraction = listingFromExtraction(json, pageUrl, fetchedAt);
  const listing = extraction.kind === 'listing' ? extraction.listing : null;

  let observationId = await storeObservation({
    crawlRunSourceId: runSource.id,
    pageUrl,
    fetchedAt,
    rawExtraction: (json ?? null) as Json,
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

  const result = await upsertListing(listing, runSource.source_id, observationId);
  await incrementCrawlRunSourceCounts(runSource.id, {
    discovered: 1,
    processed: 1,
    newListings: result.wasInserted ? 1 : 0,
    updatedListings: result.wasInserted ? 0 : 1,
    rentChanges: result.rentChanged ? 1 : 0,
  });

  return 'processed';
}

async function finishSource(
  runSource: CrawlRunSourceRow,
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
