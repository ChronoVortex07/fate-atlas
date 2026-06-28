import type { EffectReport, DebugConfig } from './events/types';

// ── Affinities ──
export type AffinityId =
  | 'chaos'
  | 'order'
  | 'fate'
  | 'will'
  | 'light'
  | 'shadow';

export interface AffinityMandate {
  gainMult: Partial<Record<AffinityId, number>>; // per-affinity factor
  globalMult: number;                            // factor for ids absent from gainMult
  source: string;
}

// A run-scoped temporary modifier on the affinity reading. Phase 1 defines the
// additive `surge`; Phase 3 will extend the union with an upheaval `transform`.
export interface AffinitySurgeModifier {
  id: string;
  kind: 'surge';
  deltas: Partial<Record<AffinityId, number>>;
  readingsRemaining: number;
  initialReadings: number;
  source: string;
}

// Phase 3: a transform upheaval modifier — bends EFFECTIVE values (after surges)
// for a fixed number of readings, then expires as a cliff. `scramble` stores its
// permutation, fixed at creation, so repeated effective reads stay stable.
export interface AffinityTransformModifier {
  id: string;
  kind: 'transform';
  transform: 'invert-pair' | 'invert-all' | 'scramble';
  axis?: AffinityAxis;                                  // required for 'invert-pair'
  permutation?: Record<AffinityId, AffinityId>;         // 'scramble' only: result[id] = preVector[permutation[id]]
  readingsRemaining: number;
  initialReadings: number;
  source: string;                                       // e.g. 'happening:falling-star' / 'emergent:chaos'
}

export type AffinityModifier = AffinitySurgeModifier | AffinityTransformModifier;

export type AffinityBand = 'latent' | 'stirring' | 'ascendant' | 'dominant';

// ── Corruption (a predator from beyond the six affinities; not an AffinityId) ──
export type CorruptionBand = 'dormant' | 'seeded' | 'spreading' | 'virulent' | 'pinnacle';

export interface CorruptionSnapshot {
  value: number;       // 0–100 scalar
  band: CorruptionBand;
}

// Light's read on corruption. Null when Light cannot perceive a predator.
export interface CorruptionWarning {
  present: boolean;   // a predator is sensed
  tainted: boolean;   // the warning itself is corrupted (terminal lucidity, virulent+)
  methods: number[];  // indices of methods named as tainted (empty unless Light is Dominant)
  text: string;       // diegetic flavor line for the UI
}

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
  spreadRedraws: number;  // disliked spread positions the player may redraw (Will)
  methodCount: number;    // base methods in the pool (always 3; Will/Fate shift it probabilistically at draw time)
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
export type DivinationType = 'tarot' | 'd20' | 'iching' | 'astral' | 'rune' | 'strings' | 'happening';

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

// ── Tarot Spread Types ──

export type SpreadPosition = 'past' | 'present' | 'future';

export interface TarotCardFace {
  id: string;
  name: string;
  arcana: 'major' | 'minor';
  suit?: 'wands' | 'cups' | 'swords' | 'pentacles';
  rank?: number | 'page' | 'knight' | 'queen' | 'king';
  number?: number;
  orientation: 'upright' | 'reversed';
  symbol: string;
  themes: ThemeTag[];
  dimensions: DimensionValues;
  modifierRoles: ModifierRole[];
  meaningUpright: string;
  meaningReversed: string;
  archetypeTag?: string;
  veiled?: boolean;
  tags: Tag[];
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
  strongestFavor: { label: string; value: number } | null;
  strongestAdverse: { label: string; value: number } | null;
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
  spread?: { position: SpreadPosition; card: TarotCardFace }[];
}

// Five outcome tiers shared by the dice dataset and the skill-check breakdown.
export type Threshold = 'critical-low' | 'low' | 'neutral' | 'high' | 'critical-high';

// Skill-check plan: the Difficulty Class and Bless/Bane d4 counts derived from
// the prior reading. Produced by planDiceCheck, threaded to resolveDiceCheck.
export interface DiceCheckPlan {
  dc: number;          // clamped [5, 17]
  bless: number;       // count of +d4 (0..1 in v1)
  bane: number;        // count of -d4 (0..1 in v1)
  sources: string[];   // human-readable reasons (UI marquee)
}

// Resolved check: the rolled d4 values, the total, and the relative tier.
export interface DiceCheckBreakdown {
  d20: number;                          // the kept natural d20 (1..20)
  bless: number[];                      // rolled d4 values added (each 1..4)
  bane: number[];                       // rolled d4 values subtracted (each 1..4)
  dc: number;
  total: number;                        // d20 + sum(bless) - sum(bane)
  margin: number;                       // total - dc
  tier: Threshold;                      // RELATIVE tier (one of the five)
  critical: 'triumph' | 'fumble' | null;
}

export interface DiceResult extends ThematicData {
  type: 'd20';
  result: number; // 1-20 (the natural kept d20)
  threshold: Threshold;
  interpretation: string;
  tags: Tag[];
  check?: DiceCheckBreakdown; // present for skill-check results
}

export type LineValue = 6 | 7 | 8 | 9; // 6 old-yin, 7 young-yang, 8 young-yin, 9 old-yang

export interface HexagramCast {
  lines: LineValue[];        // length 6, bottom→top
  primaryNumber: number;     // 1..64
  relatingNumber: number;    // 1..64 (== primaryNumber when no changing lines)
  changingLines: number[];   // 1..6
}

export interface IChingResult extends ThematicData {
  type: 'iching';
  hexagramNumber: number; // 1-64
  name: string;
  symbol: string; // Unicode hexagram symbol
  judgment: string;
  changingLines: number[]; // 0-6 line indices that are changing
  tags: Tag[];
  governing?: 'primary' | 'relating';
  relatingNumber?: number;
  relatingName?: string;
  relatingSymbol?: string;
  cast?: HexagramCast;
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

// ── Rune Types ──
export type RuneId =
  | 'fehu'|'uruz'|'thurisaz'|'ansuz'|'raidho'|'kenaz'|'gebo'|'wunjo'
  | 'hagalaz'|'nauthiz'|'isa'|'jera'|'eihwaz'|'perthro'|'algiz'|'sowilo'
  | 'tiwaz'|'berkano'|'ehwaz'|'mannaz'|'laguz'|'ingwaz'|'othala'|'dagaz';
export type RuneAett = 'freyr' | 'heimdall' | 'tyr';
export type RuneOrientation = 'upright' | 'merkstave';
export type RuneRing = 'heart' | 'field' | 'margin';
export type RuneOmenTag = 'bindrune' | 'merkstave-cascade' | 'true-cast' | 'silent-field' | 'errant-rune';

export interface LandedRune {
  rune: RuneId;
  faceUp: boolean;              // false = silent (face-down)
  orientation: RuneOrientation; // meaningful only when faceUp
  ring: RuneRing;               // derived from distance to center
  x: number; y: number;         // normalized cloth coords (~[-1,1]); proximity + render
}

export interface RuneScatter {
  stones: LandedRune[];   // length = cast size (6)
  governingIndex: number; // index into stones — the read governing stone
  omens: RuneOmenTag[];
}

export interface RuneResult extends ThematicData {
  type: 'rune';
  id: string;
  name: string;
  symbol: string;        // governing rune glyph
  rune: RuneId;
  orientation: RuneOrientation;
  ring: RuneRing;
  interpretation: string;
  tags: Tag[];
  scatter: RuneScatter;
}

// ── Strings of Fate ──
export type ConceptBandKind = 'origin' | 'crossing' | 'destination';
export type ConceptFamily = 'benevolent' | 'challenging' | 'neutral';

/** A node placed in a generated weave. */
export interface WovenNode {
  id: string;          // unique within a weave, e.g. 'b1-2'
  conceptId: string;   // key into CONCEPTS
  band: number;        // 0 = origin … bandCount-1 = destination
  family: ConceptFamily;
  x: number; y: number; // normalized radial-bloom coords for render
}
export interface WovenEdge { from: string; to: string; } // adjacent bands only

export interface WeaveGraph {
  nodes: WovenNode[];
  edges: WovenEdge[];
  originId: string;
  bandCount: number;
}

/** Affinity-derived levers, resolved once by planWeave(). */
export interface WeavePlan {
  bandCount: number;     // 4 base; Chaos dominant → 5
  width: number;         // pickable candidates per step (base 3; Fate −1 floor 2; Will +1)
  finalWidth: number;    // forks into the destination band (base 1; Will ascendant 2, dominant 3)
  veil: number;          // candidates shown but unpickable (Shadow ascendant 1, dominant 2)
  clarity: 'silhouette' | 'mood' | 'themes' | 'laid-bare';
  lookAhead: number;     // bands of silhouette look-ahead (Light)
  backtracks: number;    // Will: ascendant 1, dominant 2
  allowRedraw: boolean;  // Will dominant
  offerRethread: boolean;// Will stirring+ (UI surfaces a one-time prompt)
  extremeBias: number;   // signed chaosIdx − orderIdx (−3..+3)
  crossingDensity: number; // forward edges per node (2..4)
  foresight: boolean;    // Light ascendant+ — fully un-veil one candidate
  sources: string[];     // human-readable active levers (debug/flavor)
}

export interface StringsMinigameState {
  method: 'strings';
  graph: WeaveGraph;
  plan: WeavePlan;
  visitedPath: string[];        // ordered node ids, [originId, …]
  activeId: string;             // last of visitedPath
  candidateIds: string[];       // pickable revealed neighbors of active
  veiledCandidateIds: string[]; // revealed-but-veiled (Shadow) — visible, unpickable
  lookAheadIds: string[];       // silhouettes one+ band beyond (Light)
  revealedIds: string[];        // every node ever un-fogged
  foresightId: string | null;   // candidate fully un-veiled this step (Light)
  backtracksRemaining: number;
  redrawUsed: boolean;
  phase: 'drawing' | 'arrived';
  committed: boolean;           // true once commitWeave() has consolidated the path (guards re-commit)
}

export interface StringsResult extends ThematicData {
  type: 'strings';
  id: string;            // `strings:<destinationConceptId>`
  name: string;          // path name, joined ' · '
  symbol: string;        // destination glyph
  interpretation: string;
  path: WovenNode[];     // ordered origin→destination
  destinationId: string;
  tags: Tag[];
}

// ── Happening effects (Phase 2) ──
export type AffinityAxis = 'agency' | 'information' | 'fortune';

// Queued flags a happening grants to the NEXT reading; each maps onto existing
// draft/peek vocabulary consumed at that reading's dispatch trigger (no new engine).
export type ReadingEffectId =
  | 'widen-pool'     // next draw: +1 method offered (cf. will-widen-pool)
  | 'guarantee-peek' // next reading: peek gate forced open for one reading
  | 'deny-peek'      // next reading: peek gate forced shut for one reading
  | 'grant-reroll'   // next dice reading: offer a reroll (cf. will-offer-reroll)
  | 'spawn-second'   // next reading commit: spawn a second result (cf. chaos-second-result)
  | 'shroud-card';   // next draw: shroud one method (cf. shadow-shroud)

// Phase 3 applies these to EFFECTIVE values via the unified modifier list. Phase 2
// only carries the data; resolution is a no-op stub.
export type TransformPayload = {
  transform: 'invert-pair' | 'invert-all' | 'scramble';
  axis?: AffinityAxis;
};

export type HappeningEffect =
  | { kind: 'shift';    affinity: AffinityId; amount: number }                              // permanent nudge
  | { kind: 'surge';    deltas: Partial<Record<AffinityId, number>>; readings: number }     // decaying temporary spike
  | { kind: 'reading';  effect: ReadingEffectId }                                           // modify the next reading(s)
  | { kind: 'cost';     affinity: AffinityId; amount: number }                              // positive magnitude, applied as a drain
  | { kind: 'gamble';   outcomes: { weight: number; effects: HappeningEffect[] }[] }        // weighted branch
  | { kind: 'upheaval'; transform: TransformPayload; readings: number };                    // Phase 3 (no-op stub in Phase 2)

export interface HappeningChoice {
  text: string;                 // the cryptic choice text shown to the player
  effects: HappeningEffect[];   // one or more effects applied on choosing
}

export interface HappeningResult extends ThematicData {
  type: 'happening';
  id: string;
  scene: string; // atmospheric description
  choices: HappeningChoice[];
  tags: Tag[];
}

export type DivinationResult = TarotResult | DiceResult | IChingResult | AstralResult | RuneResult | StringsResult;

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
  | 'state-loaded'
  | 'corruption-ruptured';

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

// ── Tarot Draft State (card-drafting minigame) ──

export interface TableCard {
  cardId: string;        // key into DECK_BY_ID
  originIndex: number;   // stable position on table (for return-to-position)
  faceUp: boolean;       // true if returned from hand after being peeked
  revealedFace?: TarotCardFace; // set when faceUp — the built face with orientation
}

export interface HandCard {
  cardId: string;
  tableOriginIndex: number; // so returnToTable puts it back in the right spot
  peeked: boolean;
  revealedFace?: TarotCardFace; // set after successful peek — shows orientation
  fated?: boolean; // immutable when true — locked into slot by fate
}

export type HandSlot = HandCard | null; // hand[0]=Past, [1]=Present, [2]=Future

export interface TarotDraftState {
  method: 'tarot';
  deck: string[];              // remaining card IDs (shuffled), face-down
  table: (TableCard | null)[]; // dealt spread; null where a card was picked
  hand: [HandSlot, HandSlot, HandSlot];
  dealCount: number;           // current number of table slots (starts 9, grows with returns)
  shufflesRemaining: number;   // from affinityEffects.spreadRedraws
  phase: 'drafting' | 'committing';
  fatedDrawnThisDraft?: boolean; // once-per-draft gate for fate-fated-card
  // Reveal-time markers recorded by commitDraft for the inline reveal animations.
  revealSwap?: { index: number; fromCardId: string }; // fate-deal-swap
  revealWildCard?: number;                              // chaos-wild-card (flipped slot)
  revealOrderAnchored?: boolean;                        // order-anchor (straightened all)
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
  | TarotDraftState
  | DiceMinigameState
  | IChingMinigameState
  | StringsMinigameState;

// ── Draw Phase (card-draw method selection) ──

/** A selection in flight, awaiting the card-draw UI to finish animating before
 *  the screen transitions to the minigame. Set by beginSelection(). */
export interface PendingSelection {
  chosenIndex: number;            // index in availableMethods the player clicked
  finalIndex: number;             // index actually selected (Fate may redirect)
  method: DivinationType;         // availableMethods[finalIndex]
  wasForced: boolean;             // true when finalIndex !== chosenIndex (Fate force)
  shrouded: boolean;              // finalIndex was shrouded → play the reveal
  forceReport: EffectReport | null; // fate-force-method report, for overlay text
}

/** Snapshot of the current method-select draw, consumed by MethodSelect. The
 *  pool/shroud themselves remain on GameState.availableMethods/shroudedMethods;
 *  this carries the ordered pre-selection effect reports (diverted from the
 *  generic eventQueue) plus any in-flight selection. */
export interface DrawPhase {
  nonce: number;                  // bumps on each (re)deal — keys the UI deal/sequence
  effectReports: EffectReport[];  // ordered widen/thin/shroud reports to narrate
  pendingSelection: PendingSelection | null;
}

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
  affinities: Record<AffinityId, number>;     // effective (base + surges)
  affinityBase: Record<AffinityId, number>;   // permanent base only (for surge transparency/debug)
  corruption: CorruptionSnapshot;
  corruptionWarning: CorruptionWarning | null;
  forbiddenSightAvailable: boolean; // corruption Virulent+ — the watching eye may be summoned
  questionType: QuestionType | null;
  availableMethods: DivinationType[];
  shroudedMethods: number[];
  infectedMethods: number[]; // indices of offered methods tainted by corruption (parallels shroudedMethods)
  drawPhase: DrawPhase | null;
  selectedMethod: DivinationType | null;
  turnResults: SlotResult[];
  minigamesCompleted: number;
  activeSlotIndex: number | null;
  minigameState: MinigameState | null;
  synthesis: SynthesisResult | null;
  happening: HappeningResult | null;
  selectedHappeningChoice: number | null;
  pendingReadingEffects: ReadingEffectId[]; // queued by happenings, consumed by the next reading (turn-scoped)
  history: RunRecord[];
  eventLog: GameEvent[];
  debug: boolean;
  awaitingContinue: boolean;
  affinityEffects: AffinityEffects;
  eventQueue: EffectReport[];
  debugConfig: DebugConfig;
}

// Re-export event-system types for engine consumers.
export type { EffectReport, DebugConfig, PhaseContext, PhaseDraft, TriggerPoint, Responder } from './events/types';
