import { z } from 'zod';

const moment = z.object({
  time: z.string().max(20),
  title: z.string().max(90),
  place: z.string().max(100),
  description: z.string().max(500),
  travel: z.string().max(160),
});

const scenario = z.object({
  weather: z.string().max(140),
  overview: z.string().max(500),
  moments: z.array(moment).min(4).max(14),
  takeaway: z.string().max(300),
});

export const daySimulationSchema = z.object({ good: scenario, bad: scenario });
export type DaySimulation = z.infer<typeof daySimulationSchema>;

export const daySimulationJsonSchema = {
  type: 'object', additionalProperties: false, required: ['good', 'bad'],
  properties: Object.fromEntries(['good', 'bad'].map(key => [key, {
    type: 'object', additionalProperties: false, required: ['weather', 'overview', 'moments', 'takeaway'],
    properties: {
      weather: { type: 'string' }, overview: { type: 'string' }, takeaway: { type: 'string' },
      moments: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['time', 'title', 'place', 'description', 'travel'],
        properties: Object.fromEntries(['time', 'title', 'place', 'description', 'travel'].map(field => [field, { type: 'string' }])) } },
    },
  }])),
} as const;
