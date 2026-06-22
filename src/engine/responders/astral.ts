import type { Responder, PhaseContext, EffectReport } from '../events/types';
import type { AstralResult, DimensionValues, ThemeTag } from '../types';

const out = (c: PhaseContext) => (c.draft.outcome?.type === 'astral' ? (c.draft.outcome as AstralResult) : null);
const has = (c: PhaseContext, tag: string) => !!out(c)?.tags.includes(tag);
const clamp = (v: number) => Math.max(-2, Math.min(2, Math.round(v * 2) / 2));
const dominantAxis = (d: DimensionValues): keyof DimensionValues =>
  (['favorability', 'certainty', 'volatility'] as (keyof DimensionValues)[])
    .reduce((m, a) => (Math.abs(d[a]) > Math.abs(d[m]) ? a : m), 'favorability');

function report(id: string, label: string, description: string, animation: string): EffectReport {
  return { responderId: id, label, description, animation };
}
function bump(r: AstralResult, axis: keyof DimensionValues, by: number) {
  r.dimensions[axis] = clamp(r.dimensions[axis] + by);
}

export function buildAstralResponders(): Responder[] {
  return [
    {
      id: 'astral-dignity', source: 'interaction', triggers: ['astral:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'dignified'),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; const axis = dominantAxis(r.dimensions);
        bump(r, axis, Math.sign(r.dimensions[axis] || 1) * 0.5);
        return report('astral-dignity', 'Dignity', 'The planet sits enthroned in its own sign — its nature redoubles.', 'override');
      },
    },
    {
      id: 'astral-debility', source: 'interaction', triggers: ['astral:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'debilitated'),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; bump(r, 'favorability', -0.5); bump(r, 'volatility', 0.5);
        return report('astral-debility', 'Debility', 'The planet languishes in a hostile sign — its strength curdles.', 'shroud');
      },
    },
    {
      id: 'astral-great-trine', source: 'interaction', triggers: ['astral:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'aspect-trine') && (has(c, 'planet-jupiter') || has(c, 'planet-venus')),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; bump(r, 'favorability', 1.0);
        if (!r.themes.includes('harmony')) r.themes = [...r.themes.slice(0, 1), 'harmony'];
        return report('astral-great-trine', 'The Great Trine', 'The benefic flows in perfect trine — fortune pours through the chart.', 'add-choice');
      },
    },
    {
      id: 'astral-duel', source: 'interaction', triggers: ['astral:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'planet-mars') && (has(c, 'aspect-square') || has(c, 'aspect-opposition')),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; bump(r, 'volatility', 1.0); bump(r, 'favorability', -0.5);
        if (!r.themes.includes('conflict')) r.themes = (['conflict', ...r.themes] as ThemeTag[]).slice(0, 2);
        return report('astral-duel', 'The Duel', 'Mars strikes across a hard angle — the cast turns to open conflict.', 'flip');
      },
    },
    {
      id: 'astral-saturns-gate', source: 'interaction', triggers: ['astral:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'planet-saturn') && (has(c, 'house-1') || has(c, 'house-10')),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; bump(r, 'certainty', 1.0); bump(r, 'favorability', -0.5);
        if (!r.themes.includes('authority')) r.themes = (['authority', ...r.themes] as ThemeTag[]).slice(0, 2);
        return report('astral-saturns-gate', "Saturn's Gate", 'Saturn guards the angle — the way forward exacts its toll.', 'override');
      },
    },
    {
      id: 'astral-errant-star', source: 'interaction', triggers: ['astral:commit'],
      group: { kind: 'exclusive', band: 'SPAWN' }, weight: () => 1,
      condition: (c) => has(c, 'errant-star'),
      roll: () => true,
      apply: (c) => {
        c.draft.spawnSecond = 'astral';
        return report('astral-errant-star', 'The Errant Star', 'A die flees the chart entirely — a force beyond the heavens answers.', 'second-result');
      },
    },
    {
      id: 'astral-conjunction-crowned', source: 'interaction', triggers: ['astral:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 2,
      condition: (c) => has(c, 'crowned-conjunction'),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; const axis = dominantAxis(r.dimensions);
        bump(r, axis, Math.sign(r.dimensions[axis] || 1) * 1.0);
        return report('astral-conjunction-crowned', 'Conjunction Crowned', 'The dice rest as one — their union blazes past all measure.', 'override');
      },
    },
    {
      id: 'astral-veiled-oracle', source: 'interaction', triggers: ['astral:commit'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: () => 1,
      condition: (c) => has(c, 'veiled-oracle'),
      roll: () => true,
      apply: (c) => {
        const r = out(c)!; bump(r, 'certainty', -1.0);
        if (!r.themes.includes('mystery')) r.themes = [...r.themes.slice(0, 1), 'mystery' as ThemeTag];
        return report('astral-veiled-oracle', 'The Veiled Oracle', 'A die rests askew — the reading keeps its secret.', 'shroud');
      },
    },
  ];
}
