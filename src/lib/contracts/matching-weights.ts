import { z } from "zod";

export const weightsSchema = z.object({
  Location: z.number().int().min(0).max(100),
  Budget: z.number().int().min(0).max(100),
  "Home fit": z.number().int().min(0).max(100),
  Lifestyle: z.number().int().min(0).max(100),
});

export type Weights = z.infer<typeof weightsSchema>;
export const defaultWeights: Weights = { Location: 50, Budget: 35, "Home fit": 10, Lifestyle: 5 };
