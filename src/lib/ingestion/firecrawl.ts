import 'server-only';
import type { SourceRow } from '../supabase/crawl-runs';
import { pageExtractionJsonSchema, pageExtractionPrompt } from './extraction';

const crawlPageLimit = 100;

// https://docs.firecrawl.dev/api-reference/endpoint/crawl-post
export async function startCrawl(source: SourceRow, crawlRunSourceId: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const appBaseUrl = process.env.APP_BASE_URL;
  if (!apiKey || !appBaseUrl) {
    throw new Error('FIRECRAWL_API_KEY and APP_BASE_URL must be set.');
  }

  const response = await fetch('https://api.firecrawl.dev/v2/crawl', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: source.inventory_url,
      limit: crawlPageLimit,
      ...(source.listing_patterns.length > 0 && { includePaths: source.listing_patterns }),
      scrapeOptions: {
        formats: [{ type: 'json', schema: pageExtractionJsonSchema, prompt: pageExtractionPrompt }],
      },
      webhook: {
        url: new URL('/api/firecrawl/webhook', appBaseUrl).toString(),
        metadata: { crawlRunSourceId },
        events: ['page', 'completed', 'failed'],
      },
    }),
  });

  const body = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
  if (!response.ok || !body?.id) {
    throw new Error(`Firecrawl did not start the crawl (${response.status}): ${body?.error ?? 'no job id'}`);
  }

  return body.id;
}
