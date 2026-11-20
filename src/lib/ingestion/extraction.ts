import { z } from 'zod';
import { ListingFieldsSchema, ListingSchema } from '../contracts/housing';
import type { ListingInput } from '../supabase/listing-rows';

export const PageExtractionSchema = z.object({
  isListingPage: z
    .boolean()
    .describe('True only when the page describes one rentable home or unit.'),
  listing: ListingFieldsSchema.omit({ id: true, isActive: true, sources: true }).nullable(),
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

  const listing = ListingSchema.safeParse({
    ...page.data.listing,
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
