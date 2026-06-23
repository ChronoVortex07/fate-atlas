import type { Responder, PhaseContext, EffectReport } from '../events/types';
import type { AffinityId, IChingResult } from '../types';
import { bandRoll } from '../events/eligibility';
import { TIER_BASE_CHANCE } from '../../data/affinities';
import { relatingBinary, hexagramByBinary } from '../../data/iching';

const T = TIER_BASE_CHANCE;
const w = (a: AffinityId) => (ctx: PhaseContext) => ctx.affinities[a];

function report(id: string, label: string, description: string, animation: string): EffectReport {
  return { responderId: id, label, description, animation };
}

function recomputeRelating(res: IChingResult): void {
  if (!res.cast) return;
  res.cast.relatingNumber = hexagramByBinary(relatingBinary(res.cast)).number;
  res.relatingNumber = res.cast.relatingNumber;
}

const ichingOutcome = (c: PhaseContext): IChingResult | null =>
  c.draft.outcome?.type === 'iching' ? (c.draft.outcome as IChingResult) : null;

export function buildIChingResponders(): Responder[] {
  return [
    {
      id: 'chaos-line-cascade', source: 'affinity', triggers: ['iching:transform'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: w('chaos'),
      condition: (c) => { const r = ichingOutcome(c); return !!r?.cast && r.cast.changingLines.length < 6; },
      roll: (c) => bandRoll(c, 'chaos', 'ascendant', T.notable),
      apply: (c) => {
        const r = ichingOutcome(c)!;
        const free = [1, 2, 3, 4, 5, 6].filter((n) => !r.cast!.changingLines.includes(n));
        const pick = free[Math.floor(c.rng() * free.length)];
        r.cast!.changingLines = [...r.cast!.changingLines, pick].sort((a, b) => a - b);
        r.changingLines = r.cast!.changingLines;
        recomputeRelating(r);
        return report('chaos-line-cascade', 'Chaos', 'A still line stirs — the change spreads further.', 'amplify');
      },
    },
    {
      id: 'order-still-hexagram', source: 'affinity', triggers: ['iching:transform'],
      group: { kind: 'exclusive', band: 'MUTATE' }, weight: w('order'),
      condition: (c) => { const r = ichingOutcome(c); return !!r?.cast && r.cast.changingLines.length > 0; },
      roll: (c) => bandRoll(c, 'order', 'ascendant', T.notable),
      apply: (c) => {
        const r = ichingOutcome(c)!;
        const lines = r.cast!.changingLines;
        const drop = lines[Math.floor(c.rng() * lines.length)];
        r.cast!.changingLines = lines.filter((n) => n !== drop);
        r.changingLines = r.cast!.changingLines;
        recomputeRelating(r);
        return report('order-still-hexagram', 'Order', 'A moving line settles — the hexagram holds its form.', 'anchor');
      },
    },
  ];
}
