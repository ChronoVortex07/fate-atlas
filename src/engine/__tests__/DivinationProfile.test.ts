import { describe, it, expect } from 'vitest';
import { DIVINATION_PROFILES } from '../../data/divination-profiles';
import type { ThemeTag, DimensionValues, ModifierRole } from '../types';

const ALL_THEMES: ThemeTag[] = [
  'upheaval', 'renewal', 'stagnation', 'illumination', 'harmony',
  'conflict', 'transformation', 'mystery', 'authority', 'surrender',
];

const ALL_DIMENSIONS: (keyof DimensionValues)[] = ['favorability', 'certainty', 'volatility'];
const ALL_MODIFIERS: ModifierRole[] = ['subject', 'action', 'effect'];

describe('DivinationProfile', () => {
  it('every curated theme is covered by at least one divination type', () => {
    const covered = new Set<string>();
    for (const profile of Object.values(DIVINATION_PROFILES)) {
      for (const theme of profile.themePool) {
        covered.add(theme);
      }
    }
    for (const theme of ALL_THEMES) {
      expect(covered.has(theme)).toBe(true);
    }
  });

  it('every dimension axis is covered by at least one type', () => {
    const covered = new Set<string>();
    for (const profile of Object.values(DIVINATION_PROFILES)) {
      for (const dim of profile.dimensionStrengths) {
        covered.add(dim);
      }
    }
    for (const dim of ALL_DIMENSIONS) {
      expect(covered.has(dim)).toBe(true);
    }
  });

  it('every modifier role is covered by at least one type', () => {
    const covered = new Set<string>();
    for (const profile of Object.values(DIVINATION_PROFILES)) {
      for (const mod of profile.modifierStrengths) {
        covered.add(mod);
      }
    }
    for (const mod of ALL_MODIFIERS) {
      expect(covered.has(mod)).toBe(true);
    }
  });

  it('all four divination types have profiles', () => {
    expect(DIVINATION_PROFILES.tarot).toBeDefined();
    expect(DIVINATION_PROFILES.d20).toBeDefined();
    expect(DIVINATION_PROFILES.iching).toBeDefined();
    expect(DIVINATION_PROFILES.happening).toBeDefined();
  });

  it('profile types match their keys', () => {
    for (const [key, profile] of Object.entries(DIVINATION_PROFILES)) {
      expect(profile.type).toBe(key);
    }
  });

  it('themeCoverage values are valid', () => {
    for (const profile of Object.values(DIVINATION_PROFILES)) {
      expect(['all', 'limited']).toContain(profile.themeCoverage);
    }
  });
});
