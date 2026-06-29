import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { HappeningEffect, HappeningResult, SlotResult } from '../types';

// Inject a one-choice happening of the given effects, then resolve it.
function resolveWith(engine: GameEngine, effects: HappeningEffect[]) {
  const happening: HappeningResult = {
    type: 'happening', id: 'test-happening', scene: 's',
    choices: [{ text: 'c', effects }],
    tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
  };
  engine.loadState({ screen: 'happening', happening });
  engine.resolveHappening(0);
}

describe('emergent upheaval (integration)', () => {
  // Mirror the playOneReading helper from Happenings.test.ts.
  function playOneReading(engine: GameEngine) {
    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    engine.selectMethod(idx);
    const result = (engine as unknown as { orchestrator: { drawSingleResult: (t: string, a: object) => SlotResult } })
      .orchestrator.drawSingleResult('d20', engine.getState().affinities);
    engine.completeMinigame(result);
    if (engine.getState().eventQueue.length > 0) engine.finishEventBatch();
    if (engine.getState().awaitingContinue) engine.continueAfterReview();
  }

  it('forced at an extreme: inverts the next reading, leaves base intact, and does not re-fire while active', () => {
    // Stub Math.random so the reading is deterministic: the emergent condition reads
    // the EFFECTIVE chaos at commit, and an unstubbed d20 draw can feed chaos below
    // EMERGENT_THRESHOLD (95) before the condition is evaluated, intermittently
    // disqualifying the forced upheaval. 0.99 also suppresses corruption seeding and
    // the happening-gap so neither perturbs the reading.
    const orig = Math.random;
    Math.random = () => 0.99;
    try {
      const engine = new GameEngine();
      engine.startTurn('self');
      engine.loadState({ affinities: { chaos: 96, order: 30, fate: 50, will: 50, light: 50, shadow: 50 } });
      engine.forceEffects(['emergent-upheaval'], false); // bypass the rare roll; condition still required

      playOneReading(engine); // reading 1 commits → requests upheaval → granted after tick
      const afterFirst = engine.getState();
      // Assert the invariant (effective is the inverted base), not a literal — a d20
      // commit must not move base chaos, but relational assertions are robust either way.
      expect(afterFirst.affinityBase.chaos).toBeGreaterThanOrEqual(90); // base stays high (transform never touches base)
      expect(afterFirst.affinities.chaos).toBe(100 - afterFirst.affinityBase.chaos); // effective = inverted base
      expect(afterFirst.affinities.chaos).toBeLessThan(15); // visibly inverted for reading 2

      engine.forceEffects(['emergent-upheaval'], false); // try to force a second upheaval
      playOneReading(engine); // reading 2: the no-active-upheaval guard blocks it
      // Still a SINGLE inversion (low). A stacked second invert-pair would have flipped
      // chaos back near its base (~96); the guard prevents that.
      expect(engine.getState().affinities.chaos).toBeLessThan(15);
    } finally {
      Math.random = orig;
    }
  });
});

describe('opt-in upheaval (happening effect)', () => {
  it('an upheaval choice inverts EFFECTIVE values without touching base', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    engine.loadState({ affinities: { chaos: 90, order: 20, fate: 50, will: 50, light: 50, shadow: 50 } });
    resolveWith(engine, [{ kind: 'upheaval', transform: { transform: 'invert-pair', axis: 'fortune' }, readings: 2 }]);
    const s = engine.getState();
    expect(s.affinities.chaos).toBe(10);     // 100 - 90 (effective inverted)
    expect(s.affinities.order).toBe(80);     // 100 - 20
    expect(s.affinityBase.chaos).toBe(90);   // base untouched
    expect(s.affinityBase.order).toBe(20);
  });

  it('public grantUpheaval applies a transform and surfaces it on the snapshot', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    engine.loadState({ affinities: { chaos: 50, order: 50, fate: 88, will: 12, light: 50, shadow: 50 } });
    engine.grantUpheaval({ transform: 'invert-pair', axis: 'agency' }, 2, 'test');
    expect(engine.getState().affinities.fate).toBe(12); // 100 - 88
    expect(engine.getState().affinityBase.fate).toBe(88);
  });
});
