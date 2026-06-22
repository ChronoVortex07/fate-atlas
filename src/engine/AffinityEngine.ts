import type { AffinityId, AffinityBand, AffinityAction, AffinityEffects, Taggable } from './types';
import type { AffinityDefinition } from '../data/affinities';
import {
  AFFINITY_IDS,
  AFFINITY_PAIRS,
  BASELINE,
  BAND_ORDER,
  bandOf,
  bandIndex,
  REACH_UP_CHANCE,
  COUPLING_OPPOSITE,
  COUPLING_OTHER,
  DR_STEP,
  DR_FLOOR,
  JITTER_MIN,
  JITTER_MAX,
  RUN_DRIFT,
  FEED_PER_MATCH,
  FEED_PER_ACTION,
  SECONDARY_FEED_FACTOR,
  ACTION_FEEDS,
} from '../data/affinities';

export class AffinityEngine {
  private state: Record<AffinityId, number>;
  private feedsThisRun: Record<AffinityId, number>;
  private peeksThisRun = 0;
  private peekLocked = false;
  private definitions: AffinityDefinition[];
  private defById: Record<string, AffinityDefinition>;

  constructor(definitions: AffinityDefinition[]) {
    this.definitions = definitions;
    this.defById = {};
    this.state = {} as Record<AffinityId, number>;
    this.feedsThisRun = {} as Record<AffinityId, number>;
    for (const id of AFFINITY_IDS) {
      this.state[id] = BASELINE;
      this.feedsThisRun[id] = 0;
    }
    for (const def of definitions) this.defById[def.id] = def;
  }

  // ── The single mutation chokepoint ──
  // Returns the realized delta actually applied to `id` (signed).
  shift(id: AffinityId, baseDelta: number, _sourceId: string): number {
    if (baseDelta === 0) return 0;

    // Penalty: direct subtraction, no fan-out.
    if (baseDelta < 0) {
      this.state[id] = this.clamp(this.state[id] + baseDelta);
      return baseDelta;
    }

    // Gain: diminishing returns → jitter → apply → coupling fan-out.
    const dr = Math.max(DR_FLOOR, 1 - DR_STEP * this.feedsThisRun[id]);
    this.feedsThisRun[id] += 1;
    const jitter = JITTER_MIN + Math.random() * (JITTER_MAX - JITTER_MIN);
    const gain = baseDelta * dr * jitter;

    this.state[id] = this.clamp(this.state[id] + gain);

    const opp = AFFINITY_PAIRS[id];
    this.state[opp] = this.clamp(this.state[opp] - gain * COUPLING_OPPOSITE);
    for (const other of AFFINITY_IDS) {
      if (other === id || other === opp) continue;
      this.state[other] = this.clamp(this.state[other] - gain * COUPLING_OTHER);
    }
    return gain;
  }

  // Result tags → Chaos/Order feeds (the only tag-driven feeds in Phase 1).
  applyResultTags(result: Taggable): void {
    for (const def of this.definitions) {
      if (def.feeds.tags.length === 0) continue;
      const matches = def.feeds.tags.filter((t) => result.tags.includes(t)).length;
      if (matches > 0) this.shift(def.id, matches * FEED_PER_MATCH, `result:${def.id}`);
    }
  }

  // Player-action feeds → Fate/Will/Light/Shadow (and Chaos as a secondary).
  applyAction(action: AffinityAction): void {
    const feed = ACTION_FEEDS[action];
    if (!feed) return;
    this.shift(feed.primary, FEED_PER_ACTION, `action:${action}`);
    if (feed.secondary) {
      this.shift(feed.secondary, FEED_PER_ACTION * SECONDARY_FEED_FACTOR, `action:${action}`);
    }
  }

  // ── Peek (Light-only foresight) ──
  peekAvailable(): boolean {
    if (this.peekLocked) return false;
    return BAND_ORDER.indexOf(bandOf(this.state.light)) >= BAND_ORDER.indexOf('ascendant');
  }

  // Resolves a peek attempt: escalating fail chance, lockout + Light penalty on failure,
  // a small Light feed on success. Caller supplies the player-facing leaning text.
  usePeek(): { failed: boolean } {
    const failChance = Math.min(0.9, 0.18 * this.peeksThisRun);
    this.peeksThisRun += 1;
    if (Math.random() < failChance) {
      this.peekLocked = true;
      this.shift('light', -12, 'peek-fail'); // direct subtraction, no fan-out
      return { failed: true };
    }
    this.applyAction('use-peek'); // seeking clarity feeds Light
    return { failed: false };
  }

  // Static, band-derived modifiers (no per-event roll). Carried in the snapshot.
  getEffects(): AffinityEffects {
    const willIdx   = bandIndex(bandOf(this.state.will));
    const fateIdx   = bandIndex(bandOf(this.state.fate));
    const lightIdx  = bandIndex(bandOf(this.state.light));
    const shadowIdx = bandIndex(bandOf(this.state.shadow));

    const info = lightIdx - shadowIdx; // -3..3
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    let poolPreview: AffinityEffects['poolPreview'] = 'none';
    if (shadowIdx >= 2) poolPreview = 'hidden';
    else if (lightIdx >= 2) poolPreview = 'full';
    else if (lightIdx >= 1 && lightIdx > shadowIdx) poolPreview = 'theme';

    return {
      spreadRedraws: clamp(willIdx - 1, 0, 2),  // latent/stirring 0, ascendant 1, dominant 2
      methodCount: fateIdx >= 2 ? 2 : 3,          // Fate Ascendant+ → fewer methods
      hintClarity: clamp(info, -2, 2),
      readingDetail: clamp(info, -1, 1),
      poolPreview,
      peekAvailable: this.peekAvailable(),
    };
  }

  // Run boundary: drift toward baseline, reset per-run counters. Reshuffle hook.
  beginRun(): void {
    for (const id of AFFINITY_IDS) {
      this.state[id] = this.clamp(this.state[id] + (BASELINE - this.state[id]) * RUN_DRIFT);
      this.feedsThisRun[id] = 0;
    }
    this.peeksThisRun = 0;
    this.peekLocked = false;
  }

  bandOf(id: AffinityId): AffinityBand {
    return bandOf(this.state[id]);
  }

  // Soft reach-up: ~12% chance to act one band higher (never lower, never two up).
  resolveBand(id: AffinityId): AffinityBand {
    const base = bandOf(this.state[id]);
    const idx = BAND_ORDER.indexOf(base);
    if (idx < BAND_ORDER.length - 1 && Math.random() < REACH_UP_CHANCE) {
      return BAND_ORDER[idx + 1];
    }
    return base;
  }

  // Top 1–2 forces only, keyed to each one's current band hint pool.
  // Light (clarity >= 2) names the force; Shadow (clarity <= -2) renders it opaque.
  getActiveHints(max = 2, clarity = 0): string[] {
    const sorted = [...AFFINITY_IDS].sort((a, b) => this.state[b] - this.state[a]);
    const hints: string[] = [];
    for (const id of sorted.slice(0, max)) {
      const base = this.getHint(id);
      if (!base) continue;
      if (clarity >= 2) hints.push(`${this.defById[id]?.name ?? id}: ${base}`);
      else if (clarity <= -2) hints.push('…');
      else hints.push(base);
    }
    return hints;
  }

  getHint(id: AffinityId): string | null {
    const def = this.defById[id];
    if (!def) return null;
    const pool = def.hints[bandOf(this.state[id])];
    if (!pool || pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  getState(): Record<AffinityId, number> {
    return { ...this.state };
  }

  setState(values: Partial<Record<AffinityId, number>>): void {
    for (const [id, val] of Object.entries(values)) {
      if (typeof val === 'number') this.state[id as AffinityId] = this.clamp(val);
    }
  }

  serialize(): string {
    return JSON.stringify(this.state);
  }

  // Migration: any value <= 1 is an old 0–1 figure (×100); missing ids default to baseline.
  loadFrom(json: string): void {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    for (const id of AFFINITY_IDS) {
      const v = parsed[id];
      if (typeof v === 'number') {
        this.state[id] = this.clamp(v <= 1 ? v * 100 : v);
      } else {
        this.state[id] = BASELINE;
      }
    }
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
}
