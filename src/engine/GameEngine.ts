import type { GameState, QuestionType, AffinityId, MinigameMeta, SlotResult, TarotResult, DiceResult, RunRecord, RollMode, DivinationType } from './types';
import { EventBus } from './EventBus';
import { AffinityEngine } from './AffinityEngine';
import { TurnOrchestrator } from './TurnOrchestrator';
import { ReadingPlanner } from './ReadingPlanner';
import { NarrativeAssembler } from './NarrativeAssembler';
import { AFFINITY_DEFINITIONS, defaultAffinityState } from '../data/affinities';
import { selectHappening } from '../data/happenings';
import { dispatch } from './events/EventDispatcher';
import { buildAffinityResponders } from './responders/affinity';
import { buildInteractionResponders } from './responders/interactions';
import { findScenario, freshStage, DEBUG_SCENARIOS } from './events/scenarios';
import type { Responder, PhaseContext, PhaseDraft, EffectReport } from './events/types';

const STORAGE_KEY = 'fate-atlas-save';

export class GameEngine {
  private bus: EventBus;
  private affinityEngine: AffinityEngine;
  private orchestrator: TurnOrchestrator;
  private readingPlanner: ReadingPlanner;
  private narrativeAssembler: NarrativeAssembler;
  private responders: Responder[];

  private state: GameState;
  private cachedSnapshot: GameState;
  private listeners = new Set<(state: GameState) => void>();
  private usedHappeningIds = new Set<string>();
  private minigamesPerTurn: number;

  constructor(minigamesPerTurn = 3) {
    this.minigamesPerTurn = minigamesPerTurn;
    this.bus = new EventBus();
    this.affinityEngine = new AffinityEngine(AFFINITY_DEFINITIONS);
    this.orchestrator = new TurnOrchestrator(this.bus);
    this.readingPlanner = new ReadingPlanner();
    this.narrativeAssembler = new NarrativeAssembler();
    this.responders = [...buildAffinityResponders(), ...buildInteractionResponders()];
    this.state = this.defaultState();
    this.cachedSnapshot = JSON.parse(JSON.stringify(this.state)) as GameState;
  }

  // ---------- Private helpers ----------

  private defaultState(): GameState {
    return {
      screen: 'title',
      affinities: defaultAffinityState(),
      questionType: null,
      availableMethods: [],
      selectedMethod: null,
      turnResults: [],
      minigamesCompleted: 0,
      activeSlotIndex: null,
      minigameState: null,
      interactions: [],
      synthesis: null,
      happening: null,
      selectedHappeningChoice: null,
      history: [],
      eventLog: [],
      debug: false,
      debugForcedEffect: null,
      affinityEffects: {
        handSize: 3, methodCount: 3, hintClarity: 0,
        readingDetail: 0, poolPreview: 'none', peekAvailable: false,
      },
      eventQueue: [],
      debugConfig: { forced: [], isolate: false },
    };
  }

  private notify(): void {
    this.state.affinities = this.affinityEngine.getState();
    this.state.affinityEffects = this.affinityEngine.getEffects();
    this.state.eventLog = this.bus.getHistory();
    this.cachedSnapshot = JSON.parse(JSON.stringify(this.state)) as GameState;
    this.listeners.forEach((fn) => fn(this.cachedSnapshot));
  }

  // ---------- Dispatch wiring ----------

  private buildContext(trigger: string, draft: PhaseDraft, payload?: unknown): PhaseContext {
    const slots = this.state.turnResults;
    const hand = (draft.pool as SlotResult[] | undefined) ?? null;
    return {
      trigger,
      affinities: this.affinityEngine.getState(),
      slots,
      hand,
      spread: hand ? [...slots, ...hand] : slots,
      minigame: this.state.minigameState,
      event: payload ?? null,
      draft,
      rng: Math.random,
    };
  }

  private dispatchAt(trigger: string, draft: PhaseDraft, payload?: unknown): { draft: PhaseDraft; reports: EffectReport[] } {
    const ctx = this.buildContext(trigger, draft, payload);
    const { reports, forcedConsumed } = dispatch(trigger, ctx, this.responders, this.state.debugConfig);
    if (forcedConsumed.length > 0) {
      this.state.debugConfig = {
        ...this.state.debugConfig,
        forced: this.state.debugConfig.forced.filter((id) => !forcedConsumed.includes(id)),
      };
    }
    if (reports.length > 0) this.state.eventQueue = [...this.state.eventQueue, ...reports];
    return { draft: ctx.draft, reports };
  }

  forceEffects(ids: string[], isolate: boolean): void {
    this.state.debugConfig = { forced: ids, isolate };
    this.notify();
  }

  clearEventQueue(): void {
    this.state.eventQueue = [];
    this.notify();
  }

  // Refills/generates the pool, routing it through the select draw triggers so
  // pool-shaping (will-widen/fate-thin) and shrouding effects participate.
  private buildPool(bias: Partial<Record<DivinationType, number>> = {}, refill = false): void {
    const baseCount = this.affinityEngine.getEffects().methodCount;
    const startDraft: PhaseDraft = { poolTarget: baseCount };
    this.dispatchAt('select:draw:start', startDraft);
    const target = (startDraft.poolTarget as number) ?? baseCount;

    const affinities = this.affinityEngine.getState();
    const pool = refill
      ? this.orchestrator.refillPool(this.state.questionType!, affinities, bias, target)
      : this.orchestrator.generatePool(this.state.questionType!, affinities, target);
    this.state.availableMethods = pool;

    // Render the drawn pool through the end-of-draw trigger (shrouding, etc.).
    const poolResults = pool.map((m) => ({ tags: [], type: m } as unknown as SlotResult));
    this.dispatchAt('select:draw:end', { pool: poolResults });
  }

  // ---------- Turn lifecycle ----------

  startTurn(question: QuestionType): void {
    this.affinityEngine.beginRun();

    this.state.screen = 'method-select';
    this.state.questionType = question;
    this.state.selectedMethod = null;
    this.state.turnResults = [];
    this.state.minigamesCompleted = 0;
    this.state.activeSlotIndex = null;
    this.state.minigameState = null;
    this.state.interactions = [];
    this.state.synthesis = null;
    this.state.happening = null;
    this.state.selectedHappeningChoice = null;
    this.state.eventQueue = [];

    this.narrativeAssembler.resetRotation();

    this.buildPool();

    this.bus.emit('turn-started', { question, availableMethods: this.state.availableMethods });
    this.notify();
  }

  selectMethod(index: number): void {
    const methodType = this.state.availableMethods[index];
    if (!methodType) {
      throw new Error(`Method index ${index} out of bounds`);
    }

    this.state.selectedMethod = methodType;
    this.state.activeSlotIndex = null;
    this.state.screen = 'minigame';
    this.notify();
  }

  completeMinigame(result: SlotResult, meta?: MinigameMeta): void {
    // Add result to the turn's results array
    this.state.turnResults = [...this.state.turnResults, result];
    const committedIndex = this.state.turnResults.length - 1;
    this.state.activeSlotIndex = committedIndex;
    const completed = this.state.minigamesCompleted + 1;
    this.state.minigamesCompleted = completed;

    // Apply affinities from the result (Chaos/Order tag feeds, routed through shift)
    if (result.type !== 'happening') {
      this.affinityEngine.applyResultTags(result);
    }

    // Player-action feeds derived from how this result was reached.
    if (meta) {
      if (meta.reversed) this.affinityEngine.applyAction('reverse');
      else if (meta.revealedAsDrawn) this.affinityEngine.applyAction('reveal-as-drawn');
      if (meta.viaReroll) this.affinityEngine.applyAction('take-reroll');
    }

    // Post-commit dispatch: interaction matchers + chaos second-result responders.
    // Responders namespace dice as 'dice', not the data-layer 'd20' type.
    const commitFamily = result.type === 'd20' ? 'dice' : result.type;
    const commitTrigger = `${commitFamily}:commit`;
    const { draft } = this.dispatchAt(commitTrigger, { outcome: result });

    // Mutating responders (mirror/critical-resonance) operate in place on the
    // spread, so the committed slot reflects any orientation flip.
    if (draft.outcome && draft.outcome !== result) {
      this.state.turnResults = [
        ...this.state.turnResults.slice(0, committedIndex),
        draft.outcome,
        ...this.state.turnResults.slice(committedIndex + 1),
      ];
    }

    // Fool-reroll: The Fool intercepts a d20 commit — draw a fresh die and replace the slot.
    if (draft.rerollOutcome === true && result.type === 'd20') {
      const affinities = this.affinityEngine.getState();
      const rerolled = this.orchestrator.drawSingleResult('d20', affinities);
      this.state.turnResults = [
        ...this.state.turnResults.slice(0, committedIndex),
        rerolled,
        ...this.state.turnResults.slice(committedIndex + 1),
      ];
    }

    // Chaos surge: spawn a second result of the same type.
    if (typeof draft.spawnSecond === 'string') {
      const affinities = this.affinityEngine.getState();
      const second = this.orchestrator.drawSingleResult(
        draft.spawnSecond as 'tarot' | 'd20' | 'iching',
        affinities,
      );
      this.state.turnResults = [...this.state.turnResults, second];
    }

    this.bus.emit('minigame-complete', { result, completed });

    // Final reading?
    if (completed >= this.minigamesPerTurn) {
      this.synthesizeAll();
      this.buildRunRecord();
      this.state.screen = 'result';
      this.saveToStorage();
      this.notify();
      return;
    }

    // Between-minigame transition. Ask the minigame:end trigger whether a
    // happening interrupts the flow.
    this.orchestrator.removeUsedMethod(result.type as 'tarot' | 'd20' | 'iching');
    const { draft: endDraft } = this.dispatchAt('minigame:end', {
      lastReading: completed >= this.minigamesPerTurn,
    });

    if (endDraft.interruptHappening === true) {
      this.triggerHappening();
      return;
    }

    const gaps = this.readingPlanner.analyzeGaps(this.state.turnResults);
    const bias = this.readingPlanner.getBiasForRefill(gaps);
    this.buildPool(bias, true);
    this.state.screen = 'method-select';
    this.state.selectedMethod = null;
    this.notify();
  }

  private buildRunRecord(): void {
    const run: RunRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      question: this.state.questionType!,
      turnResults: this.state.turnResults,
      interactions: this.state.interactions,
      synthesis: this.state.synthesis!,
      happening: this.state.happening ?? undefined,
      happeningChoice: this.state.selectedHappeningChoice ?? undefined,
    };
    this.state.history = [...this.state.history, run].slice(-10);
  }

  private synthesizeAll(): void {
    const results = this.state.turnResults;
    if (results.length === 0) return;

    const question = this.state.questionType!;
    const affinities = this.affinityEngine.getState();
    const aggregated = this.readingPlanner.aggregate(results, question);

    const synthesisResult = this.narrativeAssembler.assemble(
      aggregated,
      results,
      question,
      affinities,
      this.affinityEngine.getEffects(),
    );

    this.state.synthesis = synthesisResult;
    this.bus.emit('synthesis-complete', { result: synthesisResult });
  }

  triggerHappening(): void {
    const affinities = this.affinityEngine.getState();
    const data = selectHappening(Array.from(this.usedHappeningIds), affinities.chaos);
    this.usedHappeningIds.add(data.id);

    this.state.happening = {
      type: 'happening',
      id: data.id,
      scene: data.scene,
      choices: data.choices.map((c) => ({
        text: c.text,
        affinityChanges: c.affinityChanges as Partial<Record<AffinityId, number>>,
      })),
      tags: data.tags,
      themes: data.themes,
      dimensions: data.dimensions,
      modifierRoles: data.modifierRoles,
    };
    this.state.screen = 'happening';

    // I Ching changing-lines may add a hidden branch (happening:start trigger).
    const { draft } = this.dispatchAt('happening:start', {});
    if (draft.addChoice === true && this.state.happening.choices.length > 0) {
      const bonusChoice = {
        text: 'A hidden path emerges — ' + this.state.happening.choices[0].text,
        affinityChanges: { chaos: 5 } as Partial<Record<AffinityId, number>>,
      };
      this.state.happening = {
        ...this.state.happening,
        choices: [...this.state.happening.choices, bonusChoice],
      };
    }

    this.bus.emit('happening-triggered', { happening: this.state.happening });
    this.notify();
  }

  resolveHappening(choiceIndex: number): void {
    if (!this.state.happening) {
      throw new Error('No happening active');
    }
    const choice = this.state.happening.choices[choiceIndex];
    if (!choice) {
      throw new Error(`Choice ${choiceIndex} not found in happening`);
    }

    for (const [id, delta] of Object.entries(choice.affinityChanges)) {
      this.affinityEngine.shift(id as AffinityId, delta as number, `happening:${this.state.happening.id}`);
    }

    this.state.selectedHappeningChoice = choiceIndex;
    this.state.affinities = this.affinityEngine.getState();

    this.state.screen = 'method-select';
    this.state.selectedMethod = null;
    this.state.happening = null;
    this.state.selectedHappeningChoice = null;

    this.bus.emit('happening-resolved', { choiceIndex });

    // Refill pool for next minigame (the used method was already removed)
    this.buildPool({}, true);

    this.saveToStorage();
    this.notify();
  }

  // ---------- Dispatch-driven action methods ----------

  // Resolves every active roll modifier into one plan for the dice minigame.
  planDiceRoll(): { mode: RollMode; offerReroll: boolean; reports: EffectReport[] } {
    const { draft, reports } = this.dispatchAt('dice:roll', { rollMods: [], outcome: undefined });
    this.notify();
    return { mode: draft.rollMode ?? 'single', offerReroll: draft.offerReroll ?? false, reports };
  }

  // Fate may intercept the pick (OVERRIDE band) and substitute another card.
  resolveTarotPick(chosenIndex: number, hand: TarotResult[]): { card: TarotResult; swapped: boolean } {
    const chosen = hand[chosenIndex];
    const { draft } = this.dispatchAt('tarot:pick', { outcome: chosen, pool: hand as unknown as SlotResult[] });
    const card = (draft.outcome as TarotResult) ?? chosen;
    this.notify();
    return { card, swapped: card !== chosen };
  }

  // Fate may decide the orientation for the player.
  resolveOrientation(card: TarotResult): { orientation: 'upright' | 'reversed'; auto: boolean } {
    const { draft } = this.dispatchAt('tarot:orient', { outcome: card });
    const out = draft.outcome as TarotResult | undefined;
    const auto = !!out && out.orientation !== card.orientation;
    this.notify();
    return { orientation: out?.orientation ?? card.orientation, auto };
  }

  // Pre-commit dice reroll. Fate (Ascendant+) may make it hollow (same face).
  resolveReroll(current: DiceResult): { result: DiceResult; hollow: boolean } {
    const fresh = this.orchestrator.drawSingleResult('d20', this.affinityEngine.getState()) as DiceResult;
    const { draft } = this.dispatchAt('dice:reroll', { outcome: fresh }, { previous: current });
    const result = (draft.outcome as DiceResult) ?? fresh;
    this.notify();
    return { result, hollow: result === current };
  }

  // Will: the player exercises a free orientation choice.
  setOrientation(_orientation: 'upright' | 'reversed'): void {
    this.affinityEngine.applyAction('set-orientation');
    this.notify();
  }

  // Rolls two d20s for a two-dice mode. advantage/disadvantage auto-keep the
  // higher/lower die (ties keep index 0); choice keeps neither (player picks).
  rollDicePair(mode: 'advantage' | 'disadvantage' | 'choice'): { dice: [DiceResult, DiceResult]; keptIndex: 0 | 1 | null } {
    const aff = this.affinityEngine.getState();
    const a = this.orchestrator.drawSingleResult('d20', aff) as DiceResult;
    const b = this.orchestrator.drawSingleResult('d20', aff) as DiceResult;
    let keptIndex: 0 | 1 | null;
    if (mode === 'choice') keptIndex = null;
    else if (mode === 'advantage') keptIndex = a.result >= b.result ? 0 : 1;
    else keptIndex = a.result <= b.result ? 0 : 1; // disadvantage
    return { dice: [a, b], keptIndex };
  }

  // Will: swap the offered method set — re-rolls the pool. Feeds Will.
  swapMethod(): void {
    this.affinityEngine.applyAction('swap-method');
    this.buildPool();
    this.state.selectedMethod = null;
    this.notify();
  }

  // ---------- Information (Light/Shadow) decisions ----------

  usePeek(preview?: SlotResult): { failed: boolean; leaning: string } {
    const { failed } = this.affinityEngine.usePeek();
    if (failed) {
      this.notify();
      return { failed: true, leaning: 'The vision clouds over — nothing is revealed.' };
    }
    const leaning = this.describeLeaning(preview);
    this.notify();
    return { failed: false, leaning };
  }

  declinePeek(): void {
    this.affinityEngine.applyAction('decline-peek');
    this.notify();
  }

  private describeLeaning(preview?: SlotResult): string {
    if (!preview || preview.type === 'happening') return 'A faint shape stirs beyond the veil...';
    const fav = preview.dimensions.favorability;
    if (fav >= 1) return 'The current leans toward fortune...';
    if (fav <= -1) return 'The current leans toward hardship...';
    return 'The current holds in uneasy balance...';
  }

  // ---------- State access ----------

  getState(): GameState {
    return this.cachedSnapshot;
  }

  getAffinityEffects() {
    return this.affinityEngine.getEffects();
  }

  loadState(json: Partial<GameState>): void {
    Object.assign(this.state, json);
    if (json.affinities) {
      this.affinityEngine.setState(json.affinities);
    }
    this.bus.emit('state-loaded', json);
    this.notify();
  }

  // ---------- Debug / Scenarios ----------

  loadScenarioById(id: string): boolean {
    const scenario = findScenario(id);
    if (!scenario) return false;

    // Reset to a fresh game, then stage the scenario.
    this.affinityEngine.setState(defaultAffinityState());
    this.state = this.defaultState();

    const stage = freshStage();
    scenario.setup(stage);

    this.affinityEngine.setState(stage.affinities);
    this.state.affinities = this.affinityEngine.getState();
    this.state.screen = stage.screen as GameState['screen'];
    this.state.selectedMethod = stage.selectedMethod as GameState['selectedMethod'];
    this.state.turnResults = stage.slots;
    this.state.questionType = this.state.questionType ?? 'self';
    this.state.debugConfig = { forced: scenario.forced, isolate: scenario.isolate };

    if (this.state.screen === 'method-select') {
      this.state.availableMethods = this.orchestrator.generatePool(
        this.state.questionType,
        this.affinityEngine.getState(),
        this.affinityEngine.getEffects().methodCount,
      );
    }

    this.notify();
    return true;
  }

  getScenarioPresets() {
    return DEBUG_SCENARIOS.map((s) => ({ id: s.id, label: s.label, group: s.group }));
  }

  getResponderIds(): string[] {
    return this.responders.map((r) => r.id);
  }

  // ---------- Persistence ----------

  saveToStorage(): void {
    try {
      const data = {
        affinities: this.affinityEngine.serialize(),
        history: this.state.history,
        usedHappeningIds: Array.from(this.usedHappeningIds),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage unavailable or full — silently ignore
    }
  }

  loadFromStorage(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.affinities) this.affinityEngine.loadFrom(data.affinities);
      if (data.history) this.state.history = data.history;
      if (data.usedHappeningIds) this.usedHappeningIds = new Set(data.usedHappeningIds);
      this.state.affinities = this.affinityEngine.getState();
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  // ---------- LLM Prompt ----------

  generateLLMPrompt(): string {
    const results = this.state.turnResults;
    if (results.length === 0) return '';
    const question = this.state.questionType!;
    const affinities = this.affinityEngine.getState();
    const aggregated = this.readingPlanner.aggregate(results, question);

    return this.narrativeAssembler.generateLLMPrompt({
      question,
      slots: results,
      interactions: this.state.interactions,
      affinities,
      aggregated,
    });
  }

  // ---------- Subscription ----------

  subscribe(fn: (state: GameState) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  // ---------- Navigation helpers ----------

  returnToQuestionSelect(): void {
    this.state.screen = 'question';
    this.state.questionType = null;
    this.state.availableMethods = [];
    this.state.selectedMethod = null;
    this.state.turnResults = [];
    this.state.minigamesCompleted = 0;
    this.state.activeSlotIndex = null;
    this.state.minigameState = null;
    this.state.interactions = [];
    this.state.synthesis = null;
    this.state.happening = null;
    this.state.selectedHappeningChoice = null;
    this.state.eventQueue = [];
    this.notify();
  }

  returnToTitle(): void {
    const saved = {
      affinities: this.affinityEngine.getState(),
      history: this.state.history,
      usedHappeningIds: Array.from(this.usedHappeningIds),
    };
    this.state = this.defaultState();
    this.affinityEngine.setState(saved.affinities);
    this.state.affinities = this.affinityEngine.getState();
    this.state.history = saved.history;
    this.usedHappeningIds = new Set(saved.usedHappeningIds);
    this.bus.clear();
    this.saveToStorage();
    this.notify();
  }

  reset(): void {
    const affinities = this.affinityEngine.getState();
    const history = this.state.history;
    const usedIds = Array.from(this.usedHappeningIds);
    this.state = this.defaultState();
    this.affinityEngine.setState(affinities);
    this.state.affinities = this.affinityEngine.getState();
    this.state.history = history;
    this.usedHappeningIds = new Set(usedIds);
    this.bus.clear();
    this.saveToStorage();
    this.notify();
  }

  clearHistory(): void {
    this.affinityEngine.setState(defaultAffinityState());
    this.state = this.defaultState();
    this.state.affinities = this.affinityEngine.getState();
    this.usedHappeningIds = new Set();
    this.bus.clear();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // silently ignore
    }
    this.notify();
  }
}
