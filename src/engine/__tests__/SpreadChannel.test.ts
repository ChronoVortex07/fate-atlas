import { describe, it, expect } from 'vitest';
import { dispatch } from '../events/EventDispatcher';
import { REDUCERS } from '../events/reducers';
import { buildInteractionResponders } from '../responders/interactions';
import { buildAffinityResponders } from '../responders/affinity';
import { consolidateSpread as cs, buildFace as bf, DECK_BY_ID as DB } from '../../data/tarot';
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

describe('spread-internal interactions', () => {
  const all = [...buildAffinityResponders(), ...buildInteractionResponders()];
  const commit = (slot: any) => dispatch('tarot:commit',
    { trigger: 'tarot:commit', affinities: { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50 },
      slots: [], hand: null, spread: [slot], minigame: null, event: null, draft: { outcome: slot }, rng: () => 0.99 } as any,
    all, { forced: [], isolate: false });

  it('all-reversed spread emits a cascade report', () => {
    const slot = cs([bf(DB['cups-2'], 'reversed'), bf(DB['swords-3'], 'reversed'), bf(DB['wands-5'], 'reversed')]);
    const { reports } = commit(slot);
    expect(reports.map((r) => r.responderId)).toContain('spread-cascade');
  });
  it('same-suit spread emits suit-accord', () => {
    const slot = cs([bf(DB['cups-2'], 'upright'), bf(DB['cups-5'], 'upright'), bf(DB['cups-8'], 'upright')]);
    const { reports } = commit(slot);
    expect(reports.map((r) => r.responderId)).toContain('suit-accord');
  });
});
