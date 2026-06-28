import type { ModifierRole, DimensionValues } from '../../types';
import type { FavBand } from '../types';
import { READING_FRAGMENTS } from '../../../data/reading-fragments';

export function favBandOf(value: number): FavBand {
  if (value >= 0.5) return 'high';
  if (value <= -0.5) return 'low';
  return 'neutral';
}

/** Deterministic, rotation-free index into a pool, varied per draw. */
export function stableIndex(key: string, len: number): number {
  if (len <= 0) return 0;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % len;
}

/** Prefix "The " for a card name unless it already carries an article. */
export function withArticle(name: string): string {
  return /^(the|a|an) /i.test(name) ? name : `The ${name}`;
}

/** Trim a flavor sentence to a short, lower-cased gloss phrase. */
export function gloss(text: string): string {
  const first = text.split(/[.;—]/)[0]?.trim() ?? '';
  if (!first) return '';
  return first.charAt(0).toLowerCase() + first.slice(1);
}

export function verbPhrase(role: ModifierRole, dims: DimensionValues, seedKey: string): string {
  const band = favBandOf(dims.favorability);
  const pool = READING_FRAGMENTS.verbPhrases[role][band];
  return pool[stableIndex(seedKey, pool.length)];
}

/** Join with `mid` between items and `last` before the final item (sequence style). */
export function joinSeq(items: string[], last: string, mid: string): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(mid)}${last}${items[items.length - 1]}`;
}

/** Same as joinSeq; named for list-of-names readability at call sites. */
export function joinAnd(items: string[], last: string, mid: string): string {
  return joinSeq(items, last, mid);
}

export function meanFavorability(slots: { dimensions: DimensionValues }[]): number {
  if (slots.length === 0) return 0;
  return slots.reduce((s, r) => s + r.dimensions.favorability, 0) / slots.length;
}
