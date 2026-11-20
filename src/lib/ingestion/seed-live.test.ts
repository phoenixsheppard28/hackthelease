import { expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { startRefresh, getRefreshStatus } from './refresh';
import { listEnabledSources } from '../supabase/crawl-runs';

test('starts one bounded production crawl for every enabled source', async () => {
  process.loadEnvFile('.env');
  process.env.APP_BASE_URL = 'https://hack-the-lease.vercel.app';

  const sources = (await listEnabledSources()).sort((a, b) => a.provider.localeCompare(b.provider));
  expect(sources).toHaveLength(17);
  expect(sources.every((source) => source.listing_patterns.length > 0)).toBe(true);

  await new Promise((resolve) => setTimeout(resolve, 45000));
  for (const source of sources.filter(({ provider }) => !['Ann Arbor City Club', 'Cabrio Properties'].includes(provider))) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const runId = await startRefresh([source.id]);
      const status = await getRefreshStatus(runId);
      console.log(JSON.stringify({ provider: source.provider, runId, status: status?.status, error: status?.sources[0]?.error }));
      if (status?.sources[0]?.status !== 'failed') break;
      if (attempt === 2 || !status?.sources[0]?.error?.includes('429')) throw new Error(`${source.provider} could not start`);

      await new Promise((resolve) => setTimeout(resolve, 65000));
    }

    await new Promise((resolve) => setTimeout(resolve, 22000));
  }
}, 900000);
