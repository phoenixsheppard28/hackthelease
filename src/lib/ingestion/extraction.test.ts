import { describe, expect, it } from 'vitest';
import { listingFromExtraction, pageExtractionJsonSchema } from './extraction';

const pageUrl = 'https://showmojo.com/l/abc/910-packard';
const fetchedAt = '2026-11-19T20:00:00Z';

function containsRecordSchema(schema: unknown): boolean {
  if (Array.isArray(schema)) {
    return schema.some(containsRecordSchema);
  }

  if (schema === null || typeof schema !== 'object') {
    return false;
  }

  const node = schema as Record<string, unknown>;
  const isRecord = node.type === 'object' && node.properties === undefined;
  return isRecord || Object.values(node).some(containsRecordSchema);
}

const extractedListing = {
  address: '910 Packard St, Ann Arbor, MI',
  unit: 'A2',
  rentMin: 1650,
  rentMax: 1650,
  rentBasis: 'per_unit',
  recurringFeesMonthly: null,
  beds: 2,
  availableFrom: '2027-08-01',
  accessible: null,
  amenities: [
    { name: 'laundry', available: true },
    { name: 'parking', available: null },
  ],
  features: ['Hardwood floors'],
  description: 'Two bedroom near campus.',
  contact: null,
};

describe('page extraction schema', () => {
  it('lists properties for every object, as Firecrawl JSON extraction requires', () => {
    expect(containsRecordSchema(pageExtractionJsonSchema)).toBe(false);
  });

  it('maps the extracted amenity list to the listing amenity map', () => {
    const result = listingFromExtraction({ isListingPage: true, listing: extractedListing }, pageUrl, fetchedAt);

    expect(result.kind).toBe('listing');
    expect(result.kind === 'listing' && result.listing.amenities).toEqual({ laundry: true, parking: null });
  });

  it('drops a malformed contact email instead of rejecting the page', () => {
    const result = listingFromExtraction(
      {
        isListingPage: true,
        listing: { ...extractedListing, contact: { name: 'Leasing', email: 'call us', phone: '734-555-0100' } },
      },
      pageUrl,
      fetchedAt,
    );

    expect(result.kind === 'listing' && result.listing.contact).toEqual({
      name: 'Leasing',
      email: null,
      phone: '734-555-0100',
    });
  });
});
