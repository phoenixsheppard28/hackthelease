import type { CrawlRunStatus } from '../contracts/housing';
import type { Database } from './database.types';

type Tables = Database['public']['Tables'];
export type CrawlRunRow = Tables['crawl_runs']['Row'];
export type CrawlRunSourceRow = Tables['crawl_run_sources']['Row'];
type CrawlCounts = CrawlRunStatus['counts'];

function countsFromRow(row: CrawlRunSourceRow): CrawlCounts {
  return {
    discovered: row.discovered,
    processed: row.processed,
    newListings: row.new_listings,
    updatedListings: row.updated_listings,
    rentChanges: row.rent_changes,
    failedPages: row.failed_pages,
  };
}

function addCounts(total: CrawlCounts, counts: CrawlCounts): CrawlCounts {
  return {
    discovered: total.discovered + counts.discovered,
    processed: total.processed + counts.processed,
    newListings: total.newListings + counts.newListings,
    updatedListings: total.updatedListings + counts.updatedListings,
    rentChanges: total.rentChanges + counts.rentChanges,
    failedPages: total.failedPages + counts.failedPages,
  };
}

export function crawlRunStatusFromRows(
  run: CrawlRunRow,
  sourceRows: CrawlRunSourceRow[],
): CrawlRunStatus {
  const sources = sourceRows.map((row) => ({
    sourceId: row.source_id,
    status: row.status,
    counts: countsFromRow(row),
    error: row.error,
  }));

  const emptyCounts: CrawlCounts = {
    discovered: 0,
    processed: 0,
    newListings: 0,
    updatedListings: 0,
    rentChanges: 0,
    failedPages: 0,
  };

  return {
    runId: run.id,
    status: run.status,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    counts: sources.map((source) => source.counts).reduce(addCounts, emptyCounts),
    sources,
  };
}
