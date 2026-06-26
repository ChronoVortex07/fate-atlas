import { describe, it, expect } from 'vitest';
import { dispatch } from '../events/EventDispatcher';
import { buildStringsResponders } from '../responders/strings';
import { CONCEPTS } from '../../data/strings';
import type { PhaseContext, PhaseDraft } from '../events/types';
import type { AffinityId, WovenNode, SlotResult } from '../types';

export const node = (conceptId: string, band: number): WovenNode =>
  ({ id: `b${band}`, conceptId, band, family: CONCEPTS[conceptId].family, x: 0, y: 0 });

export function ctx(
  trigger: string, draft: PhaseDraft,
  opts: { affinities?: Partial<Record<AffinityId, number>>; slots?: SlotResult[]; rng?: () => number } = {},
): PhaseContext {
  const slots = opts.slots ?? [];
  return {
    trigger,
    affinities: { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50, ...(opts.affinities ?? {}) },
    slots, hand: null, spread: slots, minigame: null, event: null,
    draft, rng: opts.rng ?? (() => 0.5),
  };
}

const rs = buildStringsResponders();

describe('strings pick-time responders', () => {
  it('chaos-stray-thread redirects the pick to a different candidate', () => {
    const c = ctx('strings:pick', { chosenId: 'b1-0', candidateIds: ['b1-0', 'b1-1', 'b1-2'], hasForwardAfter: true }, { rng: () => 0 });
    dispatch('strings:pick', c, rs, { forced: ['chaos-stray-thread'], isolate: true });
    expect(typeof c.draft.redirectTo).toBe('string');
    expect(c.draft.redirectTo).not.toBe('b1-0');
  });

  it('fate-foregone-step flags a foregone step when a forward step remains', () => {
    const c = ctx('strings:pick', { chosenId: 'b1-0', candidateIds: ['b1-0', 'b1-1'], hasForwardAfter: true });
    dispatch('strings:pick', c, rs, { forced: ['fate-foregone-step'], isolate: true });
    expect(c.draft.foregoneStep).toBe(true);
  });
});
