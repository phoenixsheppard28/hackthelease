import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { demoListings } from '../fixtures/listings';
import {
  listingFromRow,
  listingMergeKey,
  listingToRow,
  normalizeAddress,
  normalizeUnit,
  type ListingInput,
} from './listing-rows';

const { id: _id, isActive: _isActive, ...demoInput } = demoListings[0];
const listingInput: ListingInput = demoInput;
const sourceId = 'source-oxford';

describe('address and unit normalization', () => {
  it('reduces spelling variants of one address to the same value', () => {
    expect(normalizeAddress('625 South State Street, Ann Arbor, MI')).toBe(
      '625 s state st ann arbor mi',
    );
    expect(normalizeAddress('  625 S. State St.,  Ann Arbor MI ')).toBe(
      '625 s state st ann arbor mi',
    );
  });

  it('removes unit prefixes and treats a blank unit as unknown', () => {
    expect(normalizeUnit('Apt. #2B')).toBe('2b');
    expect(normalizeUnit('Unit 2b')).toBe('2b');
    expect(normalizeUnit('#2B')).toBe('2b');
    expect(normalizeUnit('  ')).toBeNull();
    expect(normalizeUnit(null)).toBeNull();
  });
});

describe('listingMergeKey', () => {
  it('merges listings with the same normalized address and unit', () => {
    const variant = {
      ...listingInput,
      address: '625 S. State St., Ann Arbor, MI',
      unit: 'Apt #2b',
      sources: [{ url: 'https://example.com/other', fetchedAt: '2026-11-20T00:00:00Z' }],
    };

    expect(listingMergeKey(variant, sourceId)).toBe(listingMergeKey(listingInput, sourceId));
  });

  it('keeps the same address and unit separate across sources', () => {
    expect(listingMergeKey(listingInput, 'source-cabrio')).not.toBe(
      listingMergeKey(listingInput, sourceId),
    );
  });

  it('keeps listings with an unknown unit separate per source page', () => {
    const first = { ...listingInput, unit: null };
    const second = {
      ...first,
      sources: [{ url: 'https://example.com/other', fetchedAt: '2026-11-20T00:00:00Z' }],
    };

    expect(listingMergeKey(first, sourceId)).not.toBe(listingMergeKey(second, sourceId));
    expect(listingMergeKey(first, sourceId)).toBe(listingMergeKey({ ...first }, sourceId));
  });
});

describe('listingToRow', () => {
  it('keeps the text hash when only rent changes', () => {
    const rentChange = { ...listingInput, rentMin: 1100, rentMax: 1100 };

    expect(listingToRow(rentChange, sourceId).text_hash).toBe(
      listingToRow(listingInput, sourceId).text_hash,
    );
    expect(listingToRow(listingInput, sourceId).searchable_text).not.toContain('980');
  });

  it('changes the text hash when descriptive text changes', () => {
    const descriptionChange = { ...listingInput, description: 'Quiet building near the Diag.' };

    expect(listingToRow(descriptionChange, sourceId).text_hash).not.toBe(
      listingToRow(listingInput, sourceId).text_hash,
    );
  });

  it('uses the latest source fetch time as the refresh time', () => {
    const twoSources = {
      ...listingInput,
      sources: [
        { url: 'https://example.com/a', fetchedAt: '2026-11-19T20:00:00Z' },
        { url: 'https://example.com/b', fetchedAt: '2026-11-19T21:00:00-02:00' },
      ],
    };

    expect(listingToRow(twoSources, sourceId).refreshed_at).toBe('2026-11-19T21:00:00-02:00');
  });
});

describe('listingFromRow', () => {
  it('maps a stored row back to the Listing contract', () => {
    const row = {
      ...listingToRow(listingInput, sourceId),
      id: demoListings[0].id,
      is_active: true,
      is_demo: true,
      embedding: null,
      availability_report: null,
      created_at: '2026-11-19T20:00:00+00:00',
      updated_at: '2026-11-19T20:00:00+00:00',
    };

    expect(listingFromRow(row)).toEqual(demoListings[0]);
  });
});

describe('demo seed', () => {
  it('stores the same keys and searchable text that listingToRow computes', () => {
    const seed = readFileSync('supabase/seed.sql', 'utf8');

    for (const { id: _demoId, isActive: _demoActive, ...demo } of demoListings) {
      const row = listingToRow(demo, 'demo');

      expect(seed).toContain(`'${row.merge_key}'`);
      expect(seed).toContain(`'${row.normalized_address}'`);
      expect(seed).toContain(`E'${row.searchable_text.replaceAll('\n', '\\n')}'`);
    }
  });
});
