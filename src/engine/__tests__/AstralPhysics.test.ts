import { describe, it, expect } from 'vitest';
import { castTuning } from '../astralPhysics';

const A = (o: Partial<Record<string, number>>) =>
  ({ order: 50, chaos: 50, light: 50, shadow: 50, ...o }) as Record<string, number>;

describe('castTuning', () => {
  it('chaos increases restitution and throw scatter', () => {
    const lo = castTuning(A({ chaos: 10 }));
    const hi = castTuning(A({ chaos: 90 }));
    expect(hi.restitution).toBeGreaterThan(lo.restitution);
    expect(hi.scatter).toBeGreaterThan(lo.scatter);
  });
  it('order increases linear damping (calmer settle)', () => {
    const lo = castTuning(A({ order: 10 }));
    const hi = castTuning(A({ order: 90 }));
    expect(hi.linearDamping).toBeGreaterThan(lo.linearDamping);
  });
  it('chaos lowers angular damping (dice spin longer)', () => {
    const lo = castTuning(A({ chaos: 10 }));
    const hi = castTuning(A({ chaos: 90 }));
    expect(hi.angularDamping).toBeLessThan(lo.angularDamping);
  });
  it('missing affinities default to neutral (no throw)', () => {
    expect(() => castTuning({})).not.toThrow();
  });
});
