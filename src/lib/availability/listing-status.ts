import { z } from 'zod';

export const listingAvailabilitySchema = z.object({
  reportedAt: z.iso.datetime({ offset: true }),
  source: z.enum(['user_report', 'landlord_email']),
  status: z.enum(['tenants_renewing', 'lease_signed', 'available', 'renewal_undecided']),
  leaseStart: z.iso.date().nullable(),
  leaseEnd: z.iso.date().nullable(),
});
export type ListingAvailability = z.infer<typeof listingAvailabilitySchema>;

export function currentListingAvailability(report: ListingAvailability | null | undefined, now = Date.now()): ListingAvailability | null {
  if (!report || !['tenants_renewing', 'lease_signed'].includes(report.status) || Date.parse(report.reportedAt) + 30 * 86400000 <= now) return null;
  if (report.leaseEnd && Date.parse(`${report.leaseEnd}T23:59:59Z`) < now) return null;
  return report;
}
