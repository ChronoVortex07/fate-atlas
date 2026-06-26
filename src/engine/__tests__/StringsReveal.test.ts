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

describe('strings weave — stepping', () => {
  it('stepTo advances the path, recomputes candidates, and feeds Fate on a hinted accept', () => {
    const e = startWeaveWith(HI());
    const fateBefore = e.getState().affinities.fate;
    const cand = weave(e).candidateIds[0];
    e.stepTo(cand);
    const s = weave(e);
    expect(s.visitedPath).toContain(cand);
    expect(s.activeId).toBe(cand);
    expect(e.getState().affinities.fate).toBeGreaterThan(fateBefore);
  });

  it('reaching a destination flips the phase to arrived', () => {
    const e = startWeaveWith(HI());
    let guard = 0;
    while (weave(e).phase === 'drawing' && guard++ < 12) {
      e.stepTo(weave(e).candidateIds[0]);
    }
    expect(weave(e).phase).toBe('arrived');
    expect(weave(e).candidateIds).toHaveLength(0);
  });

  it('a blind (Shadow silhouette) accept feeds Shadow instead of Fate', () => {
    const e = startWeaveWith(HI({ shadow: 70 })); // clarity 'silhouette'
    const shadowBefore = e.getState().affinities.shadow;
    e.stepTo(weave(e).candidateIds[0]);
    expect(e.getState().affinities.shadow).toBeGreaterThan(shadowBefore);
  });
});
