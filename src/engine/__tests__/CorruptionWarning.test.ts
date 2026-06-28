import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { AffinityId, TransformPayload } from '../types';

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

  it('DELIBERATE: warning follows the EFFECTIVE Light band under an active upheaval', () => {
    // Base Light = 30 (latent — below ascendant, so reading base yields null warning).
    // An invert-pair upheaval on the information axis makes effective Light = 100-30 = 70
    // (ascendant), which IS above the ascendant threshold → warning must be present.
    // This test fails if deriveCorruptionWarning() is switched to read the base band.
    const e = new GameEngine(3);
    e.setCorruption(50); // spreading — corruption active so warning machinery runs
    e.startTurn('self');
    e.loadState({ affinities: lit(30) }); // base Light 30 → latent (no warning from base alone)

    // Confirm baseline: no upheaval yet, base Light is too low to warn.
    expect(e.getState().corruptionWarning).toBeNull();

    // Grant an invert-pair upheaval on the information axis (light ↔ shadow).
    // effective Light = 100 - 30 = 70 → ascendant → warning threshold met.
    const transform: TransformPayload = { transform: 'invert-pair', axis: 'information' };
    e.grantUpheaval(transform, 2, 'test-upheaval');

    // Base is still 30 (latent). Effective is now 70 (ascendant).
    expect(e.getState().affinityBase.light).toBe(30);
    expect(e.getState().affinities.light).toBe(70);

    // The warning must be present because the effective band is ascendant.
    // (Under a base read it would still be null — that is the non-tautological check.)
    const w = e.getState().corruptionWarning;
    expect(w).not.toBeNull();
    expect(w!.present).toBe(true);
  });
});
