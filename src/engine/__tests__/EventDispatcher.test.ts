import { describe, it, expect } from 'vitest';
import { dispatch } from '../events/EventDispatcher';
import type { Responder, PhaseContext, PriorityBand } from '../events/types';

function ctx(over: Partial<PhaseContext> = {}): PhaseContext {
  return {
    trigger: 't', affinities: {} as any, slots: [], hand: null, spread: [],
    minigame: null, event: null, rng: () => 0.5, draft: {}, ...over,
  };
}

function effect(id: string, band: PriorityBand, opts: Partial<Responder> = {}): Responder {
  return {
    id, source: 'affinity', triggers: ['t'], group: { kind: 'exclusive', band },
    condition: () => true, roll: () => true,
    apply: (c) => { (c.draft as any)[id] = true; return { responderId: id, label: id, description: id, animation: id }; },
    ...opts,
  };
}

describe('dispatch', () => {
  it('runs one eligible exclusive effect', () => {
    const { reports } = dispatch('t', ctx(), [effect('a', 'MUTATE')], { forced: [], isolate: false });
    expect(reports.map((r) => r.responderId)).toEqual(['a']);
  });

  it('different bands both fire, in band order', () => {
    const c = ctx();
    const { reports } = dispatch('t', c, [effect('m', 'MUTATE'), effect('s', 'STRUCTURAL')], { forced: [], isolate: false });
    expect(reports.map((r) => r.responderId)).toEqual(['s', 'm']); // STRUCTURAL before MUTATE
  });

  it('same band → only one fires', () => {
    const c = ctx({ rng: () => 0.0 }); // weighted pick lands on first
    const { reports } = dispatch('t', c, [effect('a', 'MUTATE'), effect('b', 'MUTATE')], { forced: [], isolate: false });
    expect(reports).toHaveLength(1);
  });

  it('roll() false suppresses the effect', () => {
    const r = effect('a', 'MUTATE', { roll: () => false });
    const { reports } = dispatch('t', ctx(), [r], { forced: [], isolate: false });
    expect(reports).toHaveLength(0);
  });

  it('forced bypasses roll() and is reported as consumed', () => {
    const r = effect('a', 'MUTATE', { roll: () => false });
    const { reports, forcedConsumed } = dispatch('t', ctx(), [r], { forced: ['a'], isolate: false });
    expect(reports).toHaveLength(1);
    expect(forcedConsumed).toEqual(['a']);
  });

  it('forced never bypasses condition()', () => {
    const r = effect('a', 'MUTATE', { condition: () => false });
    const { reports } = dispatch('t', ctx(), [r], { forced: ['a'], isolate: false });
    expect(reports).toHaveLength(0);
  });

  it('isolate suppresses all non-forced responders', () => {
    const a = effect('a', 'MUTATE');
    const b = effect('b', 'STRUCTURAL');
    const { reports } = dispatch('t', ctx(), [a, b], { forced: ['a'], isolate: true });
    expect(reports.map((r) => r.responderId)).toEqual(['a']);
  });

  it('combine channel runs its reducer after contributors push', () => {
    const adv: Responder = {
      id: 'adv', source: 'affinity', triggers: ['t'], group: { kind: 'combine', channel: 'roll-mode' },
      condition: () => true, roll: () => true,
      apply: (c) => { (c.draft.rollMods ??= []).push('advantage' as any); return null; },
    };
    const c = ctx({ draft: { rollMods: [] } });
    const { reports } = dispatch('t', c, [adv], { forced: [], isolate: false });
    expect(c.draft.rollMode).toBe('advantage');
    expect(reports.some((r) => r.animation === 'roll-mode')).toBe(true);
  });
});
