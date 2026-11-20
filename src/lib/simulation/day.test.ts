import { describe, expect, it } from 'vitest';
import { daySimulationSchema } from './day';

describe('day simulation response', () => {
  it('rejects a scenario without a complete day', () => {
    expect(daySimulationSchema.safeParse({ good: { weather: 'Sunny', overview: '', moments: [], takeaway: '' }, bad: {} }).success).toBe(false);
  });
});
