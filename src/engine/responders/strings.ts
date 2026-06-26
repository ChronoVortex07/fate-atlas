import type { Responder, PhaseContext, EffectReport } from '../events/types';
import type { AffinityId, StringsResult, DimensionValues, ThemeTag } from '../types';
import { bandRoll } from '../events/eligibility';
import { TIER_BASE_CHANCE } from '../../data/affinities';
import { CONCEPTS } from '../../data/strings';

const T = TIER_BASE_CHANCE;
const w = (a: AffinityId) => (c: PhaseContext) => c.affinities[a];
const out = (c: PhaseContext) => (c.draft.outcome?.type === 'strings' ? (c.draft.outcome as StringsResult) : null);
const clamp = (v: number) => Math.max(-2, Math.min(2, Math.round(v * 2) / 2));
const dominantAxis = (d: DimensionValues): keyof DimensionValues =>
  (['favorability', 'certainty', 'volatility'] as (keyof DimensionValues)[])
    .reduce((m, a) => (Math.abs(d[a]) > Math.abs(d[m]) ? a : m), 'favorability');

function report(id: string, label: string, description: string, animation: string): EffectReport {
  return { responderId: id, label, description, animation };
}
function addTheme(r: StringsResult, t: ThemeTag) {
  if (!r.themes.includes(t)) r.themes = ([t, ...r.themes] as ThemeTag[]).slice(0, 2);
}

const THEME_OPPOSED: [ThemeTag, ThemeTag][] = [
  ['upheaval', 'harmony'], ['renewal', 'stagnation'],
  ['illumination', 'mystery'], ['conflict', 'surrender'], ['authority', 'surrender'],
];
const pathThemes = (r: StringsResult) => new Set<ThemeTag>(r.path.flatMap((n) => CONCEPTS[n.conceptId].themes));
const sharesCommonTheme = (r: StringsResult): boolean => {
  const sets = r.path.map((n) => new Set(CONCEPTS[n.conceptId].themes));
  if (sets.length === 0) return false;
  let common = sets[0];
  for (const s of sets.slice(1)) common = new Set([...common].filter((x) => s.has(x)));
  return common.size > 0;
};

// Combine 'weave' helper (mirrors interactions.ts spreadEntry): mutate the result
// in place, push a report to the weave channel, return null.
function weaveEntry(
  id: string,
  fires: (r: StringsResult) => boolean,
  apply: (r: StringsResult, push: (rep: EffectReport) => void) => void,
): Responder {
  return {
    id, source: 'interaction', triggers: ['strings:commit'],
    group: { kind: 'combine', channel: 'weave' },
    condition: (c) => { const r = out(c); return !!r && r.path.length > 1 && fires(r); },
    roll: () => true,
    apply: (c) => {
      const r = out(c)!;
      const push = (rep: EffectReport) => { (c.draft.weaveReports ??= []).push(rep); };
      apply(r, push);
      c.draft.outcome = r;
      return null;
    },
  };
}

export function buildStringsResponders(): Responder[] {
  return [
    // ── Pick-time: OVERRIDE redirects (one winner), SPAWN foregone step ──
    {
      id: 'chaos-stray-thread', source: 'affinity', triggers: ['strings:pick'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('chaos'),
      condition: (c) => Array.isArray(c.draft.candidateIds) && (c.draft.candidateIds as string[]).length >= 2 && typeof c.draft.chosenId === 'string',
      roll: (c) => bandRoll(c, 'chaos', 'ascendant', T.notable),
      apply: (c) => {
        const cand = c.draft.candidateIds as string[];
        const chosen = c.draft.chosenId as string;
        const others = cand.filter((id) => id !== chosen);
        c.draft.redirectTo = others[Math.floor(c.rng() * others.length)];
        return report('chaos-stray-thread', 'Chaos', 'The thread strays — fate pulls it to another star.', 'override');
      },
    },
    {
      id: 'fate-pull-thread', source: 'affinity', triggers: ['strings:pick'],
      group: { kind: 'exclusive', band: 'OVERRIDE' }, weight: w('fate'),
      condition: (c) => Array.isArray(c.draft.candidateIds) && (c.draft.candidateIds as string[]).length >= 2 && typeof c.draft.chosenId === 'string',
      roll: (c) => bandRoll(c, 'fate', 'ascendant', T.major),
      apply: (c) => {
        const cand = c.draft.candidateIds as string[];
        const chosen = c.draft.chosenId as string;
        const others = cand.filter((id) => id !== chosen);
        c.draft.redirectTo = others[Math.floor(c.rng() * others.length)];
        return report('fate-pull-thread', 'Fate', 'The weave moves your hand — another path is chosen for you.', 'override');
      },
    },
    {
      id: 'fate-foregone-step', source: 'affinity', triggers: ['strings:pick'],
      group: { kind: 'exclusive', band: 'SPAWN' }, weight: w('fate'),
      condition: (c) => typeof c.draft.chosenId === 'string' && c.draft.hasForwardAfter === true,
      roll: (c) => bandRoll(c, 'fate', 'dominant', T.major),
      apply: (c) => {
        c.draft.foregoneStep = true;
        return report('fate-foregone-step', 'Fate', 'The weave takes the next step itself.', 'second-result');
      },
    },

    // ── Commit-time: Order straightens (exclusive MUTATE) ──
    {
      id: 'order-true-weave', source: 'affinity', triggers: ['strings:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: w('order'),
      condition: (c) => !!out(c),
      roll: (c) => bandRoll(c, 'order', 'ascendant', T.notable),
      apply: (c) => {
        const r = out(c)!;
        const axis = dominantAxis(r.dimensions);
        r.dimensions[axis] = clamp(r.dimensions[axis] * 0.5);
        c.draft.outcome = r;
        return report('order-true-weave', 'Order', 'Order straightens the weave — its sharpest pull is tempered.', 'anchor');
      },
    },

    // ── Commit-time: path-internal (combine 'weave', deterministic) ──
    weaveEntry('coherent-weave', (r) => sharesCommonTheme(r), (r, push) => {
      const axis = dominantAxis(r.dimensions);
      r.dimensions[axis] = clamp((r.dimensions[axis] * 1.5) || 0.5);
      push(report('coherent-weave', 'Coherent Weave', 'The thread holds one meaning end to end — its nature deepens.', 'amplify'));
    }),
    weaveEntry('tangled-weave', (r) => { const t = pathThemes(r); return THEME_OPPOSED.some(([a, b]) => t.has(a) && t.has(b)); }, (r, push) => {
      r.dimensions.volatility = clamp(r.dimensions.volatility + 1.0);
      push(report('tangled-weave', 'Tangled Weave', 'Opposed forces knot along the thread — the reading turns turbulent.', 'amplify'));
    }),
    weaveEntry('luminous-path', (r) => r.path.every((n) => n.family === 'benevolent'), (r, push) => {
      r.dimensions.favorability = clamp(r.dimensions.favorability + 0.5);
      push(report('luminous-path', 'Luminous Path', 'Every star on the thread shines kindly — the way is bright.', 'anchor'));
    }),
    weaveEntry('shrouded-path', (r) => r.path.every((n) => n.family === 'challenging'), (r, push) => {
      r.dimensions.favorability = clamp(r.dimensions.favorability - 0.5);
      addTheme(r, 'mystery');
      push(report('shrouded-path', 'Shrouded Path', 'Every star on the thread is a hard one — shadow pools in the weave.', 'shroud'));
    }),

    // ── Commit-time: cross-slot resonance (combine 'weave') ──
    {
      id: 'woven-echo', source: 'interaction', triggers: ['strings:commit'],
      group: { kind: 'combine', channel: 'weave' },
      condition: (c) => {
        const r = out(c);
        if (!r) return false;
        const dom = r.themes[0];
        return !!dom && c.spread.some((s) => s !== r && s.type !== 'happening' && s.themes.includes(dom));
      },
      roll: () => true,
      apply: (c) => {
        const r = out(c)!;
        const axis = dominantAxis(r.dimensions);
        r.dimensions[axis] = clamp((r.dimensions[axis] * 1.25) || r.dimensions[axis]);
        c.draft.outcome = r;
        (c.draft.weaveReports ??= []).push(report('woven-echo', 'Woven Echo', 'The thread echoes a force already drawn — the weave resonates.', 'mirror'));
        return null;
      },
    },
  ];
}
