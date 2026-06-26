import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { AffinityId, StringsMinigameState } from '../types';

const HI = (a: Partial<Record<AffinityId, number>> = {}): Record<AffinityId, number> =>
  ({ chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50, ...a });

// startTurn runs beginRun() (drift toward baseline), so set affinities AFTER it.
function startWeaveWith(aff: Record<AffinityId, number>): GameEngine {
  const e = new GameEngine();
  e.startTurn('self');
  e.loadState({ affinities: aff, selectedMethod: 'strings', screen: 'minigame' });
  e.startWeave();
  return e;
}
const weave = (e: GameEngine) => e.getState().minigameState as StringsMinigameState;

describe('strings weave — start', () => {
  it('seeds a drawing weave with an origin and at least one candidate', () => {
    const e = startWeaveWith(HI());
    const s = weave(e);
    expect(s.method).toBe('strings');
    expect(s.phase).toBe('drawing');
    expect(s.visitedPath).toEqual([s.activeId]);
    expect(s.candidateIds.length).toBeGreaterThanOrEqual(1);
  });
});
