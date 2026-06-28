import type {
  AggregatedReading, SlotResult, QuestionType, ModifierRole, AffinityEffects,
} from '../types';
import type { Beat, FavBand, DrawVoice } from './types';
import { favBandOf } from './drawVoice';
import type { DrawOccurrence } from './voices/types';
import { voiceFor } from './voices/index';
import type { DivinationType } from '../types';

export interface ComposeInput {
  aggregated: AggregatedReading;
  results: SlotResult[];
  question: QuestionType;
  effects?: AffinityEffects;
  seed: number;
}

const ROLE_ORDER: ModifierRole[] = ['subject', 'action', 'effect'];

function polarBand(value: number): 'high' | 'low' | null {
  if (value >= 1.0) return 'high';
  if (value <= -0.9) return 'low';
  return null;
}

function isMultiSpread(r: SlotResult): boolean {
  return r.type === 'tarot' && !!r.spread && r.spread.length > 1;
}

/**
 * Turn an AggregatedReading into an ordered list of typed beats. Decides which
 * beats exist, de-bookends the dominant theme (opener is chosen, not fixed),
 * diverts multi-card spreads to a single positions beat, and honors terse/rich
 * reading detail. Emits no prose.
 */
export class ReadingComposer {
  compose(input: ComposeInput): Beat[] {
    const { aggregated: agg, results, question, effects, seed } = input;
    const favBand: FavBand = favBandOf(agg.dimensionProfile.favorability);
    const terse = (effects?.readingDetail ?? 0) < 0;
    const rich = (effects?.readingDetail ?? 0) > 0;

    // ── Mood beats ──
    const themeBeat: Beat = { kind: 'theme', theme: agg.dominantTheme, secondary: agg.secondaryTheme, favBand };
    const fortuneBeat: Beat = { kind: 'fortune', favBand, strongestFavor: agg.strongestFavor, strongestAdverse: agg.strongestAdverse };
    const temperBeats: Beat[] = [];
    if (!terse) {
      const cb = polarBand(agg.dimensionProfile.certainty);
      if (cb) temperBeats.push({ kind: 'temper', axis: 'certainty', band: cb });
      const vb = polarBand(agg.dimensionProfile.volatility);
      if (vb) temperBeats.push({ kind: 'temper', axis: 'volatility', band: vb });
    }

    // ── Force beats (de-duped: each result narrated in its strongest role) ──
    const rankIn = (role: ModifierRole, r: SlotResult) => agg.modifierAssignments[role].indexOf(r);
    const unique = new Set<SlotResult>();
    for (const role of ROLE_ORDER) for (const r of agg.modifierAssignments[role]) unique.add(r);
    const byRole: Record<ModifierRole, SlotResult[]> = { subject: [], action: [], effect: [] };
    for (const r of unique) {
      const roles = ROLE_ORDER.filter((role) => rankIn(role, r) >= 0);
      let best = roles[0];
      for (const role of roles.slice(1)) if (rankIn(role, r) < rankIn(best, r)) best = role;
      byRole[best].push(r);
    }
    for (const role of ROLE_ORDER) byRole[role].sort((a, b) => rankIn(role, a) - rankIn(role, b));

    // ── Occurrence pass: ordinal of each force-eligible draw among its type ──
    // Narration order = role order, then the sort already applied within each role.
    const narrationOrder: SlotResult[] = [];
    for (const role of ROLE_ORDER) {
      for (const r of byRole[role]) if (!isMultiSpread(r)) narrationOrder.push(r);
    }
    const totals = new Map<DivinationType, number>();
    for (const r of narrationOrder) totals.set(r.type, (totals.get(r.type) ?? 0) + 1);
    const occMap = new Map<SlotResult, DrawOccurrence>();
    const running = new Map<DivinationType, number>();
    for (const r of narrationOrder) {
      const index = running.get(r.type) ?? 0;
      occMap.set(r, { index, total: totals.get(r.type) ?? 1 });
      running.set(r.type, index + 1);
    }

    // ── Force beats: group each role's draws by type; aggregate runs of ≥2 ──
    let forceBeats: Beat[] = [];
    for (const role of ROLE_ORDER) {
      const eligible = byRole[role].filter((r) => !isMultiSpread(r));
      if (eligible.length === 0) continue;
      const groups: SlotResult[][] = [];
      const byType = new Map<DivinationType, SlotResult[]>();
      for (const r of eligible) {
        let g = byType.get(r.type);
        if (!g) { g = []; byType.set(r.type, g); groups.push(g); }
        g.push(r);
      }
      const draws: DrawVoice[] = groups.map((g) => {
        const voice = voiceFor(g[0].type);
        return g.length >= 2
          ? voice.describeGroup(g, role, occMap.get(g[0])!.index)
          : voice.describeOne(g[0], role, occMap.get(g[0])!);
      });
      forceBeats.push({ kind: 'force', role, draws });
    }
    if (terse) forceBeats = forceBeats.slice(0, 1);

    // ── Positions beat (multi-card spreads) ──
    const spreads = [...new Set([...results, ...unique])].filter(isMultiSpread);
    let positionsBeat: Beat | null = null;
    const entries = spreads.flatMap((s) =>
      (s.type === 'tarot' && s.spread ? s.spread : []).map((sp) => {
        const fav = sp.card.dimensions.favorability;
        const lean: 'favor' | 'steady' | 'adverse' = fav >= 0.5 ? 'favor' : fav <= -0.5 ? 'adverse' : 'steady';
        return { position: sp.position, lean };
      }),
    );
    if (entries.length > 0) positionsBeat = { kind: 'positions', entries };

    // ── Tension beats ──
    const fp = agg.strongestFavor, ap = agg.strongestAdverse;
    const polesOppose = !!fp && !!ap && fp.value >= 1 && ap.value <= -1;
    const oppositionBeat: Beat | null = polesOppose ? { kind: 'opposition', favPole: fp!, advPole: ap! } : null;
    const tensionPairBeat: Beat | null = agg.hasTension && agg.tensionPair
      ? { kind: 'tensionPair', pair: agg.tensionPair }
      : null;

    // ── Close beat ──
    const carryForce = rich && forceBeats[0]?.kind === 'force' ? forceBeats[0].draws[0]?.subject ?? null : null;
    const closeBeat: Beat = { kind: 'close', question, theme: agg.dominantTheme, carryForce };

    // ── Opener selection (de-bookending) ──
    const themeWeak = agg.dominantTheme === 'mystery' || favBand === 'neutral';
    const openerKind: 'theme' | 'fortune' | 'opposition' =
      oppositionBeat && themeWeak ? 'opposition'
        : seed % 2 === 0 ? 'theme' : 'fortune';

    // ── Assemble in order ──
    const beats: Beat[] = [];
    if (openerKind === 'opposition') beats.push(oppositionBeat!);
    else if (openerKind === 'theme') beats.push(themeBeat);
    else beats.push(fortuneBeat);

    if (openerKind !== 'theme') beats.push(themeBeat);
    if (openerKind !== 'fortune') beats.push(fortuneBeat);
    beats.push(...temperBeats);
    beats.push(...forceBeats);
    if (positionsBeat) beats.push(positionsBeat);
    if (oppositionBeat && openerKind !== 'opposition') beats.push(oppositionBeat);
    if (tensionPairBeat) beats.push(tensionPairBeat);
    beats.push(closeBeat);

    return beats;
  }
}
