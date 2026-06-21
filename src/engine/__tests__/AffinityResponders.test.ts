import { describe, it, expect } from 'vitest';
import { dispatch } from '../events/EventDispatcher';
import { buildAffinityResponders } from '../responders/affinity';
import { bandRoll } from '../events/eligibility';
import type { PhaseContext } from '../events/types';
import { defaultAffinityState } from '../../data/affinities';

function ctx(over: Partial<PhaseContext> = {}): PhaseContext {
  return {
    trigger: 't', affinities: defaultAffinityState(), slots: [], hand: null, spread: [],
    minigame: null, event: null, rng: () => 0.0, draft: {}, ...over,
  };
}
const noDebug = { forced: [], isolate: false };

describe('bandRoll', () => {
  it('returns false below the gate band regardless of rng', () => {
    const c = ctx({ affinities: { ...defaultAffinityState(), light: 10 }, rng: () => 0 });
    expect(bandRoll(c, 'light', 'ascendant', 0.5)).toBe(false);
  });
  it('returns true in-band when rng is below the scaled chance', () => {
    const c = ctx({ affinities: { ...defaultAffinityState(), light: 75 }, rng: () => 0 });
    expect(bandRoll(c, 'light', 'ascendant', 0.5)).toBe(true);
  });
});

describe('affinity responders via dispatch', () => {
  it('will-widen-pool raises the pool target when forced', () => {
    const c = ctx({ trigger: 'select:draw:start', draft: { poolTarget: 3 } });
    dispatch('select:draw:start', c, buildAffinityResponders(), { forced: ['will-widen-pool'], isolate: true });
    expect(c.draft.poolTarget).toBe(4);
  });

  it('shadow-shroud marks a pool index when forced', () => {
    const pool = [{ type: 'tarot' }, { type: 'tarot' }] as any;
    const c = ctx({ trigger: 'select:draw:end', draft: { pool } });
    dispatch('select:draw:end', c, buildAffinityResponders(), { forced: ['shadow-shroud'], isolate: true });
    expect(c.draft.shrouded!.length).toBe(1);
  });

  it('fate-override-pick: no reassignment when all hand entries are reference-equal to outcome', () => {
    const card = { type: 'tarot', id: 'fool' } as any;
    const c = ctx({
      trigger: 'tarot:pick',
      hand: [card, card],
      draft: { outcome: card },
      affinities: { ...defaultAffinityState(), fate: 100 },
      rng: () => 0,
    });
    const { reports } = dispatch('tarot:pick', c, buildAffinityResponders(), { forced: ['fate-override-pick'], isolate: true });
    expect(c.draft.outcome).toBe(card);
    expect(reports).toHaveLength(0);
  });

  it('fate-override-pick: replaces outcome with a distinct hand card when candidates exist', () => {
    const original = { type: 'tarot', id: 'fool' } as any;
    const other = { type: 'tarot', id: 'tower' } as any;
    const c = ctx({
      trigger: 'tarot:pick',
      hand: [original, other],
      draft: { outcome: original },
      affinities: { ...defaultAffinityState(), fate: 100 },
      rng: () => 0,
    });
    const { reports } = dispatch('tarot:pick', c, buildAffinityResponders(), { forced: ['fate-override-pick'], isolate: true });
    expect(c.draft.outcome).toBe(other);
    expect(reports).toHaveLength(1);
    expect(reports[0].responderId).toBe('fate-override-pick');
  });

  it('light-advantage + shadow-disadvantage cancel to single', () => {
    const c = ctx({
      trigger: 'dice:roll',
      affinities: { ...defaultAffinityState(), light: 75, shadow: 75 },
      rng: () => 0, draft: { rollMods: [] },
    });
    dispatch('dice:roll', c, buildAffinityResponders(), noDebug);
    expect(c.draft.rollMode).toBe('single');
  });
});
