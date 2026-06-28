import type {
  ThemeTag, DimensionValues, ModifierRole, HappeningEffect, AffinityAxis, AffinityId,
} from '../engine/types';

export interface HappeningData {
  id: string;
  scene: string;
  choices: { text: string; effects: HappeningEffect[] }[];
  axes: AffinityAxis[]; // dominant-axis tags for selection weighting
  tags: string[];
  themes: ThemeTag[];
  dimensions: DimensionValues;
  modifierRoles: ModifierRole[];
}

// ── Tuning (playtest defaults; spec §11 leaves exact values open) ──
export const AXIS_WEIGHT_BONUS = 1;     // extra selection weight when a scene matches the player's dominant axis
export const HAPPENING_GAP_CHANCE = 0.5; // per-gap fire chance before the guaranteed final gap (cadence, Task 6)

export const HAPPENINGS: HappeningData[] = [
  {
    id: 'crossroads',
    scene: 'A path splits before you beneath the star-field. One fork gleams with known light, the other vanishes into shadowed constellations.',
    choices: [
      { text: 'Take the gleaming path — it feels certain.', effects: [{ kind: 'shift', affinity: 'order', amount: 6 }] },
      { text: 'Step into the shadowed stars — uncertainty calls.', effects: [{ kind: 'surge', deltas: { chaos: 25 }, readings: 3 }, { kind: 'cost', affinity: 'order', amount: 8 }] },
      { text: 'Sit at the crossroads and wait for a sign.', effects: [{ kind: 'shift', affinity: 'fate', amount: 4 }, { kind: 'reading', effect: 'deny-peek' }] },
    ],
    axes: ['agency', 'fortune'],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['mystery', 'transformation'],
    dimensions: { favorability: 0.0, certainty: -1.5, volatility: 1.5 },
    modifierRoles: ['action'],
  },
  {
    id: 'falling-star',
    scene: 'A star tears across the sky, brilliant and brief. In its trail, a silence settles — the kind that asks a question.',
    choices: [
      { text: 'Make a wish upon the falling light.', effects: [{ kind: 'surge', deltas: { chaos: 30 }, readings: 3 }, { kind: 'cost', affinity: 'order', amount: 10 }] },
      { text: 'Chart its arc — find the pattern.', effects: [{ kind: 'surge', deltas: { light: 25 }, readings: 3 }, { kind: 'reading', effect: 'guarantee-peek' }] },
      { text: 'Look away; let it pass.', effects: [{ kind: 'shift', affinity: 'order', amount: 6 }] },
    ],
    axes: ['fortune', 'information'],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['upheaval', 'illumination'],
    dimensions: { favorability: 0.5, certainty: -0.5, volatility: 2.0 },
    modifierRoles: ['effect'],
  },
  {
    id: 'veiled-moon',
    scene: 'A veil of cloud drifts across the moon. Shapes form and dissolve — some feel like omens, others like memories.',
    choices: [
      { text: 'Read the shapes as portents — they must mean something.', effects: [{ kind: 'surge', deltas: { shadow: 22 }, readings: 3 }, { kind: 'reading', effect: 'shroud-card' }] },
      { text: 'Let them pass — clouds are only clouds.', effects: [{ kind: 'shift', affinity: 'order', amount: 6 }] },
      { text: 'Draw the shapes in the dust, fixing them in place.', effects: [{ kind: 'shift', affinity: 'light', amount: 4 }, { kind: 'shift', affinity: 'order', amount: 3 }] },
    ],
    axes: ['information', 'fortune'],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['mystery', 'surrender'],
    dimensions: { favorability: 0.0, certainty: -1.0, volatility: 1.0 },
    modifierRoles: ['subject'],
  },
  {
    id: 'whispering-thread',
    scene: 'A thread of starlight seems to whisper at the edge of hearing. Words form just beyond comprehension, promising secrets.',
    choices: [
      { text: 'Lean in — strain to hear the whispered truth.', effects: [{ kind: 'gamble', outcomes: [
        { weight: 1, effects: [{ kind: 'surge', deltas: { light: 25 }, readings: 3 }, { kind: 'reading', effect: 'guarantee-peek' }] },
        { weight: 1, effects: [{ kind: 'cost', affinity: 'light', amount: 10 }, { kind: 'reading', effect: 'deny-peek' }] },
      ] }] },
      { text: 'Step back — some knowledge is not meant for you.', effects: [{ kind: 'shift', affinity: 'shadow', amount: 6 }] },
    ],
    axes: ['information', 'agency'],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['mystery', 'illumination'],
    dimensions: { favorability: 0.0, certainty: -2.0, volatility: 1.0 },
    modifierRoles: ['subject', 'action'],
  },
  {
    id: 'convergence',
    scene: 'Three constellations drift toward alignment above you. The ancients called this a moment when the veil wears thin.',
    choices: [
      { text: 'Align yourself with the convergence — become part of the pattern.', effects: [{ kind: 'surge', deltas: { order: 25 }, readings: 3 }] },
      { text: 'Stand at an angle to it — see what the pattern hides.', effects: [{ kind: 'surge', deltas: { chaos: 22 }, readings: 3 }, { kind: 'reading', effect: 'spawn-second' }] },
    ],
    axes: ['fortune', 'information'],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['harmony', 'illumination'],
    dimensions: { favorability: 1.0, certainty: 1.0, volatility: -0.5 },
    modifierRoles: ['effect'],
  },
  {
    id: 'echo-of-past-reading',
    scene: 'The echo of a past divination resurfaces — a card, a number, a symbol — asking to be reconsidered.',
    choices: [
      { text: 'Reinterpret the past — its meaning may have changed.', effects: [{ kind: 'surge', deltas: { chaos: 20 }, readings: 3 }, { kind: 'reading', effect: 'grant-reroll' }] },
      { text: 'Acknowledge and release — the past is settled.', effects: [{ kind: 'shift', affinity: 'fate', amount: 6 }] },
    ],
    axes: ['agency', 'fortune'],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['transformation', 'illumination'],
    dimensions: { favorability: 0.0, certainty: -0.5, volatility: 1.5 },
    modifierRoles: ['subject'],
  },
  {
    id: 'dark-constellation',
    scene: 'A gap in the stars catches your eye — not empty, but dark. A constellation made of absence rather than light.',
    choices: [
      { text: 'Study the negative space — what is missing matters.', effects: [{ kind: 'surge', deltas: { shadow: 25 }, readings: 3 }, { kind: 'reading', effect: 'shroud-card' }] },
      { text: 'Fill the void with your own pattern — create meaning.', effects: [{ kind: 'surge', deltas: { will: 22 }, readings: 3 }, { kind: 'cost', affinity: 'fate', amount: 8 }] },
    ],
    axes: ['information', 'agency'],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['mystery', 'surrender'],
    dimensions: { favorability: -0.5, certainty: -1.5, volatility: 1.0 },
    modifierRoles: ['subject', 'action'],
  },
  {
    id: 'many-threads',
    scene: 'Countless threads of fate shimmer into view, each one a path not taken. The weave is impossibly complex.',
    choices: [
      { text: 'Trace one thread backward — understand what shaped it.', effects: [{ kind: 'surge', deltas: { order: 22 }, readings: 3 }, { kind: 'reading', effect: 'widen-pool' }] },
      { text: 'Pluck a thread and see what unravels — test the weave.', effects: [{ kind: 'upheaval', transform: { transform: 'invert-pair', axis: 'fortune' }, readings: 2 }, { kind: 'surge', deltas: { chaos: 20 }, readings: 2 }] },
    ],
    axes: ['agency', 'fortune'],
    tags: ['event', 'choice', 'affinity-shift'],
    themes: ['mystery', 'transformation'],
    dimensions: { favorability: 0.0, certainty: -2.0, volatility: 2.0 },
    modifierRoles: ['action', 'effect'],
  },
];

// Which polar pair has the widest spread → the player's dominant axis.
export function dominantAxis(aff: Record<AffinityId, number>): AffinityAxis {
  const agency = Math.abs(aff.fate - aff.will);
  const information = Math.abs(aff.light - aff.shadow);
  const fortune = Math.abs(aff.chaos - aff.order);
  if (agency >= information && agency >= fortune) return 'agency';
  if (information >= fortune) return 'information';
  return 'fortune';
}

// Fiction-telegraphed UI cue derived from a choice's effects (never numeric).
export function choiceCue(effects: HappeningEffect[]): 'price' | 'tear' | 'fortune' | null {
  if (effects.some((e) => e.kind === 'upheaval')) return 'tear';
  if (effects.some((e) => e.kind === 'gamble')) return 'fortune';
  if (effects.some((e) => e.kind === 'cost')) return 'price';
  return null;
}

export function selectHappening(
  excludeIds: string[],
  affinities: Record<AffinityId, number>,
): HappeningData {
  let available = HAPPENINGS.filter((h) => !excludeIds.includes(h.id));
  if (available.length === 0) available = [...HAPPENINGS];

  const axis = dominantAxis(affinities);
  const weighted = available.map((h) => ({
    happening: h,
    weight: 1 + (h.axes.includes(axis) ? AXIS_WEIGHT_BONUS : 0),
  }));
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) return w.happening;
  }
  return weighted[weighted.length - 1].happening;
}
