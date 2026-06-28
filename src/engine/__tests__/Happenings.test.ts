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

  it('upheaval inverts effective and sibling effects also apply (Phase 3)', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    resolveWith(engine, [
      { kind: 'upheaval', transform: { transform: 'invert-pair', axis: 'fortune' }, readings: 2 },
      { kind: 'surge', deltas: { chaos: 20 }, readings: 2 },
    ]);
    const s = engine.getState();
    // base 50 + surge 20 = 70 effective pre-transform; invert-pair on fortune → 100 - 70 = 30
    expect(s.affinities.chaos).toBe(30); // upheaval inverted (base+surge effective)
    expect(s.affinityBase.chaos).toBe(50); // base untouched
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

describe('happening cadence (decoupled from Chaos)', () => {
  // Helper: play one non-happening reading to completion, draining any event batch.
  function playOneReading(engine: GameEngine) {
    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    engine.selectMethod(idx);
    // Cadence cares only about the completed-reading count, so commit a real d20
    // result regardless of the selected method (avoids per-method draw shapes).
    const result = (engine as unknown as { orchestrator: { drawSingleResult: (t: string, a: object) => import('../types').SlotResult } })
      .orchestrator.drawSingleResult('d20', engine.getState().affinities);
    engine.completeMinigame(result);
    if (engine.getState().eventQueue.length > 0) engine.finishEventBatch();
    if (engine.getState().awaitingContinue) engine.continueAfterReview();
  }

  it('offers a happening exactly once per turn, never after the final reading', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    const orig = Math.random;
    Math.random = () => 0.99; // suppress the early-gap chance so it lands on the guaranteed last gap
    try {
      playOneReading(engine);                       // after reading 1 (early gap, chance suppressed)
      expect(engine.getState().screen).not.toBe('happening');
      playOneReading(engine);                       // after reading 2 (last eligible gap → guaranteed)
      expect(engine.getState().screen).toBe('happening');
    } finally {
      Math.random = orig;
    }
  });

  it('does not offer a second happening in the same turn', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    const orig = Math.random;
    Math.random = () => 0; // fire at the first eligible gap
    try {
      playOneReading(engine);
      expect(engine.getState().screen).toBe('happening');
      engine.resolveHappening(0);                   // back to method-select
      playOneReading(engine);                       // second gap — must NOT offer again
      expect(engine.getState().screen).not.toBe('happening');
    } finally {
      Math.random = orig;
    }
  });
});

describe('pendingReadingEffects consumption', () => {
  it('widen-pool grows the next draw by one method and is then consumed', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    const before = engine.getState().availableMethods.length;
    engine.loadState({ pendingReadingEffects: ['widen-pool'] });
    // Re-deal the pool the way the between-reading flow does. buildPool is private
    // and does not call notify(); flush the snapshot with a no-op loadState call.
    (engine as unknown as { buildPool: (b: object, r: boolean) => void }).buildPool({}, true);
    engine.loadState({}); // flush snapshot so getState() reflects the new pool
    const s = engine.getState();
    expect(s.availableMethods.length).toBe(before + 1);
    expect(s.pendingReadingEffects).not.toContain('widen-pool');
  });

  it('guarantee-peek forces the peek gate open for the next reading regardless of Light', () => {
    const engine = new GameEngine();
    engine.startTurn('self'); // base Light 50 → peek normally unavailable
    expect(engine.getState().affinityEffects.peekAvailable).toBe(false);
    engine.loadState({ pendingReadingEffects: ['guarantee-peek'] });
    const idx = engine.getState().availableMethods.findIndex((m) => m !== 'happening');
    engine.selectMethod(idx);
    expect(engine.getState().affinityEffects.peekAvailable).toBe(true);
    expect(engine.getState().pendingReadingEffects).not.toContain('guarantee-peek');
  });

  it('deny-peek forces the peek gate shut even when Light would allow it', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    // Lift Light above the peek gate with a surge (public, deterministic) so the
    // override has something to override: effective light 80 → peekAvailable true.
    engine.grantSurge({ light: 30 }, 3, 'test');
    expect(engine.getState().affinityEffects.peekAvailable).toBe(true);
    engine.loadState({ pendingReadingEffects: ['deny-peek'] });
    const idx = engine.getState().availableMethods.findIndex((m) => m !== 'happening');
    engine.selectMethod(idx);
    expect(engine.getState().affinityEffects.peekAvailable).toBe(false);
  });

  it('grant-reroll makes the next dice roll offer a reroll', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    engine.loadState({ pendingReadingEffects: ['grant-reroll'] });
    const plan = engine.planDiceRoll();
    expect(plan.offerReroll).toBe(true);
    expect(engine.getState().pendingReadingEffects).not.toContain('grant-reroll');
  });
});
