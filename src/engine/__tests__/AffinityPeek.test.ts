import { describe, it, expect } from 'vitest';
import { AffinityEngine } from '../AffinityEngine';
import { AFFINITY_DEFINITIONS } from '../../data/affinities';

const make = () => new AffinityEngine(AFFINITY_DEFINITIONS);

describe('peek escalation', () => {
  it('peekAvailable only when Light is Ascendant or higher', () => {
    const e = make();
    e.setState({ light: 50 }); // stirring
    expect(e.peekAvailable()).toBe(false);
    e.setState({ light: 70 }); // ascendant
    expect(e.peekAvailable()).toBe(true);
  });

  it('the first peek is free (never fails even at the worst roll)', () => {
    const e = make();
    e.setState({ light: 70 });
    const orig = Math.random;
    Math.random = () => 0.0; // would fail any non-zero failChance
    const r = e.usePeek();   // peek #1: failChance = 0.18 * 0 = 0
    Math.random = orig;
    expect(r.failed).toBe(false);
  });

  it('a failed peek locks peeking for the run and applies a direct -12 to Light (no fan-out)', () => {
    const e = make();
    e.setState({ light: 95, shadow: 50 });
    const orig = Math.random;
    Math.random = () => 0.0;        // peek #1: free → success (feeds Light, coupling taxes Shadow)
    e.usePeek();
    const lightAfterSuccess = e.getState().light;
    const shadowAfterSuccess = e.getState().shadow;
    Math.random = () => 0.0;        // peek #2: failChance 0.18, roll 0 < 0.18 → fail
    const r = e.usePeek();
    Math.random = orig;
    expect(r.failed).toBe(true);
    expect(e.peekAvailable()).toBe(false);                          // locked out
    expect(e.getState().light).toBe(lightAfterSuccess - 12);        // direct subtraction
    expect(e.getState().shadow).toBe(shadowAfterSuccess);           // penalty has no fan-out
  });

  it('beginRun resets peek counters and lockout', () => {
    const e = make();
    e.setState({ light: 95 });
    const orig = Math.random;
    Math.random = () => 0.0; e.usePeek(); // #1 success
    Math.random = () => 0.0; e.usePeek(); // #2 fail → locked
    Math.random = orig;
    expect(e.peekAvailable()).toBe(false);
    e.beginRun(); // drift: ~88 → ~75 (still ascendant); lockout cleared
    expect(e.peekAvailable()).toBe(true);
  });
});
