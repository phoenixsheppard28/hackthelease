import type { Weights } from '@/lib/contracts/matching-weights';

export type PriorityEditor = { applied: Weights; draft: Weights; opened: boolean; saving: boolean; error: string };
export type PriorityAction = { type: 'open' | 'cancel' | 'saving' } | { type: 'change' | 'saved' | 'sync'; weights: Weights } | { type: 'failed'; error: string };
export function createPriorityEditor(weights: Weights): PriorityEditor {
  return { applied: { ...weights }, draft: { ...weights }, opened: false, saving: false, error: '' };
}
export function priorityEditorReducer(state: PriorityEditor, action: PriorityAction): PriorityEditor {
  switch (action.type) {
    case 'open': return state.saving ? state : { ...state, draft: { ...state.applied }, opened: true, error: '' };
    case 'change': return state.saving ? state : { ...state, draft: action.weights, error: '' };
    case 'cancel': return state.saving ? state : { ...state, draft: { ...state.applied }, opened: false, error: '' };
    case 'saving': return { ...state, saving: true, error: '' };
    case 'failed': return { ...state, saving: false, error: action.error };
    case 'saved': return createPriorityEditor(action.weights);
    case 'sync': return state.opened ? { ...state, applied: action.weights } : createPriorityEditor(action.weights);
  }
}
