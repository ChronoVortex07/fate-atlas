import type { DivinationProfile } from '../engine/types';

export const DIVINATION_PROFILES: Record<string, DivinationProfile> = {
  tarot: {
    type: 'tarot',
    themeCoverage: 'all',
    themePool: [
      'upheaval', 'renewal', 'stagnation', 'illumination', 'harmony',
      'conflict', 'transformation', 'mystery', 'authority', 'surrender',
    ],
    dimensionStrengths: ['certainty', 'favorability', 'volatility'],
    modifierStrengths: ['subject', 'action'],
  },
  d20: {
    type: 'd20',
    themeCoverage: 'limited',
    themePool: ['upheaval', 'stagnation', 'harmony', 'renewal', 'conflict'],
    dimensionStrengths: ['favorability', 'volatility'],
    modifierStrengths: ['effect'],
  },
  iching: {
    type: 'iching',
    themeCoverage: 'all',
    themePool: [
      'transformation', 'mystery', 'stagnation', 'renewal',
      'harmony', 'conflict', 'authority', 'surrender',
      'illumination', 'upheaval',
    ],
    dimensionStrengths: ['certainty', 'volatility'],
    modifierStrengths: ['action', 'effect'],
  },
  happening: {
    type: 'happening',
    themeCoverage: 'limited',
    themePool: ['upheaval', 'mystery', 'renewal', 'harmony', 'illumination', 'transformation', 'surrender'],
    dimensionStrengths: ['volatility'],
    modifierStrengths: ['action', 'effect', 'subject'],
  },
  astral: {
    type: 'astral',
    themeCoverage: 'all',
    themePool: ['authority', 'harmony', 'conflict', 'transformation', 'illumination', 'mystery', 'renewal', 'stagnation', 'upheaval', 'surrender'],
    dimensionStrengths: ['favorability', 'volatility', 'certainty'],
    modifierStrengths: ['subject', 'action', 'effect'],
  },
  rune: {
    type: 'rune',
    themeCoverage: 'all',
    themePool: ['renewal', 'transformation', 'conflict', 'illumination', 'harmony', 'mystery', 'authority', 'stagnation', 'upheaval', 'surrender'],
    dimensionStrengths: ['favorability', 'volatility', 'certainty'],
    modifierStrengths: ['subject', 'effect', 'action'],
  },
};
