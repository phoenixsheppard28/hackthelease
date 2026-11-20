import { z } from 'zod';

export const RentBasisSchema = z.enum(['per_person', 'per_unit', 'unknown']);
export const PrioritySchema = z.enum([
  'affordability',
  'amenities',
  'lifestyle',
  'commute',
]);

const moneySchema = z.number().finite().nonnegative();
const scoreSchema = z.number().finite().min(0).max(1);
const sourceSchema = z.object({
  url: z.url(),
  fetchedAt: z.iso.datetime({ offset: true }),
  evidence: z.string().optional(),
});

export const ListingFieldsSchema = z.object({
  id: z.string().min(1),
  address: z.string().min(1),
  unit: z.string().min(1).nullable(),
  rentMin: moneySchema.nullable(),
  rentMax: moneySchema.nullable(),
  rentBasis: RentBasisSchema,
  recurringFeesMonthly: moneySchema.nullable(),
  beds: z.number().int().nonnegative().nullable(),
  availableFrom: z.iso.date().nullable(),
  accessible: z.boolean().nullable(),
  amenities: z.record(z.string(), z.boolean().nullable()),
  features: z.array(z.string()),
  description: z.string().nullable(),
  contact: z
    .object({
      name: z.string().min(1).nullable(),
      email: z.email().nullable(),
      phone: z.string().min(1).nullable(),
    })
    .nullable(),
  sources: z.array(sourceSchema).min(1),
  isActive: z.boolean(),
});

export const ListingSchema = ListingFieldsSchema.refine(
  ({ rentMin, rentMax }) =>
    rentMax === null || (rentMin !== null && rentMax >= rentMin),
  { path: ['rentMax'], message: 'Maximum rent must be at least minimum rent.' },
);

export type Listing = z.infer<typeof ListingSchema>;

export const HousingProfileSchema = z.object({
  budgetMonthlyPerPerson: moneySchema.nullable(),
  minimumBeds: z.number().int().nonnegative().nullable(),
  moveInDate: z.iso.date().nullable(),
  requiresAccessibleUnit: z.boolean(),
  roommateCount: z.number().int().nonnegative().nullable(),
  preferredAmenities: z.array(z.string()),
  lifestyleText: z.string(),
  priorities: z
    .array(PrioritySchema)
    .length(3)
    .refine((priorities) => new Set(priorities).size === 3, {
      message: 'Choose three distinct priorities.',
    }),
});

export type HousingProfile = z.infer<typeof HousingProfileSchema>;

const firmCheckSchema = z.enum(['pass', 'fail', 'unknown']);

export const MatchResultSchema = z.object({
  listingId: z.string().min(1),
  address: z.string().min(1),
  unit: z.string().nullable(),
  rentBasis: RentBasisSchema,
  sourceFetchedAt: z.iso.datetime({ offset: true }),
  score: scoreSchema,
  componentScores: z.object({
    affordability: scoreSchema.nullable(),
    amenities: scoreSchema.nullable(),
    lifestyle: scoreSchema.nullable(),
    commute: scoreSchema.nullable(),
  }),
  firmChecks: z
    .object({
      budget: firmCheckSchema,
      beds: firmCheckSchema,
      moveIn: firmCheckSchema,
      accessibility: firmCheckSchema,
    })
    .partial(),
  supportingFacts: z.array(z.string()),
  sourceUrls: z.array(z.url()).min(1),
  verificationFlags: z.array(z.string()),
  skippedPriorities: z.array(PrioritySchema),
  isDemo: z.boolean().optional(),
});

export type MatchResult = z.infer<typeof MatchResultSchema>;

export const CrawlStateSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'partial',
  'failed',
]);

const crawlCountsSchema = z.object({
  discovered: z.number().int().nonnegative(),
  processed: z.number().int().nonnegative(),
  newListings: z.number().int().nonnegative(),
  updatedListings: z.number().int().nonnegative(),
  rentChanges: z.number().int().nonnegative(),
  failedPages: z.number().int().nonnegative(),
});

export const CrawlRunStatusSchema = z.object({
  runId: z.string().min(1),
  status: CrawlStateSchema,
  startedAt: z.iso.datetime({ offset: true }).nullable(),
  finishedAt: z.iso.datetime({ offset: true }).nullable(),
  counts: crawlCountsSchema,
  sources: z.array(
    z.object({
      sourceId: z.string().min(1),
      status: CrawlStateSchema,
      counts: crawlCountsSchema,
      error: z.string().nullable(),
    }),
  ),
});

export type CrawlRunStatus = z.infer<typeof CrawlRunStatusSchema>;
