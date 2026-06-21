import { describe, it, expect } from 'vitest';
import { REDUCERS } from '../events/reducers';
import type { PhaseContext } from '../events/types';

function ctx(rollMods: string[]): PhaseContext {
  return {
    trigger: 'dice:roll', affinities: {} as any, slots: [], hand: null, spread: [],
    minigame: null, event: null, rng: () => 0.5,
    draft: { rollMods: rollMods as any },
  };
}

describe('roll-mode reducer', () => {
  it('nets advantage + disadvantage to single and reports nothing', () => {
    const c = ctx(['advantage', 'disadvantage']);
    const report = REDUCERS['roll-mode'].reduce(c);
    expect(c.draft.rollMode).toBe('single');
    expect(report).toBeNull(); // single, no reroll → no notable event
  });

  it('choice trumps and reports', () => {
    const c = ctx(['advantage', 'disadvantage', 'choice']);
    const report = REDUCERS['roll-mode'].reduce(c);
    expect(c.draft.rollMode).toBe('choice');
    expect(report).not.toBeNull();
    expect(report!.animation).toBe('roll-mode');
  });

  it('no mods → null and leaves mode single', () => {
    const c = ctx([]);
    expect(REDUCERS['roll-mode'].reduce(c)).toBeNull();
  });
});
