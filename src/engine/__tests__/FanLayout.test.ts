import { describe, it, expect } from 'vitest';
import { restCenters, computeFanLayout, type FanLayoutParams } from '../fanLayout';

const P: FanLayoutParams = {
  count: 7, containerWidth: 600, cardWidth: 58, restStep: 42, minStep: 30, radius: 140,
};
const envLeft = (p: FanLayoutParams) => p.containerWidth / 2 - (p.count * p.cardWidth) / 2;
const envRight = (p: FanLayoutParams) => p.containerWidth / 2 + (p.count * p.cardWidth) / 2;

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

  it('R3: ends never pass the fixed envelope', () => {
    const rest = restCenters({ count: P.count, containerWidth: P.containerWidth, restStep: P.restStep });
    for (const cursor of [rest[0] - 50, rest[0], rest[6], rest[6] + 50, 300]) {
      const out = computeFanLayout(cursor, true, P);
      expect(out[0] - P.cardWidth / 2).toBeGreaterThanOrEqual(envLeft(P) - 1e-6);
      expect(out[out.length - 1] + P.cardWidth / 2).toBeLessThanOrEqual(envRight(P) + 1e-6);
    }
  });

  it('R4: far from the cursor, cards compress below rest spacing', () => {
    const rest = restCenters({ count: P.count, containerWidth: P.containerWidth, restStep: P.restStep });
    const out = computeFanLayout(rest[0], true, P); // cursor at far-left card
    const farGap = out[out.length - 1] - out[out.length - 2]; // rightmost gap
    expect(farGap).toBeLessThan(P.restStep);
  });
});
