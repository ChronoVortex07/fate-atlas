import { describe, it, expect } from 'vitest';
import { buildRuneResponders } from '../responders/runes';
import { buildInteractionResponders } from '../responders/interactions';
import { consolidateScatter } from '../../data/runes';
import type { PhaseContext } from '../events/types';
import type { RuneScatter, LandedRune, RuneOmenTag, RuneId, RuneResult, DiceResult, SlotResult } from '../types';

const R = (id: string) => buildRuneResponders().find((r) => r.id === id)!;

const stone = (rune: RuneId, faceUp = true, orientation: LandedRune['orientation'] = 'upright', ring: LandedRune['ring'] = 'heart'): LandedRune =>
  ({ rune, faceUp, orientation, ring, x: 0, y: 0 });

function scatter(governing: RuneId, omens: RuneOmenTag[] = [], extra: LandedRune[] = [], gov: Partial<LandedRune> = {}): RuneScatter {
  return { stones: [{ ...stone(governing), ...gov }, ...extra], governingIndex: 0, omens };
}

function ctx(s: RuneScatter, spread?: SlotResult[]): PhaseContext {
  const outcome = consolidateScatter(s);
  return {
    trigger: 'rune:commit',
    affinities: { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50 },
    slots: [], hand: null, spread: spread ?? [outcome], minigame: null, event: null,
    draft: { outcome }, rng: () => 0,
  };
}

const dims = (c: PhaseContext) => (c.draft.outcome as RuneResult).dimensions;

describe('rune internal responders', () => {
  it('bindrune amplifies the governing dominant axis', () => {
    const c = ctx(scatter('sowilo', ['bindrune']));
    const r = R('rune-bindrune');
    expect(r.condition(c)).toBe(true);
    const before = dims(c).favorability;
    r.apply(c);
    expect(Math.abs(dims(c).favorability)).toBeGreaterThan(Math.abs(before));
  });

  it('merkstave-cascade raises volatility and lowers favorability', () => {
    const c = ctx(scatter('fehu', ['merkstave-cascade']));
    const r = R('rune-merkstave-cascade');
    expect(r.condition(c)).toBe(true);
    const beforeVol = dims(c).volatility;
    r.apply(c);
    expect(dims(c).volatility).toBeGreaterThan(beforeVol);
  });

  it('true-cast raises certainty', () => {
    const c = ctx(scatter('tiwaz', ['true-cast']));
    const r = R('rune-true-cast');
    expect(r.condition(c)).toBe(true);
    const before = dims(c).certainty;
    r.apply(c);
    expect(dims(c).certainty).toBeGreaterThan(before);
  });

  it('silent-field lowers certainty', () => {
    const c = ctx(scatter('mannaz', ['silent-field']));
    const r = R('rune-silent-field');
    expect(r.condition(c)).toBe(true);
    const before = dims(c).certainty;
    r.apply(c);
    expect(dims(c).certainty).toBeLessThan(before);
  });

  it('errant-rune spawns a second rune', () => {
    const c = ctx(scatter('fehu', ['errant-rune']));
    const r = R('rune-errant');
    expect(r.condition(c)).toBe(true);
    r.apply(c);
    expect(c.draft.spawnSecond).toBe('rune');
  });

  it('Perthro governing spills the cup — spawns a second rune', () => {
    const c = ctx(scatter('perthro'));
    const r = R('rune-perthro');
    expect(r.condition(c)).toBe(true);
    r.apply(c);
    expect(c.draft.spawnSecond).toBe('rune');
  });

  it('Hagalaz governing with another face-up stone raises volatility', () => {
    const c = ctx(scatter('hagalaz', [], [stone('isa', true, 'upright', 'field')]));
    const r = R('rune-hagalaz');
    expect(r.condition(c)).toBe(true);
    const before = dims(c).volatility;
    r.apply(c);
    expect(dims(c).volatility).toBeGreaterThan(before);
  });

  it('Hagalaz alone (no other face-up stone) does not fire', () => {
    const c = ctx(scatter('hagalaz', [], [stone('isa', false, 'upright', 'field')]));
    expect(R('rune-hagalaz').condition(c)).toBe(false);
  });

  it('Isa governing lowers volatility', () => {
    const c = ctx(scatter('isa'));
    const r = R('rune-isa');
    expect(r.condition(c)).toBe(true);
    const before = dims(c).volatility;
    r.apply(c);
    expect(dims(c).volatility).toBeLessThan(before);
  });
});

describe('rune cross-type responders', () => {
  const critHigh: DiceResult = {
    type: 'd20', result: 20, threshold: 'critical-high', interpretation: '',
    tags: ['roll', 'random', 'numeric', 'threshold', 'critical-high'],
    themes: ['renewal'], dimensions: { favorability: 1, certainty: 0, volatility: 0 }, modifierRoles: ['effect'],
  };

  it("Tiwaz's Victory fires with a Tiwaz rune + a critical-high die and lifts favorability", () => {
    const tiwaz = consolidateScatter(scatter('tiwaz'));
    const c = ctx(scatter('tiwaz'), [tiwaz, critHigh]);
    const r = R('rune-tiwaz-victory');
    expect(r.condition(c)).toBe(true);
    const before = dims(c).favorability;
    r.apply(c);
    expect(dims(c).favorability).toBeGreaterThan(before);
  });

  it('does not fire without a critical-high die', () => {
    const tiwaz = consolidateScatter(scatter('tiwaz'));
    const c = ctx(scatter('tiwaz'), [tiwaz]);
    expect(R('rune-tiwaz-victory').condition(c)).toBe(false);
  });
});

describe('rune free participation in existing interactions', () => {
  it('a reversible rune + another reversible slot satisfies the mirror responder', () => {
    const runeOutcome = consolidateScatter(scatter('fehu')); // fehu is reversible → tag 'reversible'
    const otherReversible = { ...consolidateScatter(scatter('uruz')) };
    const mirror = buildInteractionResponders().find((r) => r.id === 'mirror')!;
    const c: PhaseContext = {
      trigger: 'rune:commit',
      affinities: { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50 },
      slots: [], hand: null, spread: [runeOutcome, otherReversible], minigame: null, event: null,
      draft: { outcome: runeOutcome }, rng: () => 0,
    };
    expect(runeOutcome.tags).toContain('reversible');
    expect(mirror.condition(c)).toBe(true);
  });
});
