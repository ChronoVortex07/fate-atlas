import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { AffinityId } from '../types';

const lit = (light: number): Record<AffinityId, number> =>
  ({ chaos: 50, order: 50, fate: 50, will: 50, light, shadow: 50 });

describe('Light early-warning', () => {
  it('is null while corruption is dormant', () => {
    const e = new GameEngine(3);
    e.startTurn('self');
    expect(e.getState().corruptionWarning).toBeNull();
  });

  it('is null when Light is below ascendant (cannot perceive a predator)', () => {
    const e = new GameEngine(3);
    e.setCorruption(50); // spreading
    e.startTurn('self');
    e.loadState({ affinities: lit(50) }); // stirring
    expect(e.getState().corruptionWarning).toBeNull();
  });

  it('gives a vague warning at ascendant Light (no methods named)', () => {
    const e = new GameEngine(3);
    e.setCorruption(50);
    e.startTurn('self');
    e.loadState({ affinities: lit(70) }); // ascendant
    const w = e.getState().corruptionWarning!;
    expect(w.present).toBe(true);
    expect(w.tainted).toBe(false);
    expect(w.methods).toEqual([]);
  });

  it('names the tainted methods at dominant Light', () => {
    const e = new GameEngine(3);
    e.setCorruption(50);
    e.startTurn('self'); // infectedMethods computed (spreading → 1)
    e.loadState({ affinities: lit(100) }); // dominant
    const s = e.getState();
    expect(s.corruptionWarning!.present).toBe(true);
    expect(s.corruptionWarning!.tainted).toBe(false);
    expect(s.corruptionWarning!.methods).toEqual(s.infectedMethods);
  });

  it('taints the warning itself at virulent (terminal lucidity)', () => {
    const e = new GameEngine(3);
    e.setCorruption(80); // virulent
    e.startTurn('self');
    e.loadState({ affinities: lit(100) }); // dominant, but it no longer matters
    const w = e.getState().corruptionWarning!;
    expect(w.present).toBe(true);
    expect(w.tainted).toBe(true);
  });
});
