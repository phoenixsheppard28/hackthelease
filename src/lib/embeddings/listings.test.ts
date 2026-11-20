import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoListings } from '../fixtures/listings';
import * as listings from '../supabase/listings';
import type { StoredListing } from '../supabase/listings';
import { embedMissingListings } from './listings';

vi.mock('server-only', () => ({}));
vi.mock('../supabase/listings');

const [oxford, cabrio] = demoListings;

const stored = (listing: typeof oxford, embedding: number[] | null): StoredListing => ({
  listing,
  isDemo: true,
  searchableText: `Address: ${listing.address}`,
  textHash: `hash-${listing.id}`,
  embedding,
});

function mockOpenAi(embeddings: number[][]) {
  const fetchMock = vi.fn(async () =>
    Response.json({ data: embeddings.map((embedding, index) => ({ index, embedding })) }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('embedMissingListings', () => {
  it('embeds only listings without an embedding in one batched call', async () => {
    const fetchMock = mockOpenAi([[0.5, 0.5]]);

    const result = await embedMissingListings([stored(oxford, [1, 0]), stored(cabrio, null)]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(request).toEqual({ model: 'text-embedding-3-small', input: ['Address: 1100 Broadway Street, Ann Arbor, MI'] });
    expect(listings.saveListingEmbedding).toHaveBeenCalledExactlyOnceWith('demo-cabrio-1', 'hash-demo-cabrio-1', [0.5, 0.5]);
    expect(result.map((listing) => listing.embedding)).toEqual([[1, 0], [0.5, 0.5]]);
  });

  it('makes no API call when every listing has an embedding', async () => {
    const fetchMock = mockOpenAi([]);

    await embedMissingListings([stored(oxford, [1, 0])]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when the API key is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    mockOpenAi([[1]]);

    await expect(embedMissingListings([stored(oxford, null)])).rejects.toThrow('OPENAI_API_KEY');
  });
});
