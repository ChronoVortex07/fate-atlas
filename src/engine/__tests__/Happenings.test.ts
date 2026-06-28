import { describe, it, expect } from 'vitest';
import { HAPPENINGS, selectHappening, dominantAxis, choiceCue } from '../../data/happenings';
import { defaultAffinityState } from '../../data/affinities';
import type { HappeningEffect } from '../types';
import { GameEngine } from '../GameEngine';
import type { HappeningResult } from '../types';

// Inject a one-choice happening of the given effects directly onto state, then resolve it.
function resolveWith(engine: GameEngine, effects: HappeningEffect[]) {
  const happening: HappeningResult = {
    type: 'happening', id: 'test-happening', scene: 's',
    choices: [{ text: 'c', effects }],
    tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
  };
  engine.loadState({ screen: 'happening', happening });
  engine.resolveHappening(0);
}

const aff = (over: Partial<Record<string, number>> = {}) => ({ ...defaultAffinityState(), ...over } as Record<import('../types').AffinityId, number>);

describe('happenings data + selection', () => {
  it('every happening choice carries at least one effect and valid axes', () => {
    for (const h of HAPPENINGS) {
      expect(h.axes.length).toBeGreaterThan(0);
      for (const c of h.choices) expect(c.effects.length).toBeGreaterThan(0);
    }
  });

  it('dominantAxis picks the pair with the widest spread', () => {
    expect(dominantAxis(aff({ chaos: 90, order: 10 }))).toBe('fortune');
    expect(dominantAxis(aff({ light: 88, shadow: 20 }))).toBe('information');
    expect(dominantAxis(aff({ fate: 85, will: 15 }))).toBe('agency');
  });

  it('selectHappening biases toward the dominant axis (information-heavy → an information scene)', () => {
    const orig = Math.random;
    // Information-dominant weights (data order): crossroads 1, falling-star 2, … total 13.
    // roll = 0.1 × 13 = 1.3 → skips crossroads (w1), lands in falling-star's (1,3] band:
    // an `information` scene. (Deterministic given the data as authored in this task.)
    Math.random = () => 0.1;
    try {
      const picked = selectHappening([], aff({ light: 95, shadow: 5 }));
      expect(picked.axes).toContain('information');
    } finally {
      Math.random = orig;
    }
  });

  it('choiceCue derives the fiction cue from effect kinds', () => {
    expect(choiceCue([{ kind: 'cost', affinity: 'order', amount: 10 }] as HappeningEffect[])).toBe('price');
    expect(choiceCue([{ kind: 'upheaval', transform: { transform: 'invert-pair', axis: 'fortune' }, readings: 2 }] as HappeningEffect[])).toBe('tear');
    expect(choiceCue([{ kind: 'gamble', outcomes: [] }] as HappeningEffect[])).toBe('fortune');
    expect(choiceCue([{ kind: 'shift', affinity: 'order', amount: 6 }] as HappeningEffect[])).toBeNull();
  });
});

describe('resolveHappening effect resolution', () => {
  it('shift nudges base permanently', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    resolveWith(engine, [{ kind: 'shift', affinity: 'order', amount: 6 }]);
    expect(engine.getState().affinityBase.order).toBeGreaterThan(50);
  });

  it('cost drains the affinity (applied as a negative shift)', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    resolveWith(engine, [{ kind: 'cost', affinity: 'order', amount: 10 }]);
    expect(engine.getState().affinityBase.order).toBeLessThan(50);
  });

  it('surge spikes effective without touching base', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    resolveWith(engine, [{ kind: 'surge', deltas: { chaos: 30 }, readings: 3 }]);
    const s = engine.getState();
    expect(s.affinityBase.chaos).toBe(50);
    expect(s.affinities.chaos).toBe(80);
  });

  it('reading effect is enqueued onto pendingReadingEffects', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    resolveWith(engine, [{ kind: 'reading', effect: 'guarantee-peek' }]);
    expect(engine.getState().pendingReadingEffects).toContain('guarantee-peek');
  });

  it('gamble resolves exactly one weighted outcome', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    const orig = Math.random; Math.random = () => 0; // lands on the first outcome
    try {
      resolveWith(engine, [{ kind: 'gamble', outcomes: [
        { weight: 1, effects: [{ kind: 'shift', affinity: 'light', amount: 8 }] },
        { weight: 1, effects: [{ kind: 'shift', affinity: 'shadow', amount: 8 }] },
      ] }]);
    } finally { Math.random = orig; }
    const s = engine.getState();
    expect(s.affinityBase.light).toBeGreaterThan(50);
    expect(s.affinityBase.shadow).toBeLessThanOrEqual(50); // the other outcome did NOT fire
  });

  it('upheaval is a no-op stub in Phase 2 but sibling effects still apply', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    resolveWith(engine, [
      { kind: 'upheaval', transform: { transform: 'invert-pair', axis: 'fortune' }, readings: 2 },
      { kind: 'surge', deltas: { chaos: 20 }, readings: 2 },
    ]);
    const s = engine.getState();
    expect(s.affinities.chaos).toBe(70); // surge applied
    expect(s.affinityBase.chaos).toBe(50); // upheaval did NOT transform/mutate anything
  });

  it('startTurn clears pendingReadingEffects', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    // Use guarantee-peek (consumed at reading start, NOT during resolveHappening's
    // buildPool) so this stays queued here and at Task 5 — widen-pool/shroud-card
    // would be drained by the buildPool inside resolveHappening once Task 5 lands.
    resolveWith(engine, [{ kind: 'reading', effect: 'guarantee-peek' }]);
    expect(engine.getState().pendingReadingEffects.length).toBeGreaterThan(0);
    engine.startTurn('self');
    expect(engine.getState().pendingReadingEffects).toEqual([]);
  });
});
