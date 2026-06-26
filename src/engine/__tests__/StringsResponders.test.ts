import { describe, it, expect } from 'vitest';
import { dispatch } from '../events/EventDispatcher';
import { buildStringsResponders } from '../responders/strings';
import { consolidatePath, CONCEPTS } from '../../data/strings';
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

const dom = (d: SlotResult['dimensions']) =>
  (['favorability', 'certainty', 'volatility'] as const).reduce((m, a) => (Math.abs(d[a]) > Math.abs(d[m]) ? a : m), 'favorability' as 'favorability' | 'certainty' | 'volatility');

describe('strings commit-time responders', () => {
  it('coherent-weave amplifies the dominant dimension on a single-theme path', () => {
    // all share 'renewal'
    const outcome = consolidatePath([node('a-rising-tide', 0), node('the-blossom', 1), node('the-dawn', 3)]);
    const before = outcome.dimensions[dom(outcome.dimensions)];
    const c = ctx('strings:commit', { outcome });
    dispatch('strings:commit', c, rs, { forced: ['coherent-weave'], isolate: true });
    const after = (c.draft.outcome as typeof outcome).dimensions[dom(outcome.dimensions)];
    expect(Math.abs(after)).toBeGreaterThan(Math.abs(before));
  });

  it('tangled-weave raises volatility on an opposed-theme path', () => {
    // conflict (the-severance) vs surrender (the-parting) → opposed pair
    const outcome = consolidatePath([node('the-self', 0), node('the-severance', 1), node('the-parting', 3)]);
    const before = outcome.dimensions.volatility;
    const c = ctx('strings:commit', { outcome });
    dispatch('strings:commit', c, rs, { forced: ['tangled-weave'], isolate: true });
    expect((c.draft.outcome as typeof outcome).dimensions.volatility).toBeGreaterThan(before);
  });

  it('order-true-weave tempers the most extreme dimension', () => {
    const outcome = consolidatePath([node('the-self', 0), node('the-fracture', 1), node('the-turning', 3)]);
    const before = Math.abs(outcome.dimensions[dom(outcome.dimensions)]);
    const c = ctx('strings:commit', { outcome }, { affinities: { order: 80 } });
    dispatch('strings:commit', c, rs, { forced: ['order-true-weave'], isolate: true });
    const after = Math.abs((c.draft.outcome as typeof outcome).dimensions[dom(outcome.dimensions)]);
    expect(after).toBeLessThan(before);
  });

  it('woven-echo fires when another slot shares the destination theme', () => {
    const outcome = consolidatePath([node('the-self', 0), node('a-rising-tide', 1), node('the-dawn', 3)]); // dominant 'renewal'
    const sharer: SlotResult = {
      type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
      tags: [], themes: ['renewal'], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
    } as SlotResult;
    const c = ctx('strings:commit', { outcome }, { slots: [sharer, outcome] });
    const { reports } = dispatch('strings:commit', c, rs, { forced: ['woven-echo'], isolate: true });
    expect(reports.some((r) => r.responderId === 'woven-echo')).toBe(true);
  });
});

import { buildAffinityResponders } from '../responders/affinity';

describe('chaos-second-result on strings', () => {
  it('spawns a strings second when forced on a strings commit', () => {
    const affRs = buildAffinityResponders();
    const outcome = consolidatePath([node('the-self', 0), node('a-rising-tide', 1), node('the-dawn', 3)]);
    const c = ctx('strings:commit', { outcome });
    dispatch('strings:commit', c, affRs, { forced: ['chaos-second-result'], isolate: true });
    expect(c.draft.spawnSecond).toBe('strings');
  });
});
