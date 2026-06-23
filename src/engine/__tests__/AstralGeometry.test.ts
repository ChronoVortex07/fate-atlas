import { describe, it, expect } from 'vitest';
import {
  sectorOf, sectorCenter, rotateVec3ByQuat, topFaceIndex,
  isErrantStar, isCrownedConjunction, BOARD_RADIUS,
} from '../astralGeometry';

describe('sectorOf', () => {
  it('puts the board top (x=0, z<0) in house 1', () => {
    expect(sectorOf(0, -1)).toBe(1);
  });
  it('increases clockwise: right side is house 4', () => {
    expect(sectorOf(1, 0)).toBe(4);
  });
  it('bottom is house 7', () => {
    expect(sectorOf(0, 1)).toBe(7);
  });
  it('left side is house 10', () => {
    expect(sectorOf(-1, 0)).toBe(10);
  });
  it('always returns 1..12', () => {
    for (let deg = 0; deg < 360; deg += 7) {
      const a = (deg * Math.PI) / 180;
      const h = sectorOf(Math.sin(a), -Math.cos(a));
      expect(h).toBeGreaterThanOrEqual(1);
      expect(h).toBeLessThanOrEqual(12);
    }
  });
});

describe('sectorCenter', () => {
  it('round-trips back to the same house via sectorOf', () => {
    for (let h = 1; h <= 12; h++) {
      const c = sectorCenter(h, 3);
      expect(sectorOf(c.x, c.z)).toBe(h);
    }
  });
});

describe('rotateVec3ByQuat', () => {
  it('identity quaternion leaves the vector unchanged', () => {
    const v = rotateVec3ByQuat({ x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 0, w: 1 });
    expect(v.x).toBeCloseTo(1); expect(v.y).toBeCloseTo(2); expect(v.z).toBeCloseTo(3);
  });
  it('90° about Z maps +X to +Y', () => {
    const q = { x: 0, y: 0, z: Math.sin(Math.PI / 4), w: Math.cos(Math.PI / 4) };
    const v = rotateVec3ByQuat({ x: 1, y: 0, z: 0 }, q);
    expect(v.x).toBeCloseTo(0); expect(v.y).toBeCloseTo(1); expect(v.z).toBeCloseTo(0);
  });
});

describe('topFaceIndex', () => {
  const normals = [
    { x: 0, y: 1, z: 0 },  // up
    { x: 0, y: -1, z: 0 }, // down
    { x: 1, y: 0, z: 0 },  // side
  ];
  it('picks the face already pointing up under identity rotation', () => {
    expect(topFaceIndex(normals, { x: 0, y: 0, z: 0, w: 1 })).toBe(0);
  });
  it('picks the face that rotates to up', () => {
    // 180° about Z flips +Y(normal 0) down and -Y(normal 1) up
    const q = { x: 0, y: 0, z: 1, w: 0 };
    expect(topFaceIndex(normals, q)).toBe(1);
  });
});

describe('omen predicates', () => {
  it('errant-star when settled beyond the board radius', () => {
    expect(isErrantStar(BOARD_RADIUS + 0.5, 0)).toBe(true);
    expect(isErrantStar(0, 0)).toBe(false);
  });
  it('crowned-conjunction when the two dice are close', () => {
    expect(isCrownedConjunction({ x: 0, y: 0, z: 0 }, { x: 0.5, y: 0, z: 0.5 })).toBe(true);
    expect(isCrownedConjunction({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 4 })).toBe(false);
  });
});
