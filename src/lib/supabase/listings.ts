import 'server-only';
import type { Listing } from '../contracts/housing';
import { listingFromRow, listingToRow, type ListingInput } from './listing-rows';
import { supabaseAdmin } from './server';

export type StoredListing = {
  listing: Listing;
  isDemo: boolean;
  searchableText: string;
  textHash: string;
  embedding: number[] | null;
};

export type ListingUpsertResult = {
  listingId: string;
  wasInserted: boolean;
  rentChanged: boolean;
};

export async function listActiveListings(): Promise<StoredListing[]> {
  const { data, error } = await supabaseAdmin().from('listings').select('*').eq('is_active', true);
  if (error) {
    throw error;
  }

  return data.map((row) => ({
    listing: listingFromRow(row),
    isDemo: row.is_demo,
    searchableText: row.searchable_text,
    textHash: row.text_hash,
    embedding: row.embedding === null ? null : (JSON.parse(row.embedding) as number[]),
  }));
}

export async function upsertListing(
  listing: ListingInput,
  sourceId: string,
  observationId?: string,
): Promise<ListingUpsertResult> {
  const { data, error } = await supabaseAdmin()
    .rpc('upsert_listing', {
      p_listing: listingToRow(listing, sourceId),
      p_observation_id: observationId,
    })
    .single();
  if (error) {
    throw error;
  }

  return {
    listingId: data.listing_id,
    wasInserted: data.was_inserted,
    rentChanged: data.rent_changed,
  };
}

// The text_hash filter skips the write when the listing text changed after the embedding request.
export async function saveListingEmbedding(
  listingId: string,
  textHash: string,
  embedding: number[],
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('listings')
    .update({ embedding: JSON.stringify(embedding) })
    .eq('id', listingId)
    .eq('text_hash', textHash);
  if (error) {
    throw error;
  }
}
