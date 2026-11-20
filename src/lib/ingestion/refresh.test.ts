import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as crawlRuns from '../supabase/crawl-runs';
import * as firecrawl from './firecrawl';
import { startRefresh, UnknownSourceError } from './refresh';

vi.mock('server-only', () => ({}));
vi.mock('../supabase/crawl-runs');
vi.mock('./firecrawl');

const source = (id: string, url: string) => ({
  id,
  provider: id,
  inventory_url: url,
  allowed_domains: [],
  listing_patterns: [],
  is_enabled: true,
  last_successful_refresh_at: null,
  created_at: '2026-11-19T00:00:00Z',
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(crawlRuns.failTimedOutCrawlRunSources).mockResolvedValue([]);
  vi.mocked(crawlRuns.listEnabledSources).mockResolvedValue([
    source('source-1', 'https://a.example.com/list'),
    source('source-2', 'https://b.example.com/list'),
  ]);
  vi.mocked(crawlRuns.createCrawlRun).mockResolvedValue({
    runId: 'run-1',
    sources: [
      { crawlRunSourceId: 'run-source-1', sourceId: 'source-1' },
      { crawlRunSourceId: 'run-source-2', sourceId: 'source-2' },
    ],
  });
});

describe('startRefresh', () => {
  it('starts one crawl job per source and saves each job id', async () => {
    vi.mocked(firecrawl.startCrawl).mockImplementation(async (_source, runSourceId) => `job-${runSourceId}`);

    const runId = await startRefresh();

    expect(runId).toBe('run-1');
    expect(crawlRuns.createCrawlRun).toHaveBeenCalledWith(['source-1', 'source-2']);
    expect(firecrawl.startCrawl).toHaveBeenCalledTimes(2);
    expect(crawlRuns.updateCrawlRunSource).toHaveBeenCalledWith('run-source-1', { firecrawl_job_id: 'job-run-source-1' });
    expect(crawlRuns.updateCrawlRunSource).toHaveBeenCalledWith('run-source-2', { firecrawl_job_id: 'job-run-source-2' });
  });

  it('fails run sources that stay active past the timeout before it creates the run', async () => {
    vi.mocked(firecrawl.startCrawl).mockResolvedValue('job');

    await startRefresh(['source-1']);

    const cutoff = vi.mocked(crawlRuns.failTimedOutCrawlRunSources).mock.calls[0][0];
    expect(Date.now() - Date.parse(cutoff)).toBeGreaterThanOrEqual(30 * 60 * 1000 - 1000);
    expect(crawlRuns.createCrawlRun).toHaveBeenCalledWith(['source-1']);
  });

  it('marks a source failed when Firecrawl rejects the crawl, so the source is not blocked', async () => {
    vi.mocked(firecrawl.startCrawl)
      .mockResolvedValueOnce('job-1')
      .mockRejectedValueOnce(new Error('Firecrawl returned 402'));

    await startRefresh();

    expect(crawlRuns.updateCrawlRunSource).toHaveBeenCalledWith(
      'run-source-2',
      expect.objectContaining({ status: 'failed', error: 'Firecrawl returned 402' }),
    );
  });

  it('rejects unknown or disabled source ids', async () => {
    await expect(startRefresh(['missing'])).rejects.toBeInstanceOf(UnknownSourceError);
    expect(crawlRuns.createCrawlRun).not.toHaveBeenCalled();
  });
});
