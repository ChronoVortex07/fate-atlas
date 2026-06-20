// ── Affinities ──
export type AffinityId = 'chaos' | 'order';

export interface AffinityState {
  id: AffinityId;
  value: number; // 0.0–1.0
}

// ── Tags ──
export type Tag = string;

export interface Taggable {
  tags: Tag[];
}

// ── Question ──
export type QuestionType = 'decision' | 'relationship' | 'future' | 'self';

// ── Divination Methods ──
export type DivinationType = 'tarot' | 'd20' | 'iching' | 'happening';

// ── Divination Results ──
export interface TarotResult {
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

export interface DiceResult {
  type: 'd20';
  result: number; // 1-20
  threshold: 'critical-low' | 'low' | 'neutral' | 'high' | 'critical-high';
  interpretation: string;
  tags: Tag[];
}

export interface IChingResult {
  type: 'iching';
  hexagramNumber: number; // 1-64
  name: string;
  symbol: string; // Unicode hexagram symbol
  judgment: string;
  changingLines: number[]; // 0-6 line indices that are changing
  tags: Tag[];
}

export interface HappeningResult {
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

export type DivinationResult = TarotResult | DiceResult | IChingResult;

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

// ── Interaction Rules ──
export interface InteractionRule {
  id: string;
  trigger: {
    on: EventType;
    sourceTags: Tag[];
  };
  target: {
    tags: Tag[];
    action: 'reroll' | 'flip' | 'add-choice' | 'mirror' | 'second-result';
  };
  modifier?: {
    tags: Tag[];
    evaluate: 'contextual';
  };
  display: {
    flashSource: boolean;
    flashTarget: boolean;
    description: string;
  };
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
  interactions: InteractionEvent[];
  synthesis: SynthesisResult;
  happening?: HappeningResult;
  happeningChoice?: number; // index of chosen happening option
}

export interface InteractionEvent {
  ruleId: string;
  sourceSlotIndex: number;
  targetSlotIndex: number;
  effect: string;
  description: string;
}

export interface PendingEffect {
  id: string;
  sourceRunId: string;
  sourceCard: string;
  sourceSlotIndex: number;
  triggerTags: string[];
  action: 'reroll' | 'flip' | 'add-choice' | 'mirror' | 'second-result';
  description: string;
  expiresAfter: number;
  turnsRemaining: number;
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
  | 'result';

export interface GameState {
  screen: Screen;
  affinities: Record<AffinityId, number>;
  questionType: QuestionType | null;
  availableMethods: DivinationType[];
  selectedMethod: DivinationType | null;
  turnResults: SlotResult[];
  minigamesCompleted: number;
  minigameState: MinigameState | null;
  pendingEffects: PendingEffect[];
  interactionQueue: InteractionEvent[];
  pendingHappening: boolean; // interaction was shown before a between-minigame happening
  interactions: InteractionEvent[];
  synthesis: SynthesisResult | null;
  happening: HappeningResult | null;
  selectedHappeningChoice: number | null;
  history: RunRecord[];
  eventLog: GameEvent[];
  chainDepth: number;
  debug: boolean;
}
