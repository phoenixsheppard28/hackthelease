import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoListings } from '../fixtures/listings';
import * as listings from '../supabase/listings';
import type { StoredListing } from '../supabase/listings';
import { embedMissingListings } from './listings';

vi.mock('server-only', () => ({}));
vi.mock('../supabase/listings');

const [oxford, cabrio] = demoListings;

const vector = (value: number) => Array<number>(1536).fill(value);

const stored = (listing: typeof oxford, embedding: number[] | null): StoredListing => ({
  listing,
  isDemo: true,
  searchableText: `Address: ${listing.address}`,
  textHash: `hash-${listing.id}`,
  embedding,
});

function mockOpenAi(data: { index: number; embedding: number[] }[]) {
  const fetchMock = vi.fn(async () => Response.json({ data }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function requestInputs(fetchMock: ReturnType<typeof mockOpenAi>, call: number): string[] {
  const [, init] = fetchMock.mock.calls[call] as unknown as [string, RequestInit];
  return JSON.parse(init.body as string).input;
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
    const fetchMock = mockOpenAi([{ index: 0, embedding: vector(0.5) }]);

    await embedMissingListings([stored(oxford, [1, 0]), stored(cabrio, null)]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestInputs(fetchMock, 0)).toEqual(['Address: 1100 Broadway Street, Ann Arbor, MI']);
    expect(listings.saveListingEmbedding).toHaveBeenCalledExactlyOnceWith('demo-cabrio-1', 'hash-demo-cabrio-1', vector(0.5));
  });

  it('makes no API call when every listing has an embedding', async () => {
    const fetchMock = mockOpenAi([]);

    await embedMissingListings([stored(oxford, [1, 0])]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('splits more than 100 inputs into several requests', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const input: string[] = JSON.parse(init.body as string).input;
      return Response.json({ data: input.map((_, index) => ({ index, embedding: vector(index) })) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const many = Array.from({ length: 101 }, (_, index) => stored({ ...oxford, id: `listing-${index}` }, null));

    await embedMissingListings(many);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestInputs(fetchMock as never, 0)).toHaveLength(100);
    expect(requestInputs(fetchMock as never, 1)).toHaveLength(1);
    expect(listings.saveListingEmbedding).toHaveBeenCalledTimes(101);
    expect(listings.saveListingEmbedding).toHaveBeenLastCalledWith('listing-100', 'hash-listing-100', vector(0));
  });

  it('throws when the API key is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    mockOpenAi([{ index: 0, embedding: vector(1) }]);

    await expect(embedMissingListings([stored(oxford, null)])).rejects.toThrow('OPENAI_API_KEY');
  });

  it.each([
    ['too few embeddings', []],
    ['a duplicate index', [{ index: 0, embedding: vector(1) }, { index: 0, embedding: vector(1) }]],
    ['an index out of range', [{ index: 0, embedding: vector(1) }, { index: 2, embedding: vector(1) }]],
    ['the wrong dimensions', [{ index: 0, embedding: vector(1) }, { index: 1, embedding: [1, 2] }]],
  ])('rejects a response with %s and saves nothing', async (_name, data) => {
    mockOpenAi(data);

    await expect(embedMissingListings([stored(oxford, null), stored(cabrio, null)])).rejects.toThrow(
      'does not match the request',
    );
    expect(listings.saveListingEmbedding).not.toHaveBeenCalled();
  });
});
