import { beforeEach, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../supabase/server';
import { storeListingImages } from './images';

vi.mock('server-only', () => ({}));
vi.mock('../supabase/server');

const upload = vi.fn();
const upsert = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  upload.mockResolvedValue({ error: null });
  upsert.mockResolvedValue({ error: null });
  vi.mocked(supabaseAdmin).mockReturnValue({
    storage: { from: () => ({ upload }) },
    from: () => ({ upsert }),
  } as never);
});

it('stores public HTTPS images and links them to the listing', async () => {
  const fetchImage = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
    headers: { 'content-type': 'image/jpeg' },
  }));
  vi.stubGlobal('fetch', fetchImage);

  await storeListingImages('listing-1', ['https://93.184.215.14/photo.jpg']);

  expect(upload).toHaveBeenCalledWith(expect.stringMatching(/\.jpg$/), Buffer.from([1, 2, 3]), {
    contentType: 'image/jpeg',
    upsert: true,
  });
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
    listing_id: 'listing-1',
    source_url: 'https://93.184.215.14/photo.jpg',
  }));
});

it('does not request private addresses', async () => {
  const fetchImage = vi.fn();
  vi.stubGlobal('fetch', fetchImage);

  await storeListingImages('listing-1', ['https://127.0.0.1/photo.jpg']);

  expect(fetchImage).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
});
