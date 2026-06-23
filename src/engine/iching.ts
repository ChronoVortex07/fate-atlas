import type { AffinityId, AffinityMandate, IChingResult } from './types';
import { bandOf, BAND_ORDER } from '../data/affinities';

export type HexagramMode = 'willed' | 'fated' | 'unaligned';

const atLeast = (value: number, band: 'ascendant') =>
  BAND_ORDER.indexOf(bandOf(value ?? 0)) >= BAND_ORDER.indexOf(band);

export function planHexagramResolution(
  affinities: Record<string, number>,
  hasChangingLines: boolean,
): { mode: HexagramMode; offerRecast: boolean } {
  if (!hasChangingLines) return { mode: 'unaligned', offerRecast: false };
  if (atLeast(affinities.will, 'ascendant')) return { mode: 'willed', offerRecast: false };
  if (atLeast(affinities.fate, 'ascendant')) return { mode: 'fated', offerRecast: false };
  return { mode: 'unaligned', offerRecast: true };
}

// Fate carries the seeker forward to where the change leads.
export const resolveFatedGoverning = (): 'relating' => 'relating';

const clampF = (f: number, lo = 0.4, hi = 2.0) => Math.max(lo, Math.min(hi, f));

export function deriveMandate(gov: IChingResult): AffinityMandate {
  const { volatility, favorability, certainty } = gov.dimensions;
  const themes = gov.themes;
  const globalMult = clampF(
    volatility >= 0 ? 1 + (volatility / 2) * 0.6 : 1 + (volatility / 2) * 0.5,
    0.5, 1.6,
  );
  const g: Partial<Record<AffinityId, number>> = {};
  const ids: AffinityId[] = ['chaos', 'order', 'fate', 'will', 'light', 'shadow'];
  for (const id of ids) g[id] = globalMult;
  const tilt = (id: AffinityId, factor: number) => { g[id] = clampF((g[id] ?? globalMult) * factor); };

  const changeThemes = ['transformation', 'upheaval', 'renewal'];
  const orderThemes = ['stagnation', 'harmony', 'authority'];
  if (themes.some((t) => changeThemes.includes(t))) { tilt('chaos', 1.25); tilt('will', 1.2); tilt('order', 0.8); }
  if (themes.some((t) => orderThemes.includes(t)))  { tilt('order', 1.2); tilt('fate', 1.15); tilt('chaos', 0.85); }
  if (favorability > 0) { tilt('light', 1.15); tilt('shadow', 0.9); }
  else if (favorability < 0) { tilt('shadow', 1.15); tilt('light', 0.9); }
  if (certainty > 0) { tilt('order', 1.1); tilt('light', 1.05); }
  else if (certainty < 0) { tilt('chaos', 1.05); tilt('shadow', 1.1); }

  return { gainMult: g, globalMult, source: `iching:${gov.hexagramNumber}` };
}

// One-time signed nudges applied through shift() before the mandate is set.
export function hexagramNudge(gov: IChingResult): Array<[AffinityId, number]> {
  const { volatility, favorability, certainty } = gov.dimensions;
  const out: Array<[AffinityId, number]> = [];
  if (volatility > 0) out.push(['chaos', Math.round(volatility * 4)]);
  else if (volatility < 0) out.push(['order', Math.round(-volatility * 4)]);
  if (favorability > 0) out.push(['light', Math.round(favorability * 3)]);
  else if (favorability < 0) out.push(['shadow', Math.round(-favorability * 3)]);
  if (certainty > 0) out.push(['order', Math.round(certainty * 2)]);
  else if (certainty < 0) out.push(['shadow', Math.round(-certainty * 2)]);
  return out.filter(([, n]) => n !== 0);
}
