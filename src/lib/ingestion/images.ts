import 'server-only';
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { supabaseAdmin } from '../supabase/server';

const bucket = 'listing-images';
const maxBytes = 5 * 1024 * 1024;
const imageTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

function isPublicAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const first = Number.parseInt(address.split(':')[0], 16);
    return first >= 0x2000 && first < 0x4000;
  }

  const [a, b] = address.split('.').map(Number);
  return a > 0 && a < 224 && a !== 10 && a !== 127 &&
    !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && (b === 0 || b === 168)) &&
    !(a === 198 && (b === 18 || b === 19));
}

async function loadImage(url: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) return null;

  const addresses = isIP(parsed.hostname)
    ? [{ address: parsed.hostname }]
    : await lookup(parsed.hostname, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) return null;

  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!response.ok || !imageTypes[contentType] || !response.body) return null;
  if (Number(response.headers.get('content-length') ?? 0) > maxBytes) return null;

  const chunks: Buffer[] = [];
  const reader = response.body.getReader();
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(Buffer.from(value));
  }

  return { bytes: Buffer.concat(chunks, size), contentType };
}

export async function storeListingImages(listingId: string, imageUrls: string[]): Promise<void> {
  for (const sourceUrl of imageUrls) {
    try {
      const image = await loadImage(sourceUrl);
      if (!image) continue;

      const hash = createHash('sha256').update(sourceUrl).digest('hex');
      const storagePath = `${hash.slice(0, 2)}/${hash}.${imageTypes[image.contentType]}`;
      const storage = supabaseAdmin().storage.from(bucket);
      const uploaded = await storage.upload(storagePath, image.bytes, {
        contentType: image.contentType,
        upsert: true,
      });
      if (uploaded.error) throw uploaded.error;

      const { error } = await supabaseAdmin().from('listing_images').upsert({
        listing_id: listingId,
        source_url: sourceUrl,
        storage_path: storagePath,
      });
      if (error) throw error;
    } catch (error) {
      console.error(`Listing image failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
