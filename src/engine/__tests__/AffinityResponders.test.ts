import { describe, it, expect } from 'vitest';
import { dispatch } from '../events/EventDispatcher';
import { buildAffinityResponders } from '../responders/affinity';
import { buildInteractionResponders } from '../responders/interactions';
import { bandRoll } from '../events/eligibility';
import type { PhaseContext } from '../events/types';
import { defaultAffinityState } from '../../data/affinities';
import { buildFace, consolidateSpread, DECK_BY_ID } from '../../data/tarot';

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

  it('shadow-shroud: at Stirring with all rolls passing, shrouds exactly one', () => {
    const pool = [{ type: 'tarot' }, { type: 'tarot' }, { type: 'tarot' }] as any;
    const c = ctx({
      trigger: 'select:draw:end', draft: { pool },
      affinities: { ...defaultAffinityState(), shadow: 40 }, // Stirring
      rng: () => 0, // every roll passes
    });
    dispatch('select:draw:end', c, buildAffinityResponders(), { forced: ['shadow-shroud'], isolate: true });
    expect(new Set(c.draft.shrouded!).size).toBe(1);
  });

  it('shadow-shroud: at Dominant with all rolls passing, shrouds three distinct indices', () => {
    const pool = [{ type: 'tarot' }, { type: 'tarot' }, { type: 'tarot' }] as any;
    const c = ctx({
      trigger: 'select:draw:end', draft: { pool },
      affinities: { ...defaultAffinityState(), shadow: 95 }, // Dominant
      rng: () => 0,
    });
    dispatch('select:draw:end', c, buildAffinityResponders(), { forced: ['shadow-shroud'], isolate: true });
    expect(new Set(c.draft.shrouded!).size).toBe(3);
  });

  it('shadow-shroud: caps shroud count at pool length', () => {
    const pool = [{ type: 'tarot' }, { type: 'tarot' }] as any; // only 2
    const c = ctx({
      trigger: 'select:draw:end', draft: { pool },
      affinities: { ...defaultAffinityState(), shadow: 95 },
      rng: () => 0,
    });
    dispatch('select:draw:end', c, buildAffinityResponders(), { forced: ['shadow-shroud'], isolate: true });
    expect(new Set(c.draft.shrouded!).size).toBe(2);
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

  it('fate-thin-pool decrements poolTarget, guarded above 2', () => {
    const c = ctx({ trigger: 'select:draw:start', draft: { poolTarget: 4 },
      affinities: { ...defaultAffinityState(), fate: 75 } });
    dispatch('select:draw:start', c, buildAffinityResponders(), { forced: ['fate-thin-pool'], isolate: true });
    expect(c.draft.poolTarget).toBe(3);
  });

  it('fate-thin-pool does not fire at poolTarget 2 (condition guard)', () => {
    const c = ctx({ trigger: 'select:draw:start', draft: { poolTarget: 2 },
      affinities: { ...defaultAffinityState(), fate: 75 } });
    dispatch('select:draw:start', c, buildAffinityResponders(), { forced: ['fate-thin-pool'], isolate: true });
    expect(c.draft.poolTarget).toBe(2);
  });

  it('fate-auto-orient spreads the orientation via reverseSpread', () => {
    const face = buildFace(DECK_BY_ID['the-fool'], 'upright');
    const card = { type: 'tarot', id: 'the-fool', name: 'The Fool', number: 0, orientation: 'upright', symbol: '☉',
      meaningUpright: 'x', meaningReversed: 'y', tags: ['major-arcana', 'reversible', 'upright'],
      themes: ['renewal'], dimensions: { favorability: 0.5, certainty: -1.5, volatility: 1.5 },
      modifierRoles: ['subject'], spread: [{ position: 'present', card: face }] } as any;
    const c = ctx({ trigger: 'tarot:orient', draft: { outcome: card },
      affinities: { ...defaultAffinityState(), fate: 75 }, rng: () => 0.0 });
    dispatch('tarot:orient', c, buildAffinityResponders(), { forced: ['fate-auto-orient'], isolate: true });
    expect((c.draft.outcome as any).orientation).toBe('reversed'); // rng 0.0 < 0.5 triggers reverseSpread
  });

  it('fate-hollow-reroll reverts to the previous die', () => {
    const prev = { type: 'd20', result: 3 } as any;
    const curr = { type: 'd20', result: 18 } as any;
    const c = ctx({ trigger: 'dice:reroll', draft: { outcome: curr }, event: { previous: prev },
      affinities: { ...defaultAffinityState(), fate: 90 } });
    dispatch('dice:reroll', c, buildAffinityResponders(), { forced: ['fate-hollow-reroll'], isolate: true });
    expect(c.draft.outcome).toBe(prev);
  });

  it('chaos-second-result sets spawnSecond to the committed type', () => {
    const c = ctx({ trigger: 'dice:commit', draft: { outcome: { type: 'd20' } as any },
      affinities: { ...defaultAffinityState(), chaos: 95 } });
    dispatch('dice:commit', c, buildAffinityResponders(), { forced: ['chaos-second-result'], isolate: true });
    expect(c.draft.spawnSecond).toBe('d20');
  });

  it('chaos-happening-interrupt sets interruptHappening when not the last reading', () => {
    const c = ctx({ trigger: 'minigame:end', draft: { lastReading: false },
      affinities: { ...defaultAffinityState(), chaos: 75 } });
    dispatch('minigame:end', c, buildAffinityResponders(), { forced: ['chaos-happening-interrupt'], isolate: true });
    expect(c.draft.interruptHappening).toBe(true);
  });

  it('chaos-happening-interrupt does not fire on the last reading (condition guard)', () => {
    const c = ctx({ trigger: 'minigame:end', draft: { lastReading: true },
      affinities: { ...defaultAffinityState(), chaos: 75 } });
    dispatch('minigame:end', c, buildAffinityResponders(), { forced: ['chaos-happening-interrupt'], isolate: true });
    expect(c.draft.interruptHappening).toBeUndefined();
  });

  it('will-choice trumps offer-reroll in the roll-mode reducer', () => {
    const c = ctx({ trigger: 'dice:roll', draft: { rollMods: [] },
      affinities: { ...defaultAffinityState(), will: 95 }, rng: () => 0 });
    dispatch('dice:roll', c, buildAffinityResponders(), noDebug);
    expect(c.draft.rollMode).toBe('choice');
  });

  it('will-offer-reroll surfaces offerReroll without forcing a mode', () => {
    const c = ctx({ trigger: 'dice:roll', draft: { rollMods: [] },
      affinities: { ...defaultAffinityState(), will: 50 }, rng: () => 0 });
    dispatch('dice:roll', c, buildAffinityResponders(), { forced: ['will-offer-reroll'], isolate: true });
    expect(c.draft.offerReroll).toBe(true);
  });
});

describe('spread-aware repurposed responders', () => {
  it('fate-deal-swap is registered on tarot:deal and fate-override-pick is gone', () => {
    const ids = buildAffinityResponders().map((r) => r.id);
    expect(ids).toContain('fate-deal-swap');
    expect(ids).not.toContain('fate-override-pick');
    const swap = buildAffinityResponders().find((r) => r.id === 'fate-deal-swap')!;
    expect(swap.triggers).toContain('tarot:deal');
  });
  it('fate-auto-orient now triggers on tarot:orient', () => {
    const r = buildAffinityResponders().find((x) => x.id === 'fate-auto-orient')!;
    expect(r.triggers).toContain('tarot:orient');
  });
});

describe("Fool's Reroll across the spread", () => {
  it('fires when The Fool is any position in a committed spread', () => {
    const foolReroll = buildInteractionResponders().find((r) => r.id === 'fool-reroll')!;
    const spreadSlot = consolidateSpread([
      buildFace(DECK_BY_ID['cups-2'], 'upright'),
      buildFace(DECK_BY_ID['the-fool'], 'upright'),
      buildFace(DECK_BY_ID['swords-3'], 'upright'),
    ]);
    const die = { type: 'd20', result: 10, threshold: 'neutral', interpretation: '', tags: ['draw'], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: ['effect'] };
    const ctx = {
      trigger: 'dice:commit', affinities: {} as PhaseContext['affinities'],
      slots: [spreadSlot] as PhaseContext['slots'], hand: null, spread: [spreadSlot, die] as PhaseContext['spread'],
      minigame: null, event: null, draft: { outcome: die as PhaseContext['draft']['outcome'] }, rng: () => 0,
    } as PhaseContext;
    expect(foolReroll.condition(ctx)).toBe(true);
  });
});
