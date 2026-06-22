import type { EffectReport, DebugConfig } from './events/types';

// ── Affinities ──
export type AffinityId =
  | 'chaos'
  | 'order'
  | 'fate'
  | 'will'
  | 'light'
  | 'shadow';

export type AffinityBand = 'latent' | 'stirring' | 'ascendant' | 'dominant';

export interface AffinityState {
  id: AffinityId;
  value: number; // 0–100
}

// Player actions that feed agency/information affinities (Phase 2/3).
export type AffinityAction =
  | 'reveal-as-drawn'  // accept what's given        → Fate
  | 'keep-roll'        // keep the first roll         → Fate
  | 'decline-reroll'   // decline an offered reroll   → Fate
  | 'reverse'          // assert control (reverse)    → Will (+ Chaos)
  | 'take-reroll'      // take a reroll               → Will
  | 'swap-method'      // swap divination method      → Will
  | 'set-orientation'  // set orientation yourself    → Will
  | 'use-peek'         // seek clarity (foresight)    → Light
  | 'seek-pattern'     // seek the pattern            → Light
  | 'decline-peek'     // embrace the unknown         → Shadow
  | 'embrace-mystery'; // concealment / mystery       → Shadow

// Per-completion context the component reports so the engine can feed affinities.
export interface MinigameMeta {
  revealedAsDrawn?: boolean; // Fate
  reversed?: boolean;        // Will + Chaos
  viaReroll?: boolean;       // Will (player took a reroll to land here)
  peeked?: boolean;          // Light (already fed at peek time; informational)
}

// Static, band-derived modifiers components render directly (no per-event roll).
export interface AffinityEffects {
  handSize: number;       // tarot cards offered (base 3; Will raises)
  methodCount: number;    // methods offered in the pool (base 3; Fate lowers)
  hintClarity: number;    // -2 near-opaque .. 0 normal .. +2 names the forces
  readingDetail: number;  // -1 terse .. 0 normal .. +1 rich
  poolPreview: 'none' | 'theme' | 'full' | 'hidden';
  peekAvailable: boolean; // Light Ascendant+ and not locked out this run
}

// ── Tags ──
export type Tag = string;

export interface Taggable {
  tags: Tag[];
}

// ── Dice roll modifiers ──
export type RollModifier = 'advantage' | 'disadvantage' | 'choice' | 'offer-reroll';
export type RollMode = 'single' | 'advantage' | 'disadvantage' | 'choice';

// ── Question ──
export type QuestionType = 'decision' | 'relationship' | 'future' | 'self';

// ── Divination Methods ──
export type DivinationType = 'tarot' | 'd20' | 'iching' | 'astral' | 'happening';

// ── Thematic Data Layer ──

/** Curated cross-cutting thematic categories. Each result contributes 1-3. */
export type ThemeTag =
  | 'upheaval'
  | 'renewal'
  | 'stagnation'
  | 'illumination'
  | 'harmony'
  | 'conflict'
  | 'transformation'
  | 'mystery'
  | 'authority'
  | 'surrender';

export interface DimensionValues {
  favorability: number;  // -2.0 to +2.0, 0.5 granularity
  certainty: number;     // -2.0 to +2.0, 0.5 granularity
  volatility: number;    // -2.0 to +2.0, 0.5 granularity
}

export type ModifierRole = 'subject' | 'action' | 'effect';

export interface ThematicData {
  themes: ThemeTag[];
  dimensions: DimensionValues;
  modifierRoles: ModifierRole[];
}

// ── Divination Profile (for gap-aware pool steering) ──

export interface DivinationProfile {
  type: DivinationType;
  themeCoverage: 'all' | 'limited';
  themePool: ThemeTag[];
  dimensionStrengths: (keyof DimensionValues)[];
  modifierStrengths: ModifierRole[];
}

// ── Reading Planner Types ──

export interface GapReport {
  themeConfidence: boolean;
  missingDimensions: (keyof DimensionValues)[];
  missingModifiers: ModifierRole[];
}

export interface AggregatedReading {
  dominantTheme: ThemeTag;
  secondaryTheme: ThemeTag | null;
  dimensionProfile: DimensionValues;
  modifierAssignments: Record<ModifierRole, SlotResult[]>;
  hasTension: boolean;
  tensionPair: [ThemeTag, ThemeTag] | null;
}

// ── Narrative Template Types ──

export interface NarrativeTemplates {
  openings: Record<string, string[]>;
  dimensionBands: Record<string, string[]>;
  modifierFrames: Record<string, string[]>;
  closings: Record<string, string[]>;
  tensionPatterns: Record<string, string[]>;
  headlines: Record<string, string[]>;
  fallbacks: {
    noDominantTheme: string[];
    missingModifier: Record<ModifierRole, string[]>;
    singleResult: string[];
  };
}

// ── Divination Results ──
export interface TarotResult extends ThematicData {
  type: 'tarot';
  id: string;
  name: string;
  number: number; // 0-21 for Major Arcana
  orientation: 'upright' | 'reversed';
  symbol: string; // Unicode symbol or emoji
  meaningUpright: string;
  meaningReversed: string;
  tags: Tag[];
}

export interface DiceResult extends ThematicData {
  type: 'd20';
  result: number; // 1-20
  threshold: 'critical-low' | 'low' | 'neutral' | 'high' | 'critical-high';
  interpretation: string;
  tags: Tag[];
}

export interface IChingResult extends ThematicData {
  type: 'iching';
  hexagramNumber: number; // 1-64
  name: string;
  symbol: string; // Unicode hexagram symbol
  judgment: string;
  changingLines: number[]; // 0-6 line indices that are changing
  tags: Tag[];
}

// ── Astromancy Types ──
export type PlanetId = 'sun'|'moon'|'mercury'|'venus'|'mars'|'jupiter'|'saturn'|'uranus'|'neptune'|'pluto'|'north-node'|'south-node';
export type SignId   = 'aries'|'taurus'|'gemini'|'cancer'|'leo'|'virgo'|'libra'|'scorpio'|'sagittarius'|'capricorn'|'aquarius'|'pisces';
export type OmenTag  = 'errant-star' | 'crowned-conjunction' | 'veiled-oracle';
export type AspectName = 'conjunction'|'sextile'|'square'|'trine'|'opposition'|'minor';

export interface AstralCast {
  planet: PlanetId;
  planetHouse: number; // 1..12 — arena (where the Planet die settled)
  sign: SignId;
  signHouse: number;   // 1..12 — used only to derive the aspect
  omens: OmenTag[];
}

export interface AstralResult extends ThematicData {
  type: 'astral';
  id: string;
  name: string;
  symbol: string;
  interpretation: string;
  planet: PlanetId;
  sign: SignId;
  house: number;     // 1..12
  aspect: AspectName;
  tags: Tag[];
  cast: AstralCast;
}

export interface HappeningResult extends ThematicData {
  type: 'happening';
  id: string;
  scene: string; // atmospheric description
  choices: HappeningChoice[];
  tags: Tag[];
}

export interface HappeningChoice {
  text: string; // the cryptic choice text shown to player
  affinityChanges: Partial<Record<AffinityId, number>>;
}

export type DivinationResult = TarotResult | DiceResult | IChingResult | AstralResult;

export type SlotResult = DivinationResult | HappeningResult;

// ── Events ──
export type EventType =
  | 'turn-started'
  | 'question-selected'
  | 'pool-generated'
  | 'slot-drawn'
  | 'slot-revealed'
  | 'interaction-triggered'
  | 'interaction-chain-complete'
  | 'synthesis-complete'
  | 'happening-triggered'
  | 'happening-resolved'
  | 'turn-complete'
  | 'affinity-changed'
  | 'minigame-complete'
  | 'pool-refilled'
  | 'state-loaded';

export interface GameEvent {
  type: EventType;
  timestamp: number;
  data: Record<string, unknown>;
}

// ── Synthesis ──
export interface SynthesisResult {
  headline: string;
  paragraphs: string[];
  tensionNote?: string;
  affinityNote?: string;
}

// ── Run ──
export interface RunRecord {
  id: string;
  timestamp: number;
  question: QuestionType;
  turnResults: SlotResult[];
  effects: EffectReport[];
  synthesis: SynthesisResult;
  happening?: HappeningResult;
  happeningChoice?: number; // index of chosen happening option
}

export interface TarotMinigameState {
  method: 'tarot';
  faceDownCards: TarotResult[];
  chosenIndex: number | null;
  reversed: boolean;
  revealed: boolean;
}

export interface DiceMinigameState {
  method: 'd20';
  result: DiceResult;
  thrown: boolean;
}

export interface IChingMinigameState {
  method: 'iching';
  lines: number[];
  castCount: number;
  result: IChingResult | null;
}

export type MinigameState =
  | TarotMinigameState
  | DiceMinigameState
  | IChingMinigameState;

// ── Engine State ──
export type Screen =
  | 'title'
  | 'question'
  | 'method-select'
  | 'minigame'
  | 'happening'
  | 'interaction'
  | 'result';

export interface GameState {
  screen: Screen;
  affinities: Record<AffinityId, number>;
  questionType: QuestionType | null;
  availableMethods: DivinationType[];
  shroudedMethods: number[];
  selectedMethod: DivinationType | null;
  turnResults: SlotResult[];
  minigamesCompleted: number;
  activeSlotIndex: number | null;
  minigameState: MinigameState | null;
  synthesis: SynthesisResult | null;
  happening: HappeningResult | null;
  selectedHappeningChoice: number | null;
  history: RunRecord[];
  eventLog: GameEvent[];
  debug: boolean;
  affinityEffects: AffinityEffects;
  eventQueue: EffectReport[];
  debugConfig: DebugConfig;
}

// Re-export event-system types for engine consumers.
export type { EffectReport, DebugConfig, PhaseContext, PhaseDraft, TriggerPoint, Responder } from './events/types';
