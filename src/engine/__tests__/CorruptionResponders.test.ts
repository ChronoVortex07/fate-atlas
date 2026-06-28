import { describe, it, expect } from 'vitest';
import { buildCorruptionResponders } from '../responders/corruption';
import { defaultAffinityState } from '../../data/affinities';
import { buildFace, FULL_DECK, consolidateSpread } from '../../data/tarot';
import { CORRUPTED_TAG } from '../../data/corruption';
import { GameEngine } from '../GameEngine';
import type { PhaseContext } from '../events/types';
import type { CorruptionBand, DiceResult } from '../types';

function ctx(band: CorruptionBand, over: Partial<PhaseContext>): PhaseContext {
  return {
    trigger: 't', affinities: defaultAffinityState(),
    corruption: { value: band === 'virulent' ? 80 : 50, band },
    slots: [], hand: null, spread: [], minigame: null, event: null,
    rng: () => 0, draft: {}, ...over,
  };
}
const byId = (id: string) => buildCorruptionResponders().find((r) => r.id === id)!;

describe('corruption-extra-result', () => {
  const r = byId('corruption-extra-result');

  it('spawns a corrupted second result at virulent', () => {
    const c = ctx('virulent', { trigger: 'dice:commit', draft: { outcome: { type: 'd20' } as any } });
    expect(r.condition(c)).toBe(true);
    expect(r.roll(c)).toBe(true);
    r.apply(c);
    expect(c.draft.spawnSecond).toBe('d20');
    expect(c.draft.corruptSpawn).toBe(true);
  });

  it('does not fire below virulent', () => {
    const c = ctx('spreading', { trigger: 'dice:commit', draft: { outcome: { type: 'd20' } as any } });
    expect(r.roll(c)).toBe(false);
  });
});

describe('corruption-false-orientation', () => {
  const r = byId('corruption-false-orientation');

  it('flips the spread and tags it corrupted at virulent', () => {
    const spread = consolidateSpread([
      buildFace(FULL_DECK[0], 'upright'),
      buildFace(FULL_DECK[1], 'upright'),
    ]);
    const c = ctx('virulent', { trigger: 'tarot:orient', draft: { outcome: spread } });
    expect(r.condition(c)).toBe(true);
    expect(r.roll(c)).toBe(true);
    r.apply(c);
    const out = c.draft.outcome as typeof spread;
    expect(out.tags).toContain(CORRUPTED_TAG);
    expect(out.spread!.every((s) => s.card.orientation === 'reversed')).toBe(true);
    expect(c.draft.corruptOrient).toBe(true);
  });
});

describe('corrupted spawn is tagged on the committed result (GameEngine)', () => {
  const dice = (): DiceResult => ({
    type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
    tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
  });

  it('attaches the corrupted tag to the spawned second result', () => {
    const e = new GameEngine(3);
    e.startTurn('self');
    e.setCorruption(80); // virulent (so the report queues like the live path)
    e.forceEffects(['corruption-extra-result'], true); // isolate: only this responder fires
    e.completeMinigame(dice());
    const tags = e.getState().turnResults.flatMap((r) => r.tags);
    expect(tags).toContain(CORRUPTED_TAG);
  });
});
