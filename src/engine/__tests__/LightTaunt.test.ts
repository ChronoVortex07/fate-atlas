import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { AffinityId, DiceResult } from '../types';
import { LIGHT_LEAD_IN, TAUNT_LIGHT } from '../../data/corruption';

afterEach(() => vi.restoreAllMocks());

const dice = (): DiceResult => ({
  type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
  modifierRoles: [],
});
const litHoard = (light: number): Record<AffinityId, number> =>
  ({ chaos: 50, order: 50, fate: 50, will: 50, light, shadow: 50 });
function oneReading(e: GameEngine) {
  e.completeMinigame(dice());
  if (e.getState().eventQueue.length > 0) e.finishEventBatch();
  e.continueAfterReview();
}

describe('Light taunt at the virulent crossing', () => {
  it('interrupts Light with a chained lead-in + taunt when crossing into virulent', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // suppress the generic intrusion roll
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: litHoard(100) }); // dominant
    e.setCorruption(80); // already virulent
    e.corruptionEngineForTest().markWarned('spreading'); // simulate the earlier spreading omen

    oneReading(e);

    const intr = e.getState().intrusion!;
    expect(intr.lead).toBe(LIGHT_LEAD_IN);
    expect(TAUNT_LIGHT).toContain(intr.text);
    expect(e.corruptionEngineForTest().getWarnedBand()).toBe('virulent');
    // The virulent escalation does NOT also pop a separate omen.
    expect(e.getState().omen).toBeNull();
  });

  it('does not taunt when Light is below ascendant at the crossing', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3);
    e.startTurn('self');
    e.loadState({ affinities: { chaos: 100, order: 100, fate: 50, will: 50, light: 50, shadow: 50 } });
    e.setCorruption(80); // virulent, but Light only stirring
    e.corruptionEngineForTest().markWarned('spreading');

    oneReading(e);

    const intr = e.getState().intrusion;
    // No taunt lead-in; whatever the generic path did, it is not a chained taunt.
    expect(intr?.lead).toBeUndefined();
  });
});
