import type { AggregatedReading, QuestionType, SlotResult } from '../types';
import type { Beat } from './types';
import { READING_FRAGMENTS as F } from '../../data/reading-fragments';
import { favBandOf } from './drawVoice';

type Valence = 'pos' | 'neg' | 'neu';
interface Segment { text: string; valence: Valence; group: 'open' | 'body' | 'tension' }

export interface BuildContext {
  aggregated: AggregatedReading;
  question: QuestionType;
  seed: number;
}

export interface BuiltReading {
  headline: string;
  paragraphs: string[];
  tensionNote?: string;
}

/** Hash inputs into a small non-negative seed used to offset rotation. */
export function seedFor(agg: AggregatedReading, question: QuestionType, results: SlotResult[]): number {
  const first = results[0] as { name?: string; type?: string } | undefined;
  const name = first ? first.name ?? first.type ?? 'x' : 'none';
  const key = `${agg.dominantTheme}|${favBandOf(agg.dimensionProfile.favorability)}|${question}|${name}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function capPunct(s: string): string {
  const t = s.trim();
  if (!t) return '';
  const capped = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?…—]$/.test(capped) ? capped : `${capped}.`;
}

/** Combine raw clauses into one capitalized, terminated sentence; drops empties. */
export function joinClauses(clauses: string[]): string {
  const kept = clauses.map((c) => c.trim()).filter((c) => c.length > 0);
  if (kept.length === 0) return '';
  return capPunct(kept.join(' '));
}

function isFlip(a: Valence, b: Valence): boolean {
  return (a === 'pos' && b === 'neg') || (a === 'neg' && b === 'pos');
}

function favValence(favBand: string): Valence {
  return favBand === 'high' ? 'pos' : favBand === 'low' ? 'neg' : 'neu';
}

export class ProseBuilder {
  private rotation: Map<string, number> = new Map();
  private seed = 0;

  resetRotation(): void { this.rotation.clear(); }
  getRotationSnapshot(): Map<string, number> { return new Map(this.rotation); }
  restoreRotation(snapshot: Map<string, number>): void { this.rotation = new Map(snapshot); }

  private pick(key: string, pool: string[]): string {
    if (!pool || pool.length === 0) return '';
    const base = this.rotation.get(key) ?? 0;
    this.rotation.set(key, base + 1);
    return pool[(base + this.seed) % pool.length];
  }

  build(beats: Beat[], ctx: BuildContext): BuiltReading {
    this.seed = ctx.seed;

    const segments: Segment[] = [];
    for (const b of beats) {
      if (b.kind === 'close') continue;
      const seg = this.renderBeat(b);
      if (seg && seg.text.trim()) segments.push(seg);
    }
    // The first beat always opens the reading (honors a cold-open).
    if (segments.length > 0) segments[0].group = 'open';

    const open = segments.filter((s) => s.group === 'open');
    const body = segments.filter((s) => s.group === 'body');
    const tension = segments.filter((s) => s.group === 'tension');

    const paragraphs: string[] = [];
    const push = (p: string) => { if (p.trim()) paragraphs.push(p); };

    push(this.stitch(open));
    if (body.length <= 2) {
      push(this.stitch(body));
    } else {
      const mid = Math.ceil(body.length / 2);
      push(this.stitch(body.slice(0, mid)));
      push(this.stitch(body.slice(mid)));
    }

    // Tension surfaces only through tensionNote (rendered in a dedicated box),
    // never duplicated as a body paragraph.
    let tensionNote: string | undefined;
    if (tension.length > 0) {
      const t = this.stitch(tension);
      if (t.trim()) tensionNote = t;
    }

    const closeBeat = beats.find((b) => b.kind === 'close');
    if (closeBeat && closeBeat.kind === 'close') {
      const openerIsTheme = beats[0]?.kind === 'theme';
      push(this.renderClose(closeBeat, openerIsTheme));
    }

    return { headline: this.headline(ctx.aggregated), paragraphs, tensionNote };
  }

  private headline(agg: AggregatedReading): string {
    const favBand = favBandOf(agg.dimensionProfile.favorability);
    const pool = F.headlines[`${agg.dominantTheme}_${favBand}`];
    return pool && pool.length > 0
      ? this.pick(`headline_${agg.dominantTheme}_${favBand}`, pool)
      : 'The Threads of Fate Unspool…';
  }

  private renderBeat(beat: Beat): Segment | null {
    switch (beat.kind) {
      case 'theme': {
        const pool = F.themeMoods[beat.theme] ?? F.noDominantTheme;
        return { text: this.pick(`theme_${beat.theme}`, pool), valence: favValence(beat.favBand), group: 'open' };
      }
      case 'fortune':
        return { text: this.pick(`fortune_${beat.favBand}`, F.fortune[beat.favBand]), valence: favValence(beat.favBand), group: 'open' };
      case 'temper': {
        const k = `${beat.axis}_${beat.band}`;
        return { text: this.pick(`temper_${k}`, F.temper[k] ?? []), valence: 'neu', group: 'open' };
      }
      case 'force':
        return { text: this.renderForce(beat), valence: 'neu', group: 'body' };
      case 'positions': {
        const parts = beat.entries.map((e) => {
          const pos = e.position.charAt(0).toUpperCase() + e.position.slice(1);
          return `the ${pos} ${F.positionLeans[e.lean]}`;
        });
        return { text: parts.join(', '), valence: 'neu', group: 'body' };
      }
      case 'opposition': {
        // Labels stay lower-cased; capPunct fixes the sentence start as needed.
        const t = this.pick('opposition', F.opposition)
          .replace('{favor}', beat.favPole.label)
          .replace('{adverse}', beat.advPole.label);
        return { text: t, valence: 'neu', group: 'tension' };
      }
      case 'tensionPair': {
        const key = [...beat.pair].sort().join('_');
        const pool = F.tensionPairs[key];
        if (pool && pool.length > 0) {
          return { text: this.pick(`tension_${key}`, pool), valence: 'neu', group: 'tension' };
        }
        const t = this.pick('tension_variance', F.tensionVariance)
          .replace('{a}', beat.pair[0])
          .replace('{b}', beat.pair[1]);
        return { text: t, valence: 'neu', group: 'tension' };
      }
      default:
        return null;
    }
  }

  private renderForce(beat: Extract<Beat, { kind: 'force' }>): string {
    const lead = this.pick(`lead_${beat.role}`, F.drawLeadIns[beat.role]);
    const drawTexts = beat.draws.map((d) => `${d.subject} ${d.clause}`);
    let body = drawTexts[0] ?? '';
    for (let i = 1; i < drawTexts.length; i++) {
      const conn = this.pick('conn_additive', F.connectives.additive);
      body = `${body}${conn}${lowerFirst(drawTexts[i])}`;
    }
    return lead ? `${lead} ${body}` : body;
  }

  private renderClose(beat: Extract<Beat, { kind: 'close' }>, openerIsTheme: boolean): string {
    if (beat.carryForce) {
      return capPunct(this.pick('close_carry', F.closes.carry).replace('{carry}', beat.carryForce));
    }
    if (openerIsTheme) {
      return capPunct(this.pick('close_plain', F.closes.plain));
    }
    if (this.seed % 2 === 0) {
      const pool = F.closes.byQuestion[beat.question] ?? F.closes.plain;
      return capPunct(this.pick(`close_q_${beat.question}`, pool).replace('{theme}', beat.theme));
    }
    return capPunct(this.pick('close_plain', F.closes.plain));
  }

  /** Stitch segments into one paragraph, joining with connectives or breaks. */
  private stitch(segs: Segment[]): string {
    if (segs.length === 0) return '';
    const sentences: string[] = [];
    let cur = segs[0].text.trim();
    let run = 1;
    for (let i = 1; i < segs.length; i++) {
      const flip = isFlip(segs[i - 1].valence, segs[i].valence);
      const breakHere = run >= 3 || (!flip && (this.seed + i) % 3 === 0);
      if (breakHere) {
        sentences.push(cur);
        cur = segs[i].text.trim();
        run = 1;
      } else {
        const conn = flip
          ? this.pick('conn_contrast', F.connectives.contrast)
          : this.pick('conn_additive', F.connectives.additive);
        cur = `${cur}${conn}${lowerFirst(segs[i].text.trim())}`;
        run++;
      }
    }
    sentences.push(cur);
    return sentences.map(capPunct).join(' ');
  }
}
