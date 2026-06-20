import type { ThemeTag, DimensionValues, ModifierRole } from '../engine/types';

export interface HappeningData {
  id: string;
  scene: string;
  choices: { text: string; affinityChanges: Partial<Record<string, number>> }[];
  tags: string[];
  themes: ThemeTag[];
  dimensions: DimensionValues;
  modifierRoles: ModifierRole[];
}

export const HAPPENINGS: HappeningData[] = [
  {
    id: 'crossroads',
    scene: 'A path splits before you beneath the star-field. One fork gleams with known light, the other vanishes into shadowed constellations.',
    choices: [
      { text: 'Take the gleaming path — it feels certain.', affinityChanges: { order: 8 } },
      { text: 'Step into the shadowed stars — uncertainty calls.', affinityChanges: { chaos: 8 } },
      { text: 'Sit at the crossroads and wait for a sign.', affinityChanges: { order: 4, chaos: 4 } },
    ],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['mystery', 'transformation'],
    dimensions: { favorability: 0.0, certainty: -1.5, volatility: 1.5 },
    modifierRoles: ['action'],
  },
  {
    id: 'falling-star',
    scene: 'A star tears across the sky, brilliant and brief. In its trail, a silence settles — the kind that asks a question.',
    choices: [
      { text: 'Make a wish upon the falling light.', affinityChanges: { chaos: 10 } },
      { text: 'Observe its trajectory — seek the pattern.', affinityChanges: { order: 10 } },
    ],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['upheaval', 'illumination'],
    dimensions: { favorability: 0.5, certainty: -0.5, volatility: 2.0 },
    modifierRoles: ['effect'],
  },
  {
    id: 'veiled-moon',
    scene: 'A veil of cloud drifts across the moon. Shapes form and dissolve — some feel like omens, others like memories.',
    choices: [
      { text: 'Read the shapes as portents — they must mean something.', affinityChanges: { chaos: 6 } },
      { text: 'Let them pass — clouds are only clouds.', affinityChanges: { order: 6 } },
      { text: 'Draw the shapes in the dust, fixing them in place.', affinityChanges: { order: 3, chaos: 3 } },
    ],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['mystery', 'surrender'],
    dimensions: { favorability: 0.0, certainty: -1.0, volatility: 1.0 },
    modifierRoles: ['subject'],
  },
  {
    id: 'whispering-thread',
    scene: 'A thread of starlight seems to whisper at the edge of hearing. Words form just beyond comprehension, promising secrets.',
    choices: [
      { text: 'Lean in — strain to hear the whispered truth.', affinityChanges: { chaos: 7 } },
      { text: 'Step back — some knowledge is not meant for you.', affinityChanges: { order: 7 } },
    ],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['mystery', 'illumination'],
    dimensions: { favorability: 0.0, certainty: -2.0, volatility: 1.0 },
    modifierRoles: ['subject', 'action'],
  },
  {
    id: 'convergence',
    scene: 'Three constellations drift toward alignment above you. The ancients called this a moment when the veil wears thin.',
    choices: [
      { text: 'Align yourself with the convergence — become part of the pattern.', affinityChanges: { order: 9 } },
      { text: 'Stand at an angle to it — see what the pattern hides.', affinityChanges: { chaos: 9 } },
    ],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['harmony', 'illumination'],
    dimensions: { favorability: 1.0, certainty: 1.0, volatility: -0.5 },
    modifierRoles: ['effect'],
  },
  {
    id: 'echo-of-past-reading',
    scene: 'The echo of a past divination resurfaces — a card, a number, a symbol — asking to be reconsidered.',
    choices: [
      { text: 'Reinterpret the past — its meaning may have changed.', affinityChanges: { chaos: 5 } },
      { text: 'Acknowledge and release — the past is settled.', affinityChanges: { order: 5 } },
    ],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['transformation', 'illumination'],
    dimensions: { favorability: 0.0, certainty: -0.5, volatility: 1.5 },
    modifierRoles: ['subject'],
  },
  {
    id: 'dark-constellation',
    scene: 'A gap in the stars catches your eye — not empty, but dark. A constellation made of absence rather than light.',
    choices: [
      { text: 'Study the negative space — what is missing matters.', affinityChanges: { order: 6 } },
      { text: 'Fill the void with your own pattern — create meaning.', affinityChanges: { chaos: 6 } },
    ],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['mystery', 'surrender'],
    dimensions: { favorability: -0.5, certainty: -1.5, volatility: 1.0 },
    modifierRoles: ['subject', 'action'],
  },
  {
    id: 'many-threads',
    scene: 'Countless threads of fate shimmer into view, each one a path not taken. The weave is impossibly complex.',
    choices: [
      { text: 'Trace one thread backward — understand what shaped it.', affinityChanges: { order: 7 } },
      { text: 'Pluck a thread and see what unravels — test the weave.', affinityChanges: { chaos: 7 } },
    ],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['mystery', 'transformation'],
    dimensions: { favorability: 0.0, certainty: -2.0, volatility: 2.0 },
    modifierRoles: ['action', 'effect'],
  },
];

export function selectHappening(
  excludeIds: string[],
  chaosAffinity: number,
): HappeningData {
  let available = HAPPENINGS.filter((h) => !excludeIds.includes(h.id));

  if (available.length === 0) {
    available = [...HAPPENINGS];
  }

  const weighted = available.map((h) => ({
    happening: h,
    weight: 1 + (h.choices.length > 2 ? chaosAffinity : 0),
  }));
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) return w.happening;
  }
  return weighted[weighted.length - 1].happening;
}
