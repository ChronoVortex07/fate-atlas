import { describe, it, expect } from 'vitest';
import { restCenters, computeFanLayout, type FanLayoutParams } from '../fanLayout';

const P: FanLayoutParams = {
  count: 7, containerWidth: 600, cardWidth: 58, restStep: 42, radius: 140,
};

describe('restCenters', () => {
  it('is symmetric about the container center with restStep spacing', () => {
    const c = restCenters({ count: 4, containerWidth: 600, restStep: 42 });
    expect(c).toHaveLength(4);
    expect((c[0] + c[3]) / 2).toBeCloseTo(300, 5);
    expect(c[1] - c[0]).toBeCloseTo(42, 5);
  });
});

describe('computeFanLayout', () => {
  it('inactive returns rest centers unchanged', () => {
    const rest = restCenters({ count: P.count, containerWidth: P.containerWidth, restStep: P.restStep });
    expect(computeFanLayout(300, false, P)).toEqual(rest);
  });

  it('count<=1 returns rest centers', () => {
    const p = { ...P, count: 1 };
    expect(computeFanLayout(300, true, p)).toEqual(restCenters({ count: 1, containerWidth: 600, restStep: 42 }));
  });

  it('R1: the card under the cursor keeps its rest center', () => {
    const rest = restCenters({ count: P.count, containerWidth: P.containerWidth, restStep: P.restStep });
    const cursor = rest[3]; // middle card
    const out = computeFanLayout(cursor, true, P);
    expect(out[3]).toBeCloseTo(rest[3], 5);
  });

  it('R2: no adjacent gap exceeds cardWidth (side-by-side is the max)', () => {
    const rest = restCenters({ count: P.count, containerWidth: P.containerWidth, restStep: P.restStep });
    for (const cursor of [rest[0], rest[3], rest[6], 250, 400]) {
      const out = computeFanLayout(cursor, true, P);
      for (let i = 0; i < out.length - 1; i++) {
        expect(out[i + 1] - out[i]).toBeLessThanOrEqual(P.cardWidth + 1e-6);
      }
    }
  });

  it('R3: far from the cursor, gaps stay at rest spacing (no compression)', () => {
    const rest = restCenters({ count: P.count, containerWidth: P.containerWidth, restStep: P.restStep });
    const out = computeFanLayout(rest[0], true, P); // cursor at far-left card
    const farGap = out[out.length - 1] - out[out.length - 2]; // rightmost gap
    // Gaussian falloff never truly hits zero, but the far gap should be within 1px of restStep
    expect(Math.abs(farGap - P.restStep)).toBeLessThan(1);
  });
});
