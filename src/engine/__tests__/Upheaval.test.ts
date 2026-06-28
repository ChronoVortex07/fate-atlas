import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { HappeningEffect, HappeningResult } from '../types';

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
