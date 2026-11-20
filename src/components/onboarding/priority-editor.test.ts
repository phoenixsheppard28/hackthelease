import { expect, it } from 'vitest';
import { defaultWeights } from '@/lib/contracts/matching-weights';
import { createPriorityEditor, priorityEditorReducer as reduce } from './priority-editor';

const changed = { ...defaultWeights, Location: 1, Budget: 100 };
function editing() {
  return reduce(reduce(createPriorityEditor(defaultWeights), { type: 'open' }), { type: 'change', weights: changed });
}

it('keeps the ranking unchanged while editing and discards canceled changes', () => {
  const state = editing();
  expect(state.applied).toEqual(defaultWeights);
  expect(state.draft).toEqual(changed);
  const canceled = reduce(state, { type: 'cancel' });
  expect(canceled.opened).toBe(false);
  expect(reduce(canceled, { type: 'open' }).draft).toEqual(defaultWeights);
});

it('keeps the previous ranking on a failed save and preserves the draft for retry', () => {
  const failed = reduce(reduce(editing(), { type: 'saving' }), { type: 'failed', error: 'Could not save' });
  expect(failed.applied).toEqual(defaultWeights);
  expect(failed.draft).toEqual(changed);
  expect(failed.opened).toBe(true);
  expect(failed.saving).toBe(false);
  const saved = reduce(reduce(failed, { type: 'saving' }), { type: 'saved', weights: changed });
  expect(saved.applied).toEqual(changed);
  expect(saved.opened).toBe(false);
  expect(saved.error).toBe('');
});

it('does not allow changes or cancellation during a save', () => {
  const saving = reduce(editing(), { type: 'saving' });
  expect(reduce(saving, { type: 'cancel' })).toBe(saving);
  expect(reduce(saving, { type: 'change', weights: defaultWeights })).toBe(saving);
});
