import type {
  DiceResult, ThemeTag, DimensionValues, ModifierRole, Tag, Threshold, DiceCheckBreakdown,
} from '../engine/types';

export type { Threshold }; // re-export so existing `from '../data/dice'` imports keep resolving

interface ThresholdData {
  interpretation: string;
  themes: ThemeTag[];
  dimensions: DimensionValues;
  modifierRoles: ModifierRole[];
}

export const THRESHOLD_DATA: Record<Threshold, ThresholdData> = {
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

// Interpretation text for a resolved check. Criticals override; otherwise the
// line names the DC the reading set so success/failure reads as relative.
function checkInterpretation(b: DiceCheckBreakdown): string {
  if (b.critical === 'triumph') {
    return 'A natural 20 — fate breaks open in your favor, past anything the bar demanded.';
  }
  if (b.critical === 'fumble') {
    return 'A natural 1 — the cast collapses; even a low bar goes unmet.';
  }
  switch (b.tier) {
    case 'critical-high':
      return `The reading set the bar at ${b.dc}; your cast clears it commandingly — momentum is yours.`;
    case 'high':
      return `The reading set the bar at ${b.dc}; your cast meets it — the path holds.`;
    case 'neutral':
      return `The reading set the bar at ${b.dc}; your cast falls just short — the question stays open.`;
    case 'low':
      return `The reading set the bar at ${b.dc}; your cast misses — the trend resists you.`;
    case 'critical-low':
      return `The reading set the bar at ${b.dc}; your cast fails badly — fate counsels another way.`;
  }
}

// Assemble the committed DiceResult from a resolved check breakdown. Tier supplies
// themes/dimensions/modifierRoles; the natural d20 stays in `result`.
export function buildDiceResult(breakdown: DiceCheckBreakdown): DiceResult {
  const data = THRESHOLD_DATA[breakdown.tier];
  const polarity = breakdown.tier.includes('low')
    ? 'low'
    : breakdown.tier.includes('high')
      ? 'high'
      : 'neutral';
  const tags: Tag[] = ['roll', 'random', 'numeric', 'threshold', polarity];
  if (breakdown.critical === 'triumph') tags.push('triumph');
  if (breakdown.critical === 'fumble') tags.push('fumble');
  return {
    type: 'd20',
    result: breakdown.d20,
    threshold: breakdown.tier,
    interpretation: checkInterpretation(breakdown),
    tags,
    themes: data.themes,
    dimensions: data.dimensions,
    modifierRoles: data.modifierRoles,
    check: breakdown,
  };
}
