import type { DiceResult } from '../engine/types';

export type Threshold = 'critical-low' | 'low' | 'neutral' | 'high' | 'critical-high';

const THRESHOLD_INTERPRETATIONS: Record<Threshold, string> = {
  'critical-low': 'The odds are starkly against you — patience is counseled above all.',
  'low': 'The currents run against favorable winds. Proceed with measured steps.',
  'neutral': 'The balance holds, neither for nor against. The choice remains truly yours.',
  'high': 'Fortune inclines toward you. The path ahead bears promise.',
  'critical-high': 'The stars align decisively in your favor. A rare and potent moment.',
};

export function getThreshold(value: number): Threshold {
  if (value <= 5) return 'critical-low';
  if (value <= 9) return 'low';
  if (value <= 11) return 'neutral';
  if (value <= 16) return 'high';
  return 'critical-high';
}

export function rollD20(affinities: Record<string, number>): DiceResult {
  // Order affinity pulls result toward the middle (10-11)
  // Chaos pushes toward extremes
  let roll = Math.floor(Math.random() * 20) + 1;

  const chaosInfluence = (affinities.chaos ?? 0) * 4; // up to ±4
  const orderInfluence = (affinities.order ?? 0) * 3; // pull toward 10.5

  if (chaosInfluence > 0 && Math.random() < chaosInfluence / 10) {
    // Chaos: push toward extreme
    roll = roll <= 10 ? Math.max(1, roll - Math.ceil(chaosInfluence)) : Math.min(20, roll + Math.ceil(chaosInfluence));
  }
  if (orderInfluence > 0 && Math.random() < orderInfluence / 10) {
    // Order: pull toward center
    const center = 10.5;
    roll = Math.round(roll + (center - roll) * (orderInfluence / 10));
    roll = Math.max(1, Math.min(20, roll));
  }

  const threshold = getThreshold(roll);

  return {
    type: 'd20',
    result: roll,
    threshold,
    interpretation: THRESHOLD_INTERPRETATIONS[threshold],
    tags: ['roll', 'random', 'numeric', 'threshold', threshold.includes('low') ? 'low' : threshold.includes('high') ? 'high' : 'neutral'],
  };
}
