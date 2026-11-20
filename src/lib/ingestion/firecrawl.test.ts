import { afterEach, describe, expect, it, vi } from 'vitest';
import { startCrawl } from './firecrawl';

vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startCrawl', () => {
  it('scopes listing paths, removes query duplicates, and waits for client-rendered inventory', async () => {
    process.env.FIRECRAWL_API_KEY = 'test-key';
    process.env.APP_BASE_URL = 'https://app.example.com';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'job-1' }) });
    vi.stubGlobal('fetch', fetchMock);

    await startCrawl({
      id: 'source-1', provider: 'Cabrio', inventory_url: 'https://showmojo.com/8f47a0401c/l',
      allowed_domains: ['showmojo.com'], listing_patterns: ['^/l/'], contact_email: null, is_enabled: true,
      last_successful_refresh_at: null, created_at: '2026-11-19T00:00:00Z',
    }, 'run-source-1');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      includePaths: ['^/l/'], ignoreQueryParameters: true,
      scrapeOptions: { waitFor: expect.any(Number) },
    });
    expect(body.scrapeOptions.waitFor).toBeGreaterThan(0);
  });
});
