import 'server-only';
import type { CrawlRunStatus } from '../contracts/housing';
import { crawlRunStatusFromRows, type CrawlRunSourceRow } from './crawl-run-rows';
import type { Database, Json } from './database.types';
import { supabaseAdmin } from './server';

type Tables = Database['public']['Tables'];
export type SourceRow = Tables['sources']['Row'];
export type CrawlRunUpdate = Pick<Tables['crawl_runs']['Update'], 'status' | 'started_at' | 'finished_at'>;
export type CrawlRunSourceUpdate = Pick<
  Tables['crawl_run_sources']['Update'],
  'status' | 'firecrawl_job_id' | 'discovered' | 'error' | 'started_at' | 'finished_at'
>;
export type CrawlCountChanges = Partial<CrawlRunStatus['counts']>;
export type ObservationInput = {
  crawlRunSourceId: string;
  pageUrl: string;
  fetchedAt: string;
  rawExtraction: Json;
  normalized: Json | null;
  evidence: string | null;
};

const uniqueViolation = '23505';

export class SourceAlreadyRunningError extends Error {
  constructor() {
    super('A crawl is already queued or running for one of these sources.');
  }
}

export async function listEnabledSources(): Promise<SourceRow[]> {
  const { data, error } = await supabaseAdmin().from('sources').select('*').eq('is_enabled', true);
  if (error) {
    throw error;
  }

  return data;
}

export type CreatedCrawlRun = {
  runId: string;
  sources: { crawlRunSourceId: string; sourceId: string }[];
};

export async function createCrawlRun(sourceIds: string[]): Promise<CreatedCrawlRun> {
  const { data, error } = await supabaseAdmin().rpc('create_crawl_run', { p_source_ids: sourceIds });
  if (error?.code === uniqueViolation) {
    throw new SourceAlreadyRunningError();
  }
  if (error) {
    throw error;
  }

  return {
    runId: data[0].crawl_run_id,
    sources: data.map((row) => ({ crawlRunSourceId: row.crawl_run_source_id, sourceId: row.source_id })),
  };
}

export async function updateCrawlRun(runId: string, update: CrawlRunUpdate): Promise<void> {
  const { error } = await supabaseAdmin().from('crawl_runs').update(update).eq('id', runId);
  if (error) {
    throw error;
  }
}

export async function updateCrawlRunSource(
  crawlRunSourceId: string,
  update: CrawlRunSourceUpdate,
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('crawl_run_sources')
    .update(update)
    .eq('id', crawlRunSourceId);
  if (error) {
    throw error;
  }
}

export async function incrementCrawlRunSourceCounts(
  crawlRunSourceId: string,
  changes: CrawlCountChanges,
): Promise<void> {
  const { error } = await supabaseAdmin().rpc('increment_crawl_run_source_counts', {
    p_crawl_run_source_id: crawlRunSourceId,
    p_discovered: changes.discovered,
    p_processed: changes.processed,
    p_new_listings: changes.newListings,
    p_updated_listings: changes.updatedListings,
    p_rent_changes: changes.rentChanges,
    p_failed_pages: changes.failedPages,
  });
  if (error) {
    throw error;
  }
}

export async function findCrawlRunSourceByJobId(
  firecrawlJobId: string,
): Promise<CrawlRunSourceRow | null> {
  const { data, error } = await supabaseAdmin()
    .from('crawl_run_sources')
    .select('*')
    .eq('firecrawl_job_id', firecrawlJobId)
    .maybeSingle();
  if (error) {
    throw error;
  }

  return data;
}

export async function markSourceRefreshed(sourceId: string, refreshedAt: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('sources')
    .update({ last_successful_refresh_at: refreshedAt })
    .eq('id', sourceId);
  if (error) {
    throw error;
  }
}

export async function getCrawlRunStatus(runId: string): Promise<CrawlRunStatus | null> {
  const { data, error } = await supabaseAdmin()
    .from('crawl_runs')
    .select('*, crawl_run_sources(*)')
    .eq('id', runId)
    .maybeSingle();
  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const { crawl_run_sources: sourceRows, ...run } = data;
  return crawlRunStatusFromRows(run, sourceRows);
}

/** Returns the new observation ID, or null when this page was already stored for the run source. */
export async function storeObservation(observation: ObservationInput): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from('listing_observations')
    .upsert(
      {
        crawl_run_source_id: observation.crawlRunSourceId,
        page_url: observation.pageUrl,
        fetched_at: observation.fetchedAt,
        raw_extraction: observation.rawExtraction,
        normalized: observation.normalized,
        evidence: observation.evidence,
      },
      { onConflict: 'crawl_run_source_id,page_url', ignoreDuplicates: true },
    )
    .select('id');
  if (error) {
    throw error;
  }

  return data[0]?.id ?? null;
}
