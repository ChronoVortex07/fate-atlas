import type { EffectReport, SlotResult } from '../../../engine/types';
import type { ParticleModel } from '../ParticleField';
import { outcomeKey, constellationKey } from '../../../context/AnchorRegistry';

// The ~10 choreography verbs every effect composes from.
export type Primitive =
  | 'glow' | 'flip' | 'spawn' | 'dissolve' | 'veil'
  | 'reroll' | 'override' | 'mirror' | 'amplify' | 'interrupt';

export interface Theme {
  palette: string[];
  model: ParticleModel;
  key: string; // affinity or element id — for per-theme styling in primitives
}

// Maps the legacy `EffectReport.animation` strings onto choreography primitives.
const PRIMITIVE_BY_ANIMATION: Record<string, Primitive> = {
  reroll: 'reroll',
  flip: 'flip',
  mirror: 'mirror',
  widen: 'spawn',
  'second-result': 'spawn',
  'add-choice': 'spawn',
  thin: 'dissolve',
  shroud: 'veil',
  override: 'override',
  interrupt: 'interrupt',
  amplify: 'amplify',
  anchor: 'glow',
};

export function primitiveFor(animation: string): Primitive {
  return PRIMITIVE_BY_ANIMATION[animation] ?? 'glow';
}

// Primitives that play ON the real card (anchored). Kept in sync with the
// sequencer's ANCHORED map. Drives the fan-expansion venue decision below.
const MIGRATED_SET = new Set<Primitive>(['spawn', 'reroll', 'veil']);
export function isMigrated(p: Primitive): boolean {
  return MIGRATED_SET.has(p);
}

/**
 * The constellation slot the fan should expand to so the animation can play on a
 * large, centered card — or `null` when the effect plays on the minigame
 * outcome, in which case the fan must NOT expand (expanding would occlude the
 * very card the animation targets). Migrated effects expand only when they
 * actually anchor to a fan card; legacy centered effects keep their prior
 * behavior of spotlighting the source/cause card during the focus beat.
 */
export function expandSlotFor(report: EffectReport): number | null {
  if (isMigrated(primitiveFor(report.animation))) {
    return typeof report.targetSlot === 'number' ? report.targetSlot : null;
  }
  return typeof report.sourceSlot === 'number' ? report.sourceSlot : null;
}

// Affinity palettes — core hex copied verbatim from EventBanner's AFFINITY_COLOR,
// plus the accent + particle model from the design's theming bible.
const AFFINITY: Record<string, Theme> = {
  Will:   { palette: ['#5b8c5a', '#8fd49a'], model: 'rising',  key: 'will' },
  Fate:   { palette: ['#d4a854', '#f0d890'], model: 'swirl',   key: 'fate' },
  Shadow: { palette: ['#9b6bb0', '#1a0f2e'], model: 'falling', key: 'shadow' },
  Light:  { palette: ['#e6d8a8', '#fffbe8'], model: 'radial',  key: 'light' },
  Chaos:  { palette: ['#c75b4a', '#ff7a4a'], model: 'shard',   key: 'chaos' },
  Order:  { palette: ['#5b7ec7', '#aac4ff'], model: 'implode', key: 'order' },
};

// Element palettes for meta-interactions themed off the triggering card.
const ELEMENT: Record<string, Theme> = {
  fire:  { palette: ['#c75b4a', '#ff9a4a'], model: 'rising',  key: 'fire' },
  water: { palette: ['#4a8cc7', '#7ac4e6'], model: 'swirl',   key: 'water' },
  air:   { palette: ['#c8d8f0', '#ffffff'], model: 'radial',  key: 'air' },
  earth: { palette: ['#8a9a5b', '#c7b06b'], model: 'falling', key: 'earth' },
};

const FALLBACK: Theme = AFFINITY.Fate;

function elementOf(result: SlotResult | undefined): string | null {
  if (!result) return null;
  const tag = result.tags.find((t) => t.startsWith('element-'));
  return tag ? tag.slice('element-'.length) : null;
}

/**
 * Affinity reports carry the affinity name in `label`. Meta-interactions instead
 * theme off the triggering card: derive the element from the source slot. Pure
 * dimension shifts with no source card fall back to fate-gold.
 */
export function themeFor(report: EffectReport, results: SlotResult[]): Theme {
  const byAffinity = AFFINITY[report.label];
  if (byAffinity) return byAffinity;

  if (typeof report.sourceSlot === 'number') {
    const el = elementOf(results[report.sourceSlot]);
    if (el && ELEMENT[el]) return ELEMENT[el];
  }
  return FALLBACK;
}

/**
 * Which on-screen target the animation plays on. A `targetSlot` marks the
 * constellation/hand card that actually changes. A `sourceSlot` is only the
 * *cause* — it is already surfaced by the fan auto-expanding and glowing that
 * card (InteractionFocusContext), so the animation itself plays on the freshly
 * committed outcome, not the source card.
 */
export function anchorKeyFor(report: EffectReport): string {
  if (typeof report.targetSlot === 'number') return constellationKey(report.targetSlot);
  return outcomeKey;
}
