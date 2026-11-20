import type { CrawlRunStatus } from '../contracts/housing';
import {
  createCrawlRun,
  failTimedOutCrawlRunSources,
  getCrawlRunStatus,
  listEnabledSources,
  updateCrawlRun,
  updateCrawlRunSource,
} from '../supabase/crawl-runs';
import { startCrawl } from './firecrawl';

const crawlTimeoutMs = 30 * 60 * 1000;
const activeStates = new Set<CrawlRunStatus['status']>(['queued', 'running']);

export class UnknownSourceError extends Error {
  constructor() {
    super('One or more sources do not exist or are disabled.');
  }
}

/** Starts one Firecrawl job per source (all enabled sources when none are given) and returns the run ID. */
export async function startRefresh(sourceIds?: string[]): Promise<string> {
  const enabledSources = await listEnabledSources();
  const sources = sourceIds
    ? enabledSources.filter((source) => sourceIds.includes(source.id))
    : enabledSources;
  if (sources.length === 0 || (sourceIds && sources.length !== new Set(sourceIds).size)) {
    throw new UnknownSourceError();
  }

  const timedOutRunIds = await failTimedOutCrawlRunSources(
    new Date(Date.now() - crawlTimeoutMs).toISOString(),
  );
  await Promise.all(timedOutRunIds.map(finishCrawlRunIfDone));

  const run = await createCrawlRun(sources.map((source) => source.id));
  const startedAt = new Date().toISOString();
  await updateCrawlRun(run.runId, { status: 'running', started_at: startedAt });

  await Promise.all(
    run.sources.map(async ({ crawlRunSourceId, sourceId }) => {
      const source = sources.find(({ id }) => id === sourceId)!;
      await updateCrawlRunSource(crawlRunSourceId, { status: 'running', started_at: startedAt });

      try {
        const jobId = await startCrawl(source, crawlRunSourceId);
        await updateCrawlRunSource(crawlRunSourceId, { firecrawl_job_id: jobId });
      } catch (error) {
        await updateCrawlRunSource(crawlRunSourceId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'The crawl did not start.',
          finished_at: new Date().toISOString(),
        });
      }
    }),
  );
  await finishCrawlRunIfDone(run.runId);

  return run.runId;
}

export async function getRefreshStatus(runId: string): Promise<CrawlRunStatus | null> {
  return getCrawlRunStatus(runId);
}

export async function finishCrawlRunIfDone(runId: string): Promise<void> {
  const run = await getCrawlRunStatus(runId);
  if (!run || run.finishedAt || run.sources.some((source) => activeStates.has(source.status))) {
    return;
  }

  const states = new Set(run.sources.map((source) => source.status));
  const status = states.size === 1 ? [...states][0] : 'partial';
  await updateCrawlRun(runId, { status, finished_at: new Date().toISOString() });
}
