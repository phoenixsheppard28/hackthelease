import { createHash } from 'node:crypto';
import { ListingSchema, type Listing } from '../contracts/housing';
import type { Database } from './database.types';

export type ListingInput = Omit<Listing, 'id' | 'isActive'>;
export type ListingRow = Database['public']['Tables']['listings']['Row'];
export type ListingWriteRow = Omit<
  ListingRow,
  'id' | 'embedding' | 'is_active' | 'is_demo' | 'created_at' | 'updated_at'
>;

const addressAbbreviations: Record<string, string> = {
  north: 'n',
  south: 's',
  east: 'e',
  west: 'w',
  street: 'st',
  avenue: 'ave',
  road: 'rd',
  drive: 'dr',
  boulevard: 'blvd',
  lane: 'ln',
  court: 'ct',
  place: 'pl',
};

const unitPrefixes = new Set(['apt', 'apartment', 'unit', 'suite', 'ste', 'no']);

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export function normalizeAddress(address: string): string {
  return words(address)
    .map((word) => addressAbbreviations[word] ?? word)
    .join(' ');
}

export function normalizeUnit(unit: string | null): string | null {
  const unitWords = words(unit ?? '');

  while (unitWords.length > 0 && unitPrefixes.has(unitWords[0])) {
    unitWords.shift();
  }

  return unitWords.join('') || null;
}

export function listingMergeKey(listing: ListingInput): string {
  const unit = normalizeUnit(listing.unit);

  if (unit === null) {
    return `page:${listing.sources[0].url}`;
  }

  return `unit:${normalizeAddress(listing.address)}#${unit}`;
}

function listingSearchText(listing: ListingInput): string {
  const presentAmenities = Object.entries(listing.amenities)
    .filter(([, present]) => present === true)
    .map(([amenity]) => amenity);

  return [
    `Address: ${listing.address}`,
    presentAmenities.length > 0 && `Amenities: ${presentAmenities.join(', ')}`,
    listing.features.length > 0 && `Features: ${listing.features.join(', ')}`,
    listing.description && `Description: ${listing.description}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function latestFetchTime(sources: ListingInput['sources']): string {
  return sources.reduce((latest, source) =>
    Date.parse(source.fetchedAt) > Date.parse(latest.fetchedAt) ? source : latest,
  ).fetchedAt;
}

export function listingToRow(listing: ListingInput): ListingWriteRow {
  const searchableText = listingSearchText(listing);

  return {
    merge_key: listingMergeKey(listing),
    address: listing.address,
    normalized_address: normalizeAddress(listing.address),
    unit: listing.unit,
    normalized_unit: normalizeUnit(listing.unit),
    rent_min: listing.rentMin,
    rent_max: listing.rentMax,
    rent_basis: listing.rentBasis,
    recurring_fees_monthly: listing.recurringFeesMonthly,
    beds: listing.beds,
    available_from: listing.availableFrom,
    accessible: listing.accessible,
    amenities: listing.amenities,
    features: listing.features,
    description: listing.description,
    contact: listing.contact,
    sources: listing.sources,
    searchable_text: searchableText,
    text_hash: createHash('sha256').update(searchableText).digest('hex'),
    refreshed_at: latestFetchTime(listing.sources),
  };
}

export function listingFromRow(row: ListingRow): Listing {
  return ListingSchema.parse({
    id: row.id,
    address: row.address,
    unit: row.unit,
    rentMin: row.rent_min,
    rentMax: row.rent_max,
    rentBasis: row.rent_basis,
    recurringFeesMonthly: row.recurring_fees_monthly,
    beds: row.beds,
    availableFrom: row.available_from,
    accessible: row.accessible,
    amenities: row.amenities,
    features: row.features,
    description: row.description,
    contact: row.contact,
    sources: row.sources,
    isActive: row.is_active,
  });
}
