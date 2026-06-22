import { describe, it, expect } from 'vitest';
import { dispatch } from '../events/EventDispatcher';
import { REDUCERS } from '../events/reducers';
import type { PhaseContext, Responder } from '../events/types';

function ctx(overrides: Partial<PhaseContext> = {}): PhaseContext {
  return {
    trigger: 'tarot:commit', affinities: { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50 },
    slots: [], hand: null, spread: [], minigame: null, event: null,
    draft: {}, rng: () => 0.0, ...overrides,
  };
}

describe('combine reducer can emit multiple reports', () => {
  it('a channel reducer returning an array pushes all of them', () => {
    REDUCERS['test-multi'] = { channel: 'test-multi', reduce: () => [
      { responderId: 'a', label: 'A', description: 'a', animation: 'x' },
      { responderId: 'b', label: 'B', description: 'b', animation: 'x' },
    ] };
    const r: Responder = {
      id: 'tm', source: 'interaction', triggers: ['tarot:commit'],
      group: { kind: 'combine', channel: 'test-multi' }, condition: () => true, roll: () => true, apply: () => null,
    };
    const { reports } = dispatch('tarot:commit', ctx(), [r], { forced: [], isolate: false });
    expect(reports.map((x) => x.responderId)).toEqual(['a', 'b']);
    delete REDUCERS['test-multi'];
  });
});
