import { describe, expect, it } from 'vitest';
import { crawlRunStatusFromRows } from './crawl-run-rows';

const sourceRow = {
  id: 'run-source-1',
  crawl_run_id: 'run-1',
  source_id: 'source-1',
  status: 'succeeded' as const,
  firecrawl_job_id: 'job-1',
  discovered: 10,
  processed: 9,
  new_listings: 3,
  updated_listings: 4,
  rent_changes: 1,
  failed_pages: 1,
  error: null,
  started_at: '2026-11-19T20:00:00+00:00',
  finished_at: '2026-11-19T20:05:00+00:00',
};

describe('crawlRunStatusFromRows', () => {
  it('sums per-source counts into run totals', () => {
    const status = crawlRunStatusFromRows(
      {
        id: 'run-1',
        status: 'partial',
        created_at: '2026-11-19T19:59:00+00:00',
        started_at: '2026-11-19T20:00:00+00:00',
        finished_at: null,
      },
      [
        sourceRow,
        {
          ...sourceRow,
          id: 'run-source-2',
          source_id: 'source-2',
          status: 'failed',
          discovered: 2,
          processed: 0,
          new_listings: 0,
          updated_listings: 0,
          rent_changes: 0,
          failed_pages: 2,
          error: 'Crawl timed out.',
        },
      ],
    );

    expect(status).toEqual({
      runId: 'run-1',
      status: 'partial',
      startedAt: '2026-11-19T20:00:00+00:00',
      finishedAt: null,
      counts: {
        discovered: 12,
        processed: 9,
        newListings: 3,
        updatedListings: 4,
        rentChanges: 1,
        failedPages: 3,
      },
      sources: [
        {
          sourceId: 'source-1',
          status: 'succeeded',
          counts: {
            discovered: 10,
            processed: 9,
            newListings: 3,
            updatedListings: 4,
            rentChanges: 1,
            failedPages: 1,
          },
          error: null,
        },
        {
          sourceId: 'source-2',
          status: 'failed',
          counts: {
            discovered: 2,
            processed: 0,
            newListings: 0,
            updatedListings: 0,
            rentChanges: 0,
            failedPages: 2,
          },
          error: 'Crawl timed out.',
        },
      ],
    });
  });
});
