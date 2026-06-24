import { describe, it, expect } from 'vitest';
import { castTuning } from '../astralPhysics';

const A = (o: Partial<Record<string, number>>) =>
  ({ order: 50, chaos: 50, light: 50, shadow: 50, ...o }) as Record<string, number>;

describe('castTuning', () => {
  it('keeps centering gentle (much weaker than the old 2D vortex)', () => {
    expect(castTuning(A({})).centering).toBeLessThan(1.2);
  });
  it('order increases centering and linear damping', () => {
    const lo = castTuning(A({ order: 10 }));
    const hi = castTuning(A({ order: 90 }));
    expect(hi.centering).toBeGreaterThan(lo.centering);
    expect(hi.linearDamping).toBeGreaterThan(lo.linearDamping);
  });
  it('chaos increases restitution, scatter, and turbulence', () => {
    const lo = castTuning(A({ chaos: 10 }));
    const hi = castTuning(A({ chaos: 90 }));
    expect(hi.restitution).toBeGreaterThan(lo.restitution);
    expect(hi.scatter).toBeGreaterThan(lo.scatter);
    expect(hi.turbulence).toBeGreaterThan(lo.turbulence);
  });
  it('lateral bias follows light minus shadow', () => {
    expect(castTuning(A({ light: 90, shadow: 10 })).lateralBias).toBeGreaterThan(0);
    expect(castTuning(A({ light: 10, shadow: 90 })).lateralBias).toBeLessThan(0);
    expect(castTuning(A({ light: 50, shadow: 50 })).lateralBias).toBeCloseTo(0);
  });
  it('missing affinities default to neutral (no throw)', () => {
    expect(() => castTuning({})).not.toThrow();
  });
});
