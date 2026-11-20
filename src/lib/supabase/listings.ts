import 'server-only';
import type { Listing } from '../contracts/housing';
import { listingFromRow, listingToRow, type ListingInput, type ListingRow } from './listing-rows';
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

function storedListingFromRow(row: ListingRow): StoredListing {
  return {
    listing: listingFromRow(row),
    isDemo: row.is_demo,
    searchableText: row.searchable_text,
    textHash: row.text_hash,
    embedding: row.embedding === null ? null : (JSON.parse(row.embedding) as number[]),
  };
}

export async function listActiveListings(): Promise<StoredListing[]> {
  const { data, error } = await supabaseAdmin().from('listings').select('*').eq('is_active', true);
  if (error) {
    throw error;
  }

  return data.map(storedListingFromRow);
}

export async function listUnembeddedListings(listingIds: string[]): Promise<StoredListing[]> {
  const { data, error } = await supabaseAdmin()
    .from('listings')
    .select('*')
    .in('id', listingIds)
    .is('embedding', null);
  if (error) {
    throw error;
  }

  return data.map(storedListingFromRow);
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

/** Upserts and counts the listing in one transaction. Returns null when another delivery already did. */
export async function recordObservedListing(
  listing: ListingInput,
  sourceId: string,
  observationId: string,
  crawlRunSourceId: string,
): Promise<ListingUpsertResult | null> {
  const { data, error } = await supabaseAdmin()
    .rpc('record_observed_listing', {
      p_listing: listingToRow(listing, sourceId),
      p_observation_id: observationId,
      p_crawl_run_source_id: crawlRunSourceId,
    })
    .maybeSingle();
  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    listingId: data.listing_id,
    wasInserted: data.was_inserted,
    rentChanged: data.rent_changed,
  };
}
