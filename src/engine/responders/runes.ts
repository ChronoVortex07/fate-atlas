import type { Responder, PhaseContext, EffectReport } from '../events/types';
import type { RuneResult, DiceResult, DimensionValues, ThemeTag, SlotResult } from '../types';

const out = (c: PhaseContext) => (c.draft.outcome?.type === 'rune' ? (c.draft.outcome as RuneResult) : null);
const has = (c: PhaseContext, tag: string) => !!out(c)?.tags.includes(tag);
const clamp = (v: number) => Math.max(-2, Math.min(2, Math.round(v * 2) / 2));
const dominantAxis = (d: DimensionValues): keyof DimensionValues =>
  (['favorability', 'certainty', 'volatility'] as (keyof DimensionValues)[])
    .reduce((m, a) => (Math.abs(d[a]) > Math.abs(d[m]) ? a : m), 'favorability');

function report(id: string, label: string, description: string, animation: string): EffectReport {
  return { responderId: id, label, description, animation };
}
function bump(r: RuneResult, axis: keyof DimensionValues, by: number) {
  r.dimensions[axis] = clamp(r.dimensions[axis] + by);
}
function addTheme(r: RuneResult, t: ThemeTag) {
  if (!r.themes.includes(t)) r.themes = ([t, ...r.themes] as ThemeTag[]).slice(0, 2);
}
// Number of face-up stones in the governing rune's scatter.
const faceUpCount = (c: PhaseContext) => out(c)?.scatter.stones.filter((s) => s.faceUp).length ?? 0;
const critHighDie = (spread: SlotResult[]) =>
  spread.some((s): s is DiceResult => s.type === 'd20' && (s as DiceResult).threshold === 'critical-high');

export function buildRuneResponders(): Responder[] {
  return [
    {
      id: 'rune-bindrune', source: 'interaction', triggers: ['rune:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'bindrune'),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; const axis = dominantAxis(r.dimensions);
        r.dimensions[axis] = clamp(r.dimensions[axis] * 1.5 || 0.5);
        return report('rune-bindrune', 'Bindrune', 'Two staves of one aett bind about the governing rune — its nature deepens.', 'amplify');
      },
    },
    {
      id: 'rune-merkstave-cascade', source: 'interaction', triggers: ['rune:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'merkstave-cascade'),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; bump(r, 'volatility', 1.0); bump(r, 'favorability', -0.5);
        addTheme(r, 'upheaval');
        return report('rune-merkstave-cascade', 'Merkstave Cascade', 'Every fallen stave lies reversed — a cascade of shadow runs through the cast.', 'flip');
      },
    },
    {
      id: 'rune-true-cast', source: 'interaction', triggers: ['rune:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'true-cast'),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; bump(r, 'certainty', 1.0);
        addTheme(r, 'illumination');
        return report('rune-true-cast', 'True Cast', 'The governing stave rests upright in the Heart — the reading rings clear.', 'anchor');
      },
    },
    {
      id: 'rune-silent-field', source: 'interaction', triggers: ['rune:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'silent-field'),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; bump(r, 'certainty', -1.0);
        addTheme(r, 'mystery');
        return report('rune-silent-field', 'The Silent Field', 'Most staves lie face-down and dumb — the cast keeps its counsel.', 'shroud');
      },
    },
    {
      id: 'rune-errant', source: 'interaction', triggers: ['rune:commit'],
      group: { kind: 'exclusive', band: 'SPAWN' }, weight: () => 1,
      condition: (c) => has(c, 'errant-rune'),
      roll: () => true,
      apply: (c) => {
        c.draft.spawnSecond = 'rune';
        return report('rune-errant', 'The Errant Rune', 'A stave flies clear of the cloth — a force beyond the cast answers.', 'second-result');
      },
    },
    {
      id: 'rune-perthro', source: 'interaction', triggers: ['rune:commit'],
      group: { kind: 'exclusive', band: 'SPAWN' }, weight: () => 2,
      condition: (c) => has(c, 'rune-perthro'),
      roll: () => true,
      apply: (c) => {
        c.draft.spawnSecond = 'rune';
        return report('rune-perthro', 'Perthro, the Lot-Cup', 'Perthro governs — the cup of fate spills, and the lots are cast anew.', 'second-result');
      },
    },
    {
      id: 'rune-hagalaz', source: 'interaction', triggers: ['rune:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'rune-hagalaz') && faceUpCount(c) >= 2,
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; bump(r, 'volatility', 1.0); bump(r, 'favorability', -0.5);
        addTheme(r, 'upheaval');
        return report('rune-hagalaz', 'Hagalaz, the Hailstone', 'Hail strikes across the scatter — the storm breaks the reading open.', 'flip');
      },
    },
    {
      id: 'rune-isa', source: 'interaction', triggers: ['rune:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'rune-isa'),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; bump(r, 'volatility', -1.0); bump(r, 'certainty', 0.5);
        addTheme(r, 'stagnation');
        return report('rune-isa', 'Isa, the Standstill', 'Ice grips the cast — all motion freezes into a single, certain stillness.', 'override');
      },
    },
    {
      id: 'rune-tiwaz-victory', source: 'interaction', triggers: ['dice:commit', 'rune:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) =>
        c.spread.some((s) => s.tags.includes('rune-tiwaz')) && critHighDie(c.spread),
      roll: () => true,
      apply: (c) => {
        const o = c.draft.outcome;
        if (o && o.type !== 'happening') {
          o.dimensions.favorability = clamp(o.dimensions.favorability + 1.0);
        }
        return report('rune-tiwaz-victory', "Tiwaz's Victory", 'The warrior-rune meets a crowning roll — victory compounds upon victory.', 'amplify');
      },
    },
  ];
}
