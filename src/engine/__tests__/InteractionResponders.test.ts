import { describe, it, expect } from 'vitest';
import { dispatch } from '../events/EventDispatcher';
import { buildInteractionResponders } from '../responders/interactions';
import type { PhaseContext } from '../events/types';
import { defaultAffinityState } from '../../data/affinities';
import { buildFace, DECK_BY_ID } from '../../data/tarot';

const fool = { type: 'tarot', tags: ['major-arcana', 'fool-archetype', 'reversible'], orientation: 'upright' } as any;
const critLow = { type: 'd20', threshold: 'critical-low', tags: ['threshold', 'critical-low'] } as any;

function spreadCard(id: string, orientation: 'upright' | 'reversed') {
  const face = buildFace(DECK_BY_ID[id], orientation);
  return {
    type: 'tarot', id, name: face.name, number: face.number ?? 0,
    orientation, symbol: face.symbol,
    meaningUpright: face.meaningUpright, meaningReversed: face.meaningReversed,
    tags: ['major-arcana', 'reversible', orientation],
    themes: face.themes, dimensions: { ...face.dimensions },
    modifierRoles: [...face.modifierRoles],
    spread: [{ position: 'present', card: face }],
  } as any;
}

function ctx(over: Partial<PhaseContext> = {}): PhaseContext {
  const base: PhaseContext = {
    trigger: 't', affinities: defaultAffinityState(), slots: [], hand: null, spread: [],
    minigame: null, event: null, rng: () => 0.0, draft: {},
  };
  return { ...base, ...over };
}
const noDebug = { forced: [], isolate: false };

describe('interaction responders', () => {
  it('fool-reroll marks the die for redraw when The Fool is in the spread', () => {
    const c = ctx({ trigger: 'dice:commit', slots: [fool], spread: [fool], draft: { outcome: { type: 'd20' } as any } });
    dispatch('dice:commit', c, buildInteractionResponders(), noDebug);
    expect(c.draft.rerollOutcome).toBe(true);
  });

  it('critical-resonance inverts an upright tarot when a critical-low die is present', () => {
    const card = spreadCard('the-fool', 'upright');
    const c = ctx({ trigger: 'tarot:commit', slots: [critLow], spread: [critLow, card], draft: { outcome: card } });
    dispatch('tarot:commit', c, buildInteractionResponders(), noDebug);
    expect((c.draft.outcome as any).orientation).toBe('reversed');
  });

  it('mirror flips the committed outcome when two reversible items are present', () => {
    const a = { type: 'tarot', orientation: 'upright', tags: ['reversible'] } as any;
    const b = spreadCard('the-tower', 'reversed');
    const c = ctx({ trigger: 'tarot:commit', spread: [a, b], rng: () => 0, draft: { outcome: b } });
    dispatch('tarot:commit', c, buildInteractionResponders(), noDebug);
    expect((c.draft.outcome as any).orientation).toBe('upright');
  });

  it('critical-resonance: reversed tarot + critical-high die flips to upright', () => {
    const critHigh = { type: 'd20', threshold: 'critical-high', tags: ['threshold', 'critical-high'] } as any;
    const card = spreadCard('the-tower', 'reversed');
    const c = ctx({ trigger: 'tarot:commit', slots: [critHigh], spread: [critHigh, card], draft: { outcome: card } });
    dispatch('tarot:commit', c, buildInteractionResponders(), noDebug);
    expect((c.draft.outcome as any).orientation).toBe('upright');
  });

  it('critical-resonance: non-matching pairing (upright + critical-high) does not fire', () => {
    const critHigh = { type: 'd20', threshold: 'critical-high', tags: ['threshold', 'critical-high'] } as any;
    const card = { type: 'tarot', orientation: 'upright', tags: ['major-arcana', 'reversible'] } as any;
    const c = ctx({ trigger: 'tarot:commit', slots: [critHigh], spread: [critHigh, card], draft: { outcome: card } });
    const { reports } = dispatch('tarot:commit', c, buildInteractionResponders(), noDebug);
    expect((c.draft.outcome as any).orientation).toBe('upright');
    expect(reports.some((r) => r.responderId === 'critical-resonance')).toBe(false);
  });

  it('iching-happening-boost: changing-lines hexagram in spread sets addChoice at happening:start', () => {
    const hex = { type: 'iching', tags: ['changing-lines'], changingLines: [0, 2] } as any;
    const c = ctx({ trigger: 'happening:start', slots: [hex], spread: [hex], draft: {} });
    dispatch('happening:start', c, buildInteractionResponders(), noDebug);
    expect(c.draft.addChoice).toBe(true);
  });

  it('fool-reroll reports the Fool index as sourceSlot', () => {
    const other = { type: 'iching', tags: [] } as any;
    const c = ctx({ trigger: 'dice:commit', slots: [other, fool], spread: [other, fool], draft: { outcome: { type: 'd20' } as any } });
    const { reports } = dispatch('dice:commit', c, buildInteractionResponders(), noDebug);
    const r = reports.find((x) => x.responderId === 'fool-reroll')!;
    expect(r.sourceSlot).toBe(1);
  });

  it('critical-resonance reports the critical die index as sourceSlot', () => {
    const card = spreadCard('the-fool', 'upright');
    const c = ctx({ trigger: 'tarot:commit', slots: [critLow], spread: [critLow, card], draft: { outcome: card } });
    const { reports } = dispatch('tarot:commit', c, buildInteractionResponders(), noDebug);
    const r = reports.find((x) => x.responderId === 'critical-resonance')!;
    expect(r.sourceSlot).toBe(0);
  });

  it('mirror reports both reversible indices as sourceSlot/targetSlot', () => {
    const a = { type: 'tarot', orientation: 'upright', tags: ['reversible'] } as any;
    const b = spreadCard('the-tower', 'reversed');
    const c = ctx({ trigger: 'tarot:commit', spread: [a, b], rng: () => 0, draft: { outcome: b } });
    const { reports } = dispatch('tarot:commit', c, buildInteractionResponders(), noDebug);
    const r = reports.find((x) => x.responderId === 'mirror')!;
    expect(r.sourceSlot).toBe(0);
    expect(r.targetSlot).toBe(1);
  });

  it('iching-happening-boost reports the changing-lines hex index as sourceSlot', () => {
    const pad = { type: 'd20', tags: [] } as any;
    const hex = { type: 'iching', tags: ['changing-lines'], changingLines: [0, 2] } as any;
    const c = ctx({ trigger: 'happening:start', slots: [pad, hex], spread: [pad, hex], draft: {} });
    const { reports } = dispatch('happening:start', c, buildInteractionResponders(), noDebug);
    const r = reports.find((x) => x.responderId === 'iching-happening-boost')!;
    expect(r.sourceSlot).toBe(1);
  });

  it('iching-resonant-change reports the reversible non-iching index as sourceSlot', () => {
    const rev = { type: 'tarot', orientation: 'upright', tags: ['reversible'] } as any;
    const out = { type: 'iching', tags: ['changing-lines'] } as any;
    const c = ctx({ trigger: 'iching:commit', slots: [rev], spread: [rev], draft: { outcome: out } });
    const { reports } = dispatch('iching:commit', c, buildInteractionResponders(), noDebug);
    const r = reports.find((x) => x.responderId === 'iching-resonant-change')!;
    expect(r.sourceSlot).toBe(0);
  });
});
