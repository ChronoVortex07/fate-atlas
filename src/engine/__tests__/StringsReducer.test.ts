import { describe, it, expect } from 'vitest';
import { REDUCERS } from '../events/reducers';
import type { PhaseContext, EffectReport } from '../events/types';

describe('weave combine reducer', () => {
  it('collects draft.weaveReports for batch narration', () => {
    const rep: EffectReport = { responderId: 'coherent-weave', label: 'Coherent Weave', description: '', animation: 'amplify' };
    const ctx = { draft: { weaveReports: [rep] } } as unknown as PhaseContext;
    const result = REDUCERS['weave'].reduce(ctx);
    const arr = Array.isArray(result) ? result : (result ? [result] : []);
    expect(arr).toContainEqual(rep);
  });
});
