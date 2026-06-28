import type { AffinityId, AffinityBand, AffinityAction, AffinityEffects, Taggable, AffinityMandate, AffinityModifier, TransformPayload } from './types';
import type { AffinityDefinition } from '../data/affinities';
import {
  AFFINITY_IDS,
  AFFINITY_PAIRS,
  AXIS_AFFINITIES,
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
  FORTUNE_TAG_CAP,
} from '../data/affinities';

export class AffinityEngine {
  private base: Record<AffinityId, number>;
  private modifiers: AffinityModifier[] = [];
  private modSeq = 0;
  private feedsThisRun: Record<AffinityId, number>;
  private fortuneTagFeedThisRun = 0;
  private peeksThisRun = 0;
  private peekLocked = false;
  private definitions: AffinityDefinition[];
  private defById: Record<string, AffinityDefinition>;
  private mandate: AffinityMandate | null = null;
  private mandateFresh = false;

  constructor(definitions: AffinityDefinition[]) {
    this.definitions = definitions;
    this.defById = {};
    this.base = {} as Record<AffinityId, number>;
    this.feedsThisRun = {} as Record<AffinityId, number>;
    for (const id of AFFINITY_IDS) {
      this.base[id] = BASELINE;
      this.feedsThisRun[id] = 0;
    }
    for (const def of definitions) this.defById[def.id] = def;
  }

  // ── Mandate of Change ──
  setMandate(m: AffinityMandate): void { this.mandate = m; this.mandateFresh = true; }
  getMandate(): AffinityMandate | null { return this.mandate; }
  clearMandate(): void { this.mandate = null; this.mandateFresh = false; }
  decayMandate(): void {
    if (!this.mandate) return;
    if (this.mandateFresh) { this.mandateFresh = false; return; }
    const toward1 = (f: number) => f + (1 - f) * 0.4;
    this.mandate.globalMult = toward1(this.mandate.globalMult);
    for (const id of Object.keys(this.mandate.gainMult) as AffinityId[]) {
      this.mandate.gainMult[id] = toward1(this.mandate.gainMult[id]!);
    }
  }
  private mandateFactor(id: AffinityId): number {
    if (!this.mandate) return 1;
    return this.mandate.gainMult[id] ?? this.mandate.globalMult;
  }

  // The full effective vector: base + Σ active surge contributions (step-down
  // decayed), then transform modifiers applied IN LIST ORDER (upheaval layer).
  private effectiveVector(): Record<AffinityId, number> {
    const v = {} as Record<AffinityId, number>;
    for (const id of AFFINITY_IDS) {
      let x = this.base[id];
      for (const m of this.modifiers) {
        if (m.kind === 'surge') {
          const factor = m.readingsRemaining / m.initialReadings;
          x += (m.deltas[id] ?? 0) * factor;
        }
      }
      v[id] = this.clamp(x);
    }
    for (const m of this.modifiers) {
      if (m.kind === 'transform') this.applyTransform(v, m);
    }
    return v;
  }

  // Bends the effective vector in place. invert-pair flips one axis's two poles;
  // invert-all flips all six; scramble redistributes by the modifier's fixed permutation.
  private applyTransform(v: Record<AffinityId, number>, m: Extract<AffinityModifier, { kind: 'transform' }>): void {
    if (m.transform === 'invert-all') {
      for (const id of AFFINITY_IDS) v[id] = this.clamp(100 - v[id]);
      return;
    }
    if (m.transform === 'invert-pair') {
      const pair = AXIS_AFFINITIES[m.axis ?? 'fortune'];
      for (const id of pair) v[id] = this.clamp(100 - v[id]);
      return;
    }
    // scramble: result[id] = pre-scramble[ permutation[id] ]
    if (m.permutation) {
      const src = { ...v };
      for (const id of AFFINITY_IDS) v[id] = src[m.permutation[id]];
    }
  }

  // Effective value for one id (delegates to the shared vector).
  private eff(id: AffinityId): number {
    return this.effectiveVector()[id];
  }

  getBase(): Record<AffinityId, number> {
    return { ...this.base };
  }

  // ── Temporary surge layer ──
  grantSurge(deltas: Partial<Record<AffinityId, number>>, readings: number, source: string): void {
    if (readings <= 0) return;
    this.modifiers.push({
      id: `surge:${source}:${this.modSeq++}`,
      kind: 'surge',
      deltas: { ...deltas },
      readingsRemaining: readings,
      initialReadings: readings,
      source,
    });
  }

  // ── Upheaval (transform) layer ──
  grantUpheaval(payload: TransformPayload, readings: number, source: string): void {
    if (readings <= 0) return;
    const mod: Extract<AffinityModifier, { kind: 'transform' }> = {
      id: `transform:${source}:${this.modSeq++}`,
      kind: 'transform',
      transform: payload.transform,
      axis: payload.axis,
      readingsRemaining: readings,
      initialReadings: readings,
      source,
    };
    if (payload.transform === 'scramble') mod.permutation = this.makeScramblePermutation();
    this.modifiers.push(mod);
  }

  hasActiveTransform(): boolean {
    return this.modifiers.some((m) => m.kind === 'transform');
  }

  // Fisher–Yates over the six ids → a fixed mapping result-id → source-id.
  private makeScramblePermutation(): Record<AffinityId, AffinityId> {
    const sources = [...AFFINITY_IDS];
    for (let i = sources.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sources[i], sources[j]] = [sources[j], sources[i]];
    }
    const perm = {} as Record<AffinityId, AffinityId>;
    AFFINITY_IDS.forEach((id, i) => { perm[id] = sources[i]; });
    return perm;
  }

  // Advance every modifier one reading; drop the expired ones. Called once per
  // completed reading by the GameEngine (Task 5).
  tickModifiers(): void {
    for (const m of this.modifiers) m.readingsRemaining -= 1;
    this.modifiers = this.modifiers.filter((m) => m.readingsRemaining > 0);
  }

  clearModifiers(): void {
    this.modifiers = [];
    // The temporary layer and the per-run feed counters are both run-scoped; a full
    // clear (reset paths) zeroes them together so the Fortune cap / diminishing-returns
    // state can't leak across a reset that doesn't pass back through beginRun().
    this.fortuneTagFeedThisRun = 0;
    for (const id of AFFINITY_IDS) this.feedsThisRun[id] = 0;
  }

  getModifiers(): AffinityModifier[] {
    return this.modifiers.map((m) =>
      m.kind === 'surge'
        ? { ...m, deltas: { ...m.deltas } }
        : { ...m, permutation: m.permutation ? { ...m.permutation } : undefined },
    );
  }

  // ── The single mutation chokepoint ──
  // Returns the realized delta actually applied to `id` (signed).
  shift(id: AffinityId, baseDelta: number, _sourceId: string): number {
    if (baseDelta === 0) return 0;
    baseDelta *= this.mandateFactor(id);  // mandate scales both gains AND penalties

    // Penalty: direct subtraction, no fan-out.
    if (baseDelta < 0) {
      this.base[id] = this.clamp(this.base[id] + baseDelta);
      return baseDelta;
    }

    // Gain: diminishing returns → jitter → apply → coupling fan-out.
    const dr = Math.max(DR_FLOOR, 1 - DR_STEP * this.feedsThisRun[id]);
    this.feedsThisRun[id] += 1;
    const jitter = JITTER_MIN + Math.random() * (JITTER_MAX - JITTER_MIN);
    const gain = baseDelta * dr * jitter;

    this.base[id] = this.clamp(this.base[id] + gain);

    const opp = AFFINITY_PAIRS[id];
    this.base[opp] = this.clamp(this.base[opp] - gain * COUPLING_OPPOSITE);
    for (const other of AFFINITY_IDS) {
      if (other === id || other === opp) continue;
      this.base[other] = this.clamp(this.base[other] - gain * COUPLING_OTHER);
    }
    return gain;
  }

  // Result tags → Chaos/Order feeds (the only tag-driven feeds in Phase 1).
  applyResultTags(result: Taggable): void {
    for (const def of this.definitions) {
      if (def.feeds.tags.length === 0) continue;
      const matches = def.feeds.tags.filter((t) => result.tags.includes(t)).length;
      if (matches > 0) this.feedFortuneTag(def.id, matches * FEED_PER_MATCH, `result:${def.id}`);
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

  // Capped entry point for Fortune (Chaos/Order) tag + coherence feeds. Bounds how
  // much passive RNG outcomes can move Fortune per run; behavior feeds (applyAction)
  // bypass this cap. Non-Fortune ids fall back to a plain shift. Returns realized gain.
  feedFortuneTag(id: AffinityId, amount: number, source: string): number {
    if (id !== 'chaos' && id !== 'order') return this.shift(id, amount, source);
    const remaining = Math.max(0, FORTUNE_TAG_CAP - this.fortuneTagFeedThisRun);
    const allowed = Math.min(amount, remaining);
    if (allowed <= 0) return 0;
    this.fortuneTagFeedThisRun += allowed;
    return this.shift(id, allowed, source);
  }

  // ── Peek (Light-only foresight) ──
  peekAvailable(): boolean {
    if (this.peekLocked) return false;
    return BAND_ORDER.indexOf(bandOf(this.eff('light'))) >= BAND_ORDER.indexOf('ascendant');
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
    const willIdx   = bandIndex(bandOf(this.eff('will')));
    const lightIdx  = bandIndex(bandOf(this.eff('light')));
    const shadowIdx = bandIndex(bandOf(this.eff('shadow')));

    const info = lightIdx - shadowIdx; // -3..3
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    let poolPreview: AffinityEffects['poolPreview'] = 'none';
    if (shadowIdx >= 2) poolPreview = 'hidden';
    else if (lightIdx >= 2) poolPreview = 'full';
    else if (lightIdx >= 1 && lightIdx > shadowIdx) poolPreview = 'theme';

    return {
      spreadRedraws: clamp(willIdx - 1, 0, 2),  // latent/stirring 0, ascendant 1, dominant 2
      // Pool size is always 3 here; Will/Fate shift it only probabilistically at
      // draw time (will-widen-pool / fate-thin-pool responders), not statically.
      methodCount: 3,
      hintClarity: clamp(info, -2, 2),
      readingDetail: clamp(info, -1, 1),
      poolPreview,
      peekAvailable: this.peekAvailable(),
    };
  }

  // Run boundary: drift toward baseline, reset per-run counters. Reshuffle hook.
  beginRun(): void {
    for (const id of AFFINITY_IDS) {
      this.base[id] = this.clamp(this.base[id] + (BASELINE - this.base[id]) * RUN_DRIFT);
      this.feedsThisRun[id] = 0;
    }
    this.peeksThisRun = 0;
    this.peekLocked = false;
    this.fortuneTagFeedThisRun = 0;
    this.clearMandate();
    // NOTE: modifiers are intentionally NOT cleared here — surges decay per reading
    // and survive turn boundaries within a session.
  }

  bandOf(id: AffinityId): AffinityBand {
    return bandOf(this.eff(id));
  }

  // Soft reach-up: ~12% chance to act one band higher (never lower, never two up).
  resolveBand(id: AffinityId): AffinityBand {
    const cur = bandOf(this.eff(id));
    const idx = BAND_ORDER.indexOf(cur);
    if (idx < BAND_ORDER.length - 1 && Math.random() < REACH_UP_CHANCE) {
      return BAND_ORDER[idx + 1];
    }
    return cur;
  }

  // Top 1–2 forces only, keyed to each one's current band hint pool.
  // Light (clarity >= 2) names the force; Shadow (clarity <= -2) renders it opaque.
  getActiveHints(max = 2, clarity = 0): string[] {
    const sorted = [...AFFINITY_IDS].sort((a, b) => this.eff(b) - this.eff(a));
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
    const pool = def.hints[bandOf(this.eff(id))];
    if (!pool || pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  getState(): Record<AffinityId, number> {
    return this.effectiveVector();
  }

  setState(values: Partial<Record<AffinityId, number>>): void {
    for (const [id, val] of Object.entries(values)) {
      if (typeof val === 'number') this.base[id as AffinityId] = this.clamp(val);
    }
  }

  serialize(): string {
    return JSON.stringify(this.base);
  }

  // Migration: any value <= 1 is an old 0–1 figure (×100); missing ids default to baseline.
  loadFrom(json: string): void {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    for (const id of AFFINITY_IDS) {
      const v = parsed[id];
      if (typeof v === 'number') {
        this.base[id] = this.clamp(v <= 1 ? v * 100 : v);
      } else {
        this.base[id] = BASELINE;
      }
    }
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
}
