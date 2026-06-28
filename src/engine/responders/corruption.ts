import type { Responder, EffectReport } from '../events/types';
import type { SlotResult, TarotResult } from '../types';
import { corruptionRoll } from '../events/eligibility';
import { TIER_BASE_CHANCE } from '../../data/affinities';
import { CORRUPTED_TAG } from '../../data/corruption';
import { buildFace, DECK_BY_ID, consolidateSpread } from '../../data/tarot';

const T = TIER_BASE_CHANCE;

function report(id: string, description: string, animation: string): EffectReport {
  return { responderId: id, label: 'Corruption', description, animation };
}

// The double-edged corrupted variants: potent but visibly wrong. They fire
// unbidden at virulent+ (the curse), and are exactly what a knowing player farms
// in infected games (the exploit). Every output they touch carries CORRUPTED_TAG.
export function buildCorruptionResponders(): Responder[] {
  return [
    {
      id: 'corruption-extra-result', source: 'interaction',
      triggers: ['dice:commit', 'tarot:commit', 'iching:commit', 'strings:commit', 'astral:commit', 'rune:commit'],
      group: { kind: 'exclusive', band: 'SPAWN' },
      condition: (c) => !!c.draft.outcome && c.draft.outcome.type !== 'happening',
      roll: (c) => corruptionRoll(c, 'virulent', T.major),
      apply: (c) => {
        c.draft.spawnSecond = (c.draft.outcome as SlotResult).type;
        c.draft.corruptSpawn = true; // GameEngine tags the spawned result
        return report('corruption-extra-result', 'Something that should not be claws its way into the reading.', 'second-result');
      },
    },
    {
      id: 'corruption-false-orientation', source: 'interaction',
      triggers: ['tarot:orient'],
      group: { kind: 'exclusive', band: 'MUTATE' },
      condition: (c) => c.draft.outcome?.type === 'tarot' && !!(c.draft.outcome as TarotResult).spread,
      roll: (c) => corruptionRoll(c, 'virulent', T.notable),
      apply: (c) => {
        const result = c.draft.outcome as TarotResult;
        const faces = result.spread!.map((s) =>
          buildFace(DECK_BY_ID[s.card.id], s.card.orientation === 'upright' ? 'reversed' : 'upright'));
        const next = consolidateSpread(faces);
        if (!next.tags.includes(CORRUPTED_TAG)) next.tags = [...next.tags, CORRUPTED_TAG];
        c.draft.outcome = next;
        c.draft.corruptOrient = true;
        return report('corruption-false-orientation', 'The faces turn wrong — the spread reads as something it is not.', 'flip');
      },
    },
  ];
}
