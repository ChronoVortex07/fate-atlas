// Pure D&D skill-check logic for the dice minigame. No DOM / three.js / cannon.
// The d20 roll itself (affinity bias) stays in data/dice.ts (rollD20). This file
// turns a natural d20 into a reading-relative outcome.

import type { DiceCheckPlan, DiceCheckBreakdown, DiceResult, SlotResult, Threshold } from './types';
import { buildDiceResult } from '../data/dice';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Difficulty Class + Bless/Bane from the slots already committed this turn.
// "Balance / rising stakes": a favorable reading raises the bar, a grim one lowers it.
export function planDiceCheck(priorSlots: SlotResult[]): DiceCheckPlan {
  const reading = priorSlots.filter((s) => s.type !== 'happening');

  // Magnitude-weighted mean favorability (strong pulls dominate; matches
  // ReadingPlanner.aggregate's weighting). 0 when there are no priors.
  let num = 0;
  let den = 0;
  for (const s of reading) {
    const f = s.dimensions.favorability;
    num += f * Math.abs(f);
    den += Math.abs(f);
  }
  const priorFav = den > 0 ? num / den : 0;
  const dc = clamp(Math.round(11 + 2.5 * priorFav), 5, 17);

  const sources: string[] = [];
  let bless = 0;
  let bane = 0;
  const favored = reading.find((s) => s.dimensions.favorability >= 1.0);
  const adverse = reading.find((s) => s.dimensions.favorability <= -1.0);
  if (favored) { bless = 1; sources.push(`${slotName(favored)} blesses the cast (+1d4)`); }
  if (adverse) { bane = 1; sources.push(`${slotName(adverse)} curses the cast (−1d4)`); }

  return { dc, bless, bane, sources };
}

function slotName(s: SlotResult): string {
  switch (s.type) {
    case 'd20': return `the d20 (${s.result})`;
    case 'happening': return 'the happening';
    default: return s.name;
  }
}

function tierFromMargin(margin: number): Threshold {
  if (margin >= 5) return 'critical-high';
  if (margin >= 0) return 'high';
  if (margin >= -4) return 'neutral';
  if (margin >= -9) return 'low';
  return 'critical-low';
}

// Roll the Bless/Bane d4s, total against the DC, select the relative tier.
// Natural 20 / natural 1 override the DC with Triumph / Fumble.
export function resolveCheck(
  d20: number,
  plan: DiceCheckPlan,
  rng: () => number = Math.random,
): { result: DiceResult; breakdown: DiceCheckBreakdown } {
  const d4 = () => Math.floor(rng() * 4) + 1;
  const bless = Array.from({ length: plan.bless }, d4);
  const bane = Array.from({ length: plan.bane }, d4);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const total = d20 + sum(bless) - sum(bane);
  const margin = total - plan.dc;

  const critical: DiceCheckBreakdown['critical'] =
    d20 === 20 ? 'triumph' : d20 === 1 ? 'fumble' : null;
  const tier: Threshold =
    critical === 'triumph' ? 'critical-high'
    : critical === 'fumble' ? 'critical-low'
    : tierFromMargin(margin);

  const breakdown: DiceCheckBreakdown = { d20, bless, bane, dc: plan.dc, total, margin, tier, critical };
  return { result: buildDiceResult(breakdown), breakdown };
}
