import { describe, it, expect } from 'vitest';
import { RUNES, NON_REVERSIBLE, ringOf, consolidateScatter, resolveScatter, drawRuneScatter } from '../../data/runes';
import type { RuneId, LandedRune, RuneScatter } from '../types';

const ALL: RuneId[] = Object.keys(RUNES) as RuneId[];

const stone = (rune: RuneId, faceUp: boolean, orientation: LandedRune['orientation'], ring: LandedRune['ring'], x = 0, y = 0): LandedRune =>
  ({ rune, faceUp, orientation, ring, x, y });

describe('rune dataset', () => {
  it('has all 24 Elder Futhark runes', () => {
    expect(ALL).toHaveLength(24);
  });
  it('splits into three aettir of 8', () => {
    const byAett = { freyr: 0, heimdall: 0, tyr: 0 };
    for (const id of ALL) byAett[RUNES[id].aett]++;
    expect(byAett).toEqual({ freyr: 8, heimdall: 8, tyr: 8 });
  });
  it('marks exactly the symmetric runes non-reversible', () => {
    expect([...NON_REVERSIBLE].sort()).toEqual(
      ['dagaz', 'eihwaz', 'gebo', 'hagalaz', 'ingwaz', 'isa', 'jera', 'sowilo'].sort(),
    );
    for (const id of ALL) expect(RUNES[id].reversible).toBe(!NON_REVERSIBLE.includes(id));
  });
  it('has unique glyphs and within-range dimensions', () => {
    const glyphs = new Set(ALL.map((id) => RUNES[id].glyph));
    expect(glyphs.size).toBe(24);
    for (const id of ALL) {
      const d = RUNES[id].dimensions;
      for (const a of ['favorability', 'certainty', 'volatility'] as const) {
        expect(d[a]).toBeGreaterThanOrEqual(-2);
        expect(d[a]).toBeLessThanOrEqual(2);
      }
    }
  });
  it('derives rings from radius', () => {
    expect(ringOf(0.1)).toBe('heart');
    expect(ringOf(0.5)).toBe('field');
    expect(ringOf(0.9)).toBe('margin');
  });
});

describe('consolidateScatter', () => {
  it('folds governing + supporting + crossing into clamped dimensions', () => {
    const scatter: RuneScatter = {
      stones: [
        stone('sowilo', true, 'upright', 'heart'),    // governing  (1.5,1,0)
        stone('wunjo', true, 'upright', 'field'),      // supporting (half of 1.5,0.5,0)
        stone('thurisaz', true, 'merkstave', 'field'), // crossing   (tax -0.5 fav, +0.5 vol)
        stone('isa', false, 'upright', 'field'),        // silent — ignored
      ],
      governingIndex: 0,
      omens: ['true-cast'],
    };
    const r = consolidateScatter(scatter);
    expect(r.type).toBe('rune');
    expect(r.rune).toBe('sowilo');
    expect(r.orientation).toBe('upright');
    expect(r.dimensions).toEqual({ favorability: 1, certainty: 0.5, volatility: 0.5 });
    expect(r.themes).toEqual(['illumination', 'harmony']);
    expect(r.tags).toEqual(expect.arrayContaining([
      'draw', 'rune', 'random', 'rune-sowilo', 'aett-heimdall', 'ring-heart',
      'orientation-upright', 'upright', 'non-reversible', 'true-cast',
    ]));
  });

  it('applies the merkstave shadow transform to a merkstave governing', () => {
    const merk = consolidateScatter({ stones: [stone('wunjo', true, 'merkstave', 'field')], governingIndex: 0, omens: [] });
    const upright = consolidateScatter({ stones: [stone('wunjo', true, 'upright', 'field')], governingIndex: 0, omens: [] });
    expect(merk.orientation).toBe('merkstave');
    // shadow transform makes a merkstave governing strictly less favorable + more volatile
    expect(merk.dimensions.favorability).toBeLessThan(upright.dimensions.favorability);
    expect(merk.dimensions.volatility).toBeGreaterThan(upright.dimensions.volatility);
    expect(merk.tags).toEqual(expect.arrayContaining(['orientation-merkstave', 'reversed', 'reversible']));
  });
});

describe('resolveScatter', () => {
  const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };

  it('produces a 6-stone scatter with a face-up governing stone', () => {
    const s = resolveScatter({ affinities: { chaos: 50, order: 50, fate: 50 }, rng: seq([0.5]) });
    expect(s.stones).toHaveLength(6);
    expect(s.stones[s.governingIndex].faceUp).toBe(true);
  });

  it('never lands a non-reversible rune merkstave', () => {
    const s = resolveScatter({ affinities: { chaos: 100, order: 0, fate: 50 }, rng: seq([0.01]) });
    for (const st of s.stones) {
      if (st.faceUp && NON_REVERSIBLE.includes(st.rune)) expect(st.orientation).toBe('upright');
    }
  });

  it('Order tightens the scatter relative to Chaos', () => {
    const spread = (aff: Record<string, number>) => {
      const s = resolveScatter({ affinities: aff, rng: seq([0.3, 0.7, 0.2, 0.8, 0.5, 0.4, 0.6, 0.1]) });
      return Math.max(...s.stones.map((st) => Math.hypot(st.x, st.y)));
    };
    expect(spread({ chaos: 0, order: 100, fate: 0 })).toBeLessThan(spread({ chaos: 100, order: 0, fate: 0 }));
  });

  const positionKeys = (s: ReturnType<typeof resolveScatter>) =>
    new Set(s.stones.map((st) => `${st.x.toFixed(4)},${st.y.toFixed(4)}`));

  it('does not collapse to a single point at maximum Order', () => {
    // Regression: spreadBase = 0.45 * (1 + chaos - order) hit 0 at full Order,
    // landing every stone on the centroid with no deviation.
    const s = resolveScatter({ affinities: { chaos: 0, order: 100, fate: 0 }, rng: seq([0.2, 0.8, 0.5, 0.3, 0.9, 0.1, 0.6, 0.4]) });
    expect(positionKeys(s).size).toBe(s.stones.length);
    expect(Math.max(...s.stones.map((st) => Math.hypot(st.x, st.y)))).toBeGreaterThan(0.1);
  });

  it('does not collapse to a single point at maximum Fate drift', () => {
    // Regression: lerp(x, 0, drift) pulled every stone onto the exact center at drift = 1.
    const s = resolveScatter({ affinities: { chaos: 50, order: 50, fate: 100 }, drift: 1, rng: seq([0.2, 0.8, 0.5, 0.3, 0.9, 0.1, 0.6, 0.4]) });
    expect(positionKeys(s).size).toBe(s.stones.length);
  });

  it('Fate drift compresses the scatter toward the Heart without collapsing it', () => {
    const seed = [0.2, 0.8, 0.5, 0.3, 0.9, 0.1, 0.6, 0.4];
    const reach = (drift: number) => {
      const s = resolveScatter({ affinities: { chaos: 50, order: 50, fate: 100 }, drift, rng: seq(seed) });
      return Math.max(...s.stones.map((st) => Math.hypot(st.x, st.y)));
    };
    expect(reach(1)).toBeLessThan(reach(0)); // pulled inward
    expect(reach(1)).toBeGreaterThan(0);     // but still a real scatter
  });

  it('keeps even a wild, full-power aimed cast on the cloth (no runaway stones)', () => {
    // A hard pull-back + max Chaos must still leave every stone within the cloth's rim
    // (errant stones sit just past the Margin, not flung off-screen out of overflow).
    for (let trial = 0; trial < 200; trial++) {
      const s = resolveScatter({
        affinities: { chaos: 100, order: 0, fate: 0 },
        aim: { angle: Math.random() * Math.PI * 2, power: 1 },
      });
      for (const st of s.stones) expect(Math.hypot(st.x, st.y)).toBeLessThanOrEqual(1.2);
    }
  });
});

describe('drawRuneScatter', () => {
  it('returns a consolidatable scatter for engine-spawned results', () => {
    const s = drawRuneScatter({ chaos: 50, order: 50, fate: 50 }, () => 0.5);
    expect(s.stones.length).toBe(6);
    expect(s.governingIndex).toBeGreaterThanOrEqual(0);
    const r = consolidateScatter(s);
    expect(r.type).toBe('rune');
    expect(r.tags).toContain('rune');
  });
});
