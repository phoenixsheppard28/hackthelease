import { describe, expect, it } from 'vitest';
import { housingProfileSchema, requiredBedrooms, savedProfileSchema } from '../contracts/housing-profile';
import { previewProfile } from './preview-profile';
import { matchingProfile, rankCatalog } from './catalog-matches';
import { demoListings } from '../fixtures/listings';
import { validateAnswer, visibleQuestions } from '../../components/onboarding/questions';

describe('explicit bedroom needs', () => {
  it('requires the survey answer, validates whole numbers, and retains it on the saved profile', () => {
    const question = visibleQuestions(previewProfile).find(question => question.key === 'bedrooms')!;
    expect(question.kind).toBe('number');
    expect(validateAnswer(question, previewProfile)).not.toBeNull();
    for (const bedrooms of [0, 1.5, 22]) {
      expect(housingProfileSchema.safeParse({ ...previewProfile, bedrooms }).success).toBe(false);
      expect(validateAnswer(question, { ...previewProfile, bedrooms })).not.toBeNull();
    }
    expect(validateAnswer(question, { ...previewProfile, bedrooms: 3 })).toBeNull();
    const saved = savedProfileSchema.parse(JSON.parse(JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', profile: { ...previewProfile, bedrooms: 3 } })));
    expect(saved.profile.bedrooms).toBe(3);
    expect(matchingProfile(saved.profile).minimumBeds).toBe(3);
  });

  it('keeps old profiles working with their inferred requirement', () => {
    const legacy = housingProfileSchema.parse(previewProfile);
    expect(legacy.bedrooms).toBeUndefined();
    expect(requiredBedrooms(legacy)).toBe(2);
    expect(matchingProfile(legacy).minimumBeds).toBe(2);
  });

  it('allows sharing but rejects room counts that contradict the group’s sharing choice', () => {
    const shared = { ...previewProfile, roommates: 3, share: 'Yes' as const, occupancy: 2, bedrooms: 2 };
    expect(housingProfileSchema.safeParse(shared).success).toBe(true);
    expect(housingProfileSchema.safeParse({ ...shared, bedrooms: 1 }).success).toBe(false);
    expect(housingProfileSchema.safeParse({ ...shared, share: 'No' }).success).toBe(false);
    const question = visibleQuestions(shared).find(question => question.key === 'bedrooms')!;
    expect(validateAnswer(question, { ...shared, share: 'No' })).toContain('at least 4 bedrooms');
  });

  it('filters known insufficient bedrooms and retains unknown counts for verification', () => {
    const profile = { ...previewProfile, bedrooms: 3 };
    const rows = [2, 3, null].map(beds => ({ listing: { ...demoListings[0], id: `beds-${beds}`, beds }, embedding: null, isDemo: false, images: [], refreshedAt: '2026-11-20' }));
    const matches = rankCatalog(profile, profile.weights, rows, null).matches;
    expect(matches.map(home => home.id)).toEqual(expect.arrayContaining(['beds-3', 'beds-null']));
    expect(matches.some(home => home.id === 'beds-2')).toBe(false);
    expect(matches.find(home => home.id === 'beds-null')?.firmChecks.beds).toBe('unknown');
    expect(rankCatalog(profile, profile.weights, [rows[0]], null, true).matches[0].score).toBeNull();
  });
});
