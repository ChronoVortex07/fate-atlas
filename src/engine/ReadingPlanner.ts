import type {
  SlotResult, GapReport, AggregatedReading, DivinationProfile,
  DivinationType, QuestionType, ModifierRole, ThemeTag, DimensionValues,
} from './types';
import { DIVINATION_PROFILES } from '../data/divination-profiles';

// Theme opposition pairs for tension detection
const THEME_OPPOSITIONS: [ThemeTag, ThemeTag][] = [
  ['upheaval', 'harmony'],
  ['renewal', 'stagnation'],
  ['illumination', 'mystery'],
  ['conflict', 'surrender'],
  ['authority', 'surrender'],
];

// Primary modifier role per question type (for weighted dimension averaging)
const PRIMARY_ROLE: Record<QuestionType, ModifierRole> = {
  decision: 'action',
  relationship: 'subject',
  future: 'effect',
  self: 'subject',
};

export class ReadingPlanner {
  private profiles: Record<string, DivinationProfile>;

  constructor(profiles: Record<string, DivinationProfile> = DIVINATION_PROFILES) {
    this.profiles = profiles;
  }

  /**
   * Analyze current turn results for data gaps.
   * Called after each revealSlot().
   */
  analyzeGaps(results: SlotResult[]): GapReport {
    const nonHappening = results.filter((r) => r.type !== 'happening');
    const allResults = results;

    // Theme confidence: ≥2 results share a theme tag
    const themeCounts = new Map<ThemeTag, number>();
    for (const r of allResults) {
      for (const t of r.themes) {
        themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
      }
    }
    const themeConfidence = [...themeCounts.values()].some((c) => c >= 2);

    // Missing dimensions: no result has |value| >= 0.5 on this axis
    const axisKeys: (keyof DimensionValues)[] = ['favorability', 'certainty', 'volatility'];
    const coveredDimensions = new Set<keyof DimensionValues>();
    for (const r of nonHappening) {
      for (const axis of axisKeys) {
        if (Math.abs(r.dimensions[axis]) >= 0.5) {
          coveredDimensions.add(axis);
        }
      }
    }
    const missingDimensions = axisKeys.filter((a) => !coveredDimensions.has(a));

    // Missing modifiers: no result assigned to this role
    const coveredModifiers = new Set<ModifierRole>();
    for (const r of allResults) {
      for (const role of r.modifierRoles) {
        coveredModifiers.add(role);
      }
    }
    const allModifiers: ModifierRole[] = ['subject', 'action', 'effect'];
    const missingModifiers = allModifiers.filter((m) => !coveredModifiers.has(m));

    return { themeConfidence, missingDimensions, missingModifiers };
  }

  /**
   * Produce bias weights to steer pool refills toward data completeness.
   * Weights are additive to base QUESTION_WEIGHTS, clamped to [-2, +3].
   */
  getBiasForRefill(gaps: GapReport): Partial<Record<DivinationType, number>> {
    const bias: Record<string, number> = { tarot: 0, d20: 0, iching: 0 };

    for (const dim of gaps.missingDimensions) {
      for (const profile of Object.values(this.profiles)) {
        if (profile.type === 'happening') continue; // happenings never in pool
        if (profile.dimensionStrengths.includes(dim)) {
          bias[profile.type] = (bias[profile.type] ?? 0) + 1;
        }
      }
    }

    for (const mod of gaps.missingModifiers) {
      for (const profile of Object.values(this.profiles)) {
        if (profile.type === 'happening') continue;
        if (profile.modifierStrengths.includes(mod)) {
          bias[profile.type] = (bias[profile.type] ?? 0) + 1;
        }
      }
    }

    if (!gaps.themeConfidence) {
      for (const profile of Object.values(this.profiles)) {
        if (profile.type === 'happening') continue;
        if (profile.themeCoverage === 'all') {
          bias[profile.type] = (bias[profile.type] ?? 0) + 1;
        }
      }
    }

    // Clamp to [-2, +3]
    for (const key of Object.keys(bias)) {
      bias[key] = Math.max(-2, Math.min(3, bias[key]));
    }

    return bias as Partial<Record<DivinationType, number>>;
  }

  /**
   * Aggregate all revealed slots into a structured reading.
   * Called at synthesis time when all slots are revealed.
   */
  aggregate(results: SlotResult[], question: QuestionType): AggregatedReading {
    const allResults = results;
    const nonHappening = results.filter((r) => r.type !== 'happening');

    // ── Theme ranking ──
    const themeCounts = new Map<ThemeTag, number>();
    for (const r of allResults) {
      for (const t of r.themes) {
        themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
      }
    }

    // Sort by count desc, then tie-break
    const sortedThemes = [...themeCounts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      // Tie-break: prefer themes from results whose primary modifier matches question's primary role
      const primaryRole = PRIMARY_ROLE[question];
      const aPrimaryMatch = allResults.some(
        (r) => r.themes.includes(a[0]) && r.modifierRoles.includes(primaryRole),
      );
      const bPrimaryMatch = allResults.some(
        (r) => r.themes.includes(b[0]) && r.modifierRoles.includes(primaryRole),
      );
      if (aPrimaryMatch !== bPrimaryMatch) return aPrimaryMatch ? -1 : 1;
      // Second tie-break: higher average dimension magnitude
      const aAvgMag = this.avgDimensionMagnitude(allResults.filter((r) => r.themes.includes(a[0])));
      const bAvgMag = this.avgDimensionMagnitude(allResults.filter((r) => r.themes.includes(b[0])));
      return bAvgMag - aAvgMag;
    });

    // If no themes found at all (defensive), fall back to 'mystery'
    const dominantTheme: ThemeTag = sortedThemes[0]?.[0] ?? 'mystery';
    const secondaryTheme: ThemeTag | null = sortedThemes[1]?.[0] ?? null;

    // ── Dimension profiling over atomic signals ──
    const primaryRole = PRIMARY_ROLE[question];
    const signals = this.atomicSignals(nonHappening);
    const clampDim = (x: number) => Math.max(-2, Math.min(2, Math.round(x * 2) / 2));

    // Favorability: magnitude-weighted so strong pulls dominate rather than cancel.
    let favNum = 0, favDen = 0;
    for (const s of signals) {
      const w = Math.abs(s.dimensions.favorability);
      favNum += s.dimensions.favorability * w;
      favDen += w;
    }

    // Certainty & volatility: primary-role weighted average over atomic signals.
    const weightedAxis = (axis: 'certainty' | 'volatility') => {
      let num = 0, den = 0;
      for (const s of signals) {
        const w = s.modifierRoles.includes(primaryRole) ? 2 : 1;
        num += s.dimensions[axis] * w;
        den += w;
      }
      return den > 0 ? clampDim(num / den) : 0;
    };

    const dimensionProfile: DimensionValues = {
      favorability: favDen > 0 ? clampDim(favNum / favDen) : 0,
      certainty: weightedAxis('certainty'),
      volatility: weightedAxis('volatility'),
    };

    // ── Opposing forces (strongest favorable / adverse atomic signals) ──
    let strongestFavor: { label: string; value: number } | null = null;
    let strongestAdverse: { label: string; value: number } | null = null;
    for (const s of signals) {
      const v = s.dimensions.favorability;
      if (v > 0 && (!strongestFavor || v > strongestFavor.value)) strongestFavor = { label: s.label, value: v };
      if (v < 0 && (!strongestAdverse || v < strongestAdverse.value)) strongestAdverse = { label: s.label, value: v };
    }

    // ── Modifier assignment ──
    const modifierAssignments: Record<ModifierRole, SlotResult[]> = {
      subject: [],
      action: [],
      effect: [],
    };
    for (const r of allResults) {
      for (const role of r.modifierRoles) {
        modifierAssignments[role].push(r);
      }
    }
    // Sort each role's results by sum-of-absolute-dimensions (stronger signal first)
    for (const role of ['subject', 'action', 'effect'] as ModifierRole[]) {
      modifierAssignments[role].sort((a, b) =>
        this.sumAbsDimensions(b) - this.sumAbsDimensions(a),
      );
    }

    // ── Tension detection ──
    let hasTension = false;
    let tensionPair: [ThemeTag, ThemeTag] | null = null;

    if (dominantTheme && secondaryTheme) {
      for (const [a, b] of THEME_OPPOSITIONS) {
        if (
          (dominantTheme === a && secondaryTheme === b) ||
          (dominantTheme === b && secondaryTheme === a)
        ) {
          hasTension = true;
          tensionPair = [a, b];
          break;
        }
      }
    }

    // Also detect tension from high favorability variance
    if (!hasTension && nonHappening.length >= 2) {
      const favors = nonHappening.map((r) => r.dimensions.favorability);
      const mean = favors.reduce((s, v) => s + v, 0) / favors.length;
      const variance = favors.reduce((s, v) => s + (v - mean) ** 2, 0) / favors.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev > 1.5) {
        hasTension = true;
        tensionPair = null; // variance-based tension, not theme pair
      }
    }

    return {
      dominantTheme,
      secondaryTheme,
      dimensionProfile,
      modifierAssignments,
      hasTension,
      tensionPair,
      strongestFavor,
      strongestAdverse,
    };
  }

  private avgDimensionMagnitude(results: SlotResult[]): number {
    if (results.length === 0) return 0;
    let sum = 0;
    for (const r of results) {
      sum += Math.abs(r.dimensions.favorability) +
        Math.abs(r.dimensions.certainty) +
        Math.abs(r.dimensions.volatility);
    }
    return sum / results.length;
  }

  private sumAbsDimensions(result: SlotResult): number {
    return Math.abs(result.dimensions.favorability) +
      Math.abs(result.dimensions.certainty) +
      Math.abs(result.dimensions.volatility);
  }

  /**
   * Flatten results into atomic signals for dimension profiling: each die, each
   * hexagram, each astral cast, and each individual card in a multi-card spread.
   * Removes the double-average where a 3-card spread was pre-averaged to ~0.
   */
  private atomicSignals(results: SlotResult[]): {
    label: string; themes: ThemeTag[]; dimensions: DimensionValues; modifierRoles: ModifierRole[];
  }[] {
    const signals: { label: string; themes: ThemeTag[]; dimensions: DimensionValues; modifierRoles: ModifierRole[] }[] = [];
    for (const r of results) {
      if (r.type === 'happening') continue;
      if (r.type === 'tarot' && r.spread && r.spread.length > 1) {
        for (const sp of r.spread) {
          signals.push({
            label: `the ${sp.card.name} (${sp.card.orientation})`,
            themes: sp.card.themes,
            dimensions: sp.card.dimensions,
            modifierRoles: sp.card.modifierRoles,
          });
        }
      } else if (r.type === 'd20') {
        signals.push({ label: `the dice (${r.result})`, themes: r.themes, dimensions: r.dimensions, modifierRoles: r.modifierRoles });
      } else if (r.type === 'iching') {
        signals.push({ label: `Hexagram ${r.hexagramNumber}`, themes: r.themes, dimensions: r.dimensions, modifierRoles: r.modifierRoles });
      } else {
        // single-card tarot or astral: use the result itself
        const label = r.type === 'tarot' && r.spread?.[0]
          ? `the ${r.spread[0].card.name} (${r.spread[0].card.orientation})`
          : `the ${(r as { name?: string }).name ?? r.type}`;
        signals.push({ label, themes: r.themes, dimensions: r.dimensions, modifierRoles: r.modifierRoles });
      }
    }
    return signals;
  }
}
