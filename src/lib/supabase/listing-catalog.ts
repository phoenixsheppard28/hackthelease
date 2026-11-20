import "server-only";
import { z } from "zod";
import { ListingSchema, type Listing } from "@/lib/contracts/housing";
import { currentListingAvailability, listingAvailabilitySchema, type ListingAvailability } from '@/lib/availability/listing-status';

export type CatalogListing = { listing: Listing; isDemo: boolean; embedding: number[] | null; images: string[]; refreshedAt: string; availabilityReport?: ListingAvailability | null };
const rowSchema = z.object({
  id: z.uuid(), address: z.string(), unit: z.string().nullable(),
  rent_min: z.number().nullable(), rent_max: z.number().nullable(), rent_basis: z.enum(["per_person", "per_unit", "unknown"]),
  recurring_fees_monthly: z.number().nullable(), beds: z.number().nullable(), available_from: z.string().nullable(), accessible: z.boolean().nullable(),
  amenities: z.record(z.string(), z.boolean().nullable()), features: z.array(z.string()), description: z.string().nullable(),
  contact: z.unknown(), sources: z.unknown(), is_active: z.boolean(), is_demo: z.boolean(), refreshed_at: z.string(),
  embedding: z.string().nullable(),
  availability_report: listingAvailabilitySchema.nullable(),
  listing_images: z.array(z.object({ storage_path: z.string(), created_at: z.string() })),
});
const columns = "id,address,unit,rent_min,rent_max,rent_basis,recurring_fees_monthly,beds,available_from,accessible,amenities,features,description,contact,sources,is_active,is_demo,refreshed_at,embedding,availability_report,listing_images(storage_path,created_at)";

// The UI only receives public listing fields. Credentials and vectors stay on the server.
export async function readListingCatalog(listingId?: string): Promise<CatalogListing[]> {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Listing storage is not configured.");
  const listings: CatalogListing[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({ select: columns, is_active: "eq.true", is_demo: "eq.false", order: "id.asc", limit: String(pageSize), offset: String(offset) });
    if (listingId) query.set("id", `eq.${z.uuid().parse(listingId)}`);
    const response = await fetch(`${base}/rest/v1/listings?${query}`, {
      headers: { apikey: key, ...(key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${key}` }) },
      cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Listing storage is unavailable.");
    const rows = rowSchema.array().parse(await response.json());
    for (const row of rows) {
      const listing = ListingSchema.parse({
        id: row.id, address: row.address, unit: row.unit,
        rentMin: row.rent_min, rentMax: row.rent_max, rentBasis: row.rent_basis,
        recurringFeesMonthly: row.recurring_fees_monthly, beds: row.beds, availableFrom: row.available_from, accessible: row.accessible,
        amenities: row.amenities, features: row.features, description: row.description, contact: row.contact,
        sources: row.sources, isActive: row.is_active,
      });
      let embedding: number[] | null = null;
      try { embedding = row.embedding ? z.array(z.number().finite()).length(1536).parse(JSON.parse(row.embedding)) : null; } catch { /* An invalid vector must not hide an otherwise valid home. */ }
      const images = [...new Set(row.listing_images.sort((a, b) => a.created_at.localeCompare(b.created_at))
        .filter(image => /^[a-f0-9]{2}\/[a-f0-9]{64}\.(jpg|png|webp|avif|gif)$/.test(image.storage_path))
        .map(image => `${base}/storage/v1/object/public/listing-images/${image.storage_path}`))];
      listings.push({ listing, isDemo: row.is_demo, embedding, images, refreshedAt: row.refreshed_at, availabilityReport: currentListingAvailability(row.availability_report) });
    }
    if (rows.length < pageSize || listingId) break;
  }
  return listings;
}
