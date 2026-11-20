import { z } from 'zod';
import { RentBasisSchema, ListingSchema } from '../contracts/housing';
import type { ListingInput } from '../supabase/listing-rows';

// Firecrawl JSON extraction rejects dictionary objects, so amenities arrive as a list.
// Formats such as email and date are checked by ListingSchema after extraction.
const ExtractedListingSchema = z.object({
  address: z.string(),
  unit: z.string().nullable(),
  rentMin: z.number().nullable(),
  rentMax: z.number().nullable(),
  rentBasis: RentBasisSchema,
  recurringFeesMonthly: z.number().nullable(),
  beds: z.number().int().nullable(),
  availableFrom: z.string().nullable().describe('YYYY-MM-DD'),
  accessible: z.boolean().nullable(),
  amenities: z.array(z.object({ name: z.string(), available: z.boolean().nullable() })),
  features: z.array(z.string()),
  description: z.string().nullable(),
  contact: z
    .object({ name: z.string().nullable(), email: z.string().nullable(), phone: z.string().nullable() })
    .nullable(),
});

export const PageExtractionSchema = z.object({
  isListingPage: z
    .boolean()
    .describe('True only when the page describes one rentable home or unit.'),
  listing: ExtractedListingSchema.nullable(),
});

export const pageExtractionJsonSchema = z.toJSONSchema(PageExtractionSchema);

export const pageExtractionPrompt =
  'Extract the rental listing on this page. Use null for any value the page does not state. ' +
  'Set rentBasis to per_person or per_unit only when the page says so.';

export type ExtractionResult =
  | { kind: 'listing'; listing: ListingInput }
  | { kind: 'not_listing' }
  | { kind: 'invalid' };

export function listingFromExtraction(
  extraction: unknown,
  pageUrl: string,
  fetchedAt: string,
): ExtractionResult {
  const page = PageExtractionSchema.safeParse(extraction);
  if (!page.success) {
    return { kind: 'invalid' };
  }

  if (!page.data.isListingPage || page.data.listing === null) {
    return { kind: 'not_listing' };
  }

  const { amenities, contact, ...fields } = page.data.listing;
  const listing = ListingSchema.safeParse({
    ...fields,
    amenities: Object.fromEntries(amenities.map(({ name, available }) => [name, available])),
    contact: contact && {
      name: contact.name || null,
      email: z.email().safeParse(contact.email).success ? contact.email : null,
      phone: contact.phone || null,
    },
    id: pageUrl,
    isActive: true,
    sources: [{ url: pageUrl, fetchedAt }],
  });
  if (!listing.success) {
    return { kind: 'invalid' };
  }

  const { id: _id, isActive: _isActive, ...input } = listing.data;
  return { kind: 'listing', listing: input };
}
