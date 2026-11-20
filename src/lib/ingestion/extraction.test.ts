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

  it('keeps up to three valid listing image URLs separate from listing details', () => {
    const result = listingFromExtraction(
      { isListingPage: true, listing: { ...extractedListing, imageUrls: [
        'https://images.example.com/a.jpg',
        'javascript:alert(1)',
        'https://images.example.com/b.webp',
        'https://images.example.com/c.png',
        'https://images.example.com/d.png',
      ] } },
      pageUrl,
      fetchedAt,
    );

    expect(result.kind === 'listing' && result.imageUrls).toEqual([
      'https://images.example.com/a.jpg',
      'https://images.example.com/b.webp',
      'https://images.example.com/c.png',
    ]);
  });

  it('marks conflicting amenity observations as unknown', () => {
    const result = listingFromExtraction(
      {
        isListingPage: true,
        listing: {
          ...extractedListing,
          amenities: [
            { name: 'Parking', available: true },
            { name: 'parking', available: false },
          ],
        },
      },
      pageUrl,
      fetchedAt,
    );

    expect(result.kind === 'listing' && result.listing.amenities).toEqual({ parking: null });
  });

  it('skips a listing outside the Ann Arbor pilot area', () => {
    const result = listingFromExtraction(
      { isListingPage: true, listing: { ...extractedListing, address: '1162 Peabody Avenue, Memphis, TN' } },
      pageUrl,
      fetchedAt,
    );

    expect(result).toEqual({ kind: 'not_listing' });
  });

  it('skips the Oxford leasing office page', () => {
    const result = listingFromExtraction(
      { isListingPage: true, listing: extractedListing },
      'https://residential.oxfordcompanies.com/apartments/mi/ann-arbor/central-leasing-office/default.aspx',
      fetchedAt,
    );

    expect(result).toEqual({ kind: 'not_listing' });
  });

  it('normalizes availability words returned by Firecrawl', () => {
    const availableNow = listingFromExtraction(
      { isListingPage: true, listing: { ...extractedListing, availableFrom: 'now' } }, pageUrl, fetchedAt,
    );
    const missing = listingFromExtraction(
      { isListingPage: true, listing: { ...extractedListing, availableFrom: 'null' } }, pageUrl, fetchedAt,
    );

    expect(availableNow.kind === 'listing' && availableNow.listing.availableFrom).toBe('2026-11-19');
    expect(missing.kind === 'listing' && missing.listing.availableFrom).toBeNull();
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

  it('uses the company email when a listing has no valid email', () => {
    const noContact = listingFromExtraction(
      { isListingPage: true, listing: extractedListing }, pageUrl, fetchedAt, 'leasing@cabrioproperties.com',
    );
    const invalidEmail = listingFromExtraction(
      { isListingPage: true, listing: { ...extractedListing, contact: {
        name: 'Leasing', email: 'call us', phone: '734-555-0100',
      } } },
      pageUrl,
      fetchedAt,
      'leasing@cabrioproperties.com',
    );

    expect(noContact.kind === 'listing' && noContact.listing.contact).toEqual({
      name: null, email: 'leasing@cabrioproperties.com', phone: null,
    });
    expect(invalidEmail.kind === 'listing' && invalidEmail.listing.contact).toEqual({
      name: 'Leasing', email: 'leasing@cabrioproperties.com', phone: '734-555-0100',
    });
  });

  it('keeps a valid listing email ahead of the company email', () => {
    const result = listingFromExtraction(
      { isListingPage: true, listing: { ...extractedListing, contact: {
        name: 'Leasing', email: 'unit@example.com', phone: null,
      } } },
      pageUrl,
      fetchedAt,
      'leasing@cabrioproperties.com',
    );

    expect(result.kind === 'listing' && result.listing.contact?.email).toBe('unit@example.com');
  });
});
