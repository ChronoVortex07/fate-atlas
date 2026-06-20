import type { DiceResult, ThemeTag, DimensionValues, ModifierRole } from '../engine/types';

export type Threshold = 'critical-low' | 'low' | 'neutral' | 'high' | 'critical-high';

interface ThresholdData {
  interpretation: string;
  themes: ThemeTag[];
  dimensions: DimensionValues;
  modifierRoles: ModifierRole[];
}

const THRESHOLD_DATA: Record<Threshold, ThresholdData> = {
  'critical-low': {
    interpretation: 'The odds are starkly against you — patience is counseled above all.',
    themes: ['upheaval', 'conflict'],
    dimensions: { favorability: -2.0, certainty: 0.0, volatility: 1.5 },
    modifierRoles: ['effect'],
  },
  'low': {
    interpretation: 'The currents run against favorable winds. Proceed with measured steps.',
    themes: ['stagnation'],
    dimensions: { favorability: -1.0, certainty: 0.0, volatility: 0.5 },
    modifierRoles: ['effect'],
  },
  'neutral': {
    interpretation: 'The balance holds, neither for nor against. The choice remains truly yours.',
    themes: ['harmony'],
    dimensions: { favorability: 0.0, certainty: -1.0, volatility: 0.0 },
    modifierRoles: ['effect'],
  },
  'high': {
    interpretation: 'Fortune inclines toward you. The path ahead bears promise.',
    themes: ['harmony'],
    dimensions: { favorability: 1.0, certainty: 0.0, volatility: 0.5 },
    modifierRoles: ['effect'],
  },
  'critical-high': {
    interpretation: 'The stars align decisively in your favor. A rare and potent moment.',
    themes: ['renewal', 'harmony'],
    dimensions: { favorability: 2.0, certainty: 0.0, volatility: 1.5 },
    modifierRoles: ['effect'],
  },
};

export function getThreshold(value: number): Threshold {
  if (value <= 5) return 'critical-low';
  if (value <= 9) return 'low';
  if (value <= 11) return 'neutral';
  if (value <= 16) return 'high';
  return 'critical-high';
}

export function rollD20(affinities: Record<string, number>): DiceResult {
  let roll = Math.floor(Math.random() * 20) + 1;

  const chaosInfluence = ((affinities.chaos ?? 0) / 100) * 4;
  const orderInfluence = ((affinities.order ?? 0) / 100) * 3;

  if (chaosInfluence > 0 && Math.random() < chaosInfluence / 10) {
    roll = roll <= 10 ? Math.max(1, roll - Math.ceil(chaosInfluence)) : Math.min(20, roll + Math.ceil(chaosInfluence));
  }
  if (orderInfluence > 0 && Math.random() < orderInfluence / 10) {
    const center = 10.5;
    roll = Math.round(roll + (center - roll) * (orderInfluence / 10));
    roll = Math.max(1, Math.min(20, roll));
  }

  const threshold = getThreshold(roll);
  const data = THRESHOLD_DATA[threshold];

  return {
    type: 'd20',
    result: roll,
    threshold,
    interpretation: data.interpretation,
    tags: ['roll', 'random', 'numeric', 'threshold', threshold.includes('low') ? 'low' : threshold.includes('high') ? 'high' : 'neutral'],
    themes: data.themes,
    dimensions: data.dimensions,
    modifierRoles: data.modifierRoles,
  };
}
