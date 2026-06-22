import type { GameState, QuestionType, AffinityId, MinigameMeta, SlotResult, TarotResult, DiceResult, RunRecord, RollMode, DivinationType, TarotCardFace, TableCard, TarotDraftState } from './types';
import { FULL_DECK, buildFace, pickOrientation, DECK_BY_ID, consolidateSpread, reverseSpread } from '../data/tarot';
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
  private pendingTransition: (() => void) | null = null;
  private turnEffects: EffectReport[] = []; // per-turn accumulator of all reports (for RunRecord)

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
      shroudedMethods: [],
      selectedMethod: null,
      turnResults: [],
      minigamesCompleted: 0,
      activeSlotIndex: null,
      minigameState: null,
      synthesis: null,
      happening: null,
      selectedHappeningChoice: null,
      history: [],
      eventLog: [],
      debug: false,
      affinityEffects: {
        spreadRedraws: 0, methodCount: 3, hintClarity: 0,
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
    if (reports.length > 0) {
      this.state.eventQueue = [...this.state.eventQueue, ...reports];
      this.turnEffects = [...this.turnEffects, ...reports];
    }
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

  // Runs the transition now if nothing is queued for narration; otherwise stores
  // it and lets the sequencer run it once the batch drains (freeze-until-narrated).
  private runOrDefer(transition: () => void): void {
    if (this.state.eventQueue.length > 0) {
      this.pendingTransition = transition;
      this.notify();
    } else {
      transition();
    }
  }

  // Called by InteractionSequencer when the queue finishes (or is skipped):
  // clear the queue and run any transition that was deferred behind it.
  finishEventBatch(): void {
    this.state.eventQueue = [];
    const t = this.pendingTransition;
    this.pendingTransition = null;
    if (t) t();
    else this.notify();
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
    const { draft: endDraftPool } = this.dispatchAt('select:draw:end', { pool: poolResults });
    // Persist any shrouded indices from the shadow-shroud responder.
    this.state.shroudedMethods = Array.isArray(endDraftPool.shrouded)
      ? (endDraftPool.shrouded as number[])
      : [];
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
    this.state.synthesis = null;
    this.state.happening = null;
    this.state.selectedHappeningChoice = null;
    this.state.eventQueue = [];
    this.turnEffects = [];

    this.narrativeAssembler.resetRotation();

    this.buildPool();

    this.bus.emit('turn-started', { question, availableMethods: this.state.availableMethods });
    this.notify();
  }

  selectMethod(index: number): void {
    if (!this.state.availableMethods[index]) {
      throw new Error(`Method index ${index} out of bounds`);
    }
    // Fate (OVERRIDE) may redirect the chosen method.
    const { draft } = this.dispatchAt('select:pick', {
      methodIndex: index,
      methodPool: this.state.availableMethods,
    });
    const finalIndex = typeof draft.methodIndex === 'number' ? draft.methodIndex : index;
    const methodType = this.state.availableMethods[finalIndex];
    if (!methodType) {
      throw new Error(`Method index ${finalIndex} out of bounds`);
    }
    this.state.selectedMethod = methodType;
    this.state.activeSlotIndex = null;
    this.state.screen = 'minigame';

    // Start draft state for tarot
    if (methodType === 'tarot') {
      this.startTarotDraft();
    }

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

    // Spread coherence feeds (All Upright → Order, All Reversed → Chaos).
    if (result.type === 'tarot' && (result as TarotResult).spread && (result as TarotResult).spread!.length > 1) {
      const faces = (result as TarotResult).spread!.map((s) => s.card);
      if (faces.every((f) => f.orientation === 'upright')) this.affinityEngine.shift('order', 6, 'spread-aligned');
      else if (faces.every((f) => f.orientation === 'reversed')) this.affinityEngine.shift('chaos', 6, 'spread-cascade');
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
      const newIndex = this.state.turnResults.length - 1;
      // The responder cannot know the post-append index; patch its queued report
      // so the animation can spotlight the new fan slot.
      this.state.eventQueue = this.state.eventQueue.map((r) =>
        r.responderId === 'chaos-second-result' ? { ...r, targetSlot: newIndex } : r,
      );
    }

    this.bus.emit('minigame-complete', { result, completed });

    // Resolve-first, narrate-second: if the commit queued any events, freeze on
    // the current screen until the sequencer drains them, then transition.
    this.runOrDefer(() => this.advanceAfterCommit(result, completed));
  }

  private advanceAfterCommit(result: SlotResult, completed: number): void {
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
      // The minigame:end dispatch may itself have queued the interrupt report;
      // narrate it on the current screen, then open the happening.
      this.runOrDefer(() => this.triggerHappening());
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
      effects: this.turnEffects,
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

  // Fate (OVERRIDE) may swap one dealt position for a fresh single card before reveal.
  resolveTarotDeal(faces: TarotCardFace[]): { faces: TarotCardFace[]; swappedIndex: number | null } {
    const { draft } = this.dispatchAt('tarot:deal', { faces: [...faces] as unknown as SlotResult[] });
    const outFaces = (draft.faces as unknown as TarotCardFace[]) ?? faces;
    const swappedIndex = typeof draft.swappedIndex === 'number' ? draft.swappedIndex : null;
    this.notify();
    return { faces: outFaces, swappedIndex };
  }

  // Fate (OVERRIDE) may decide the spread-wide orientation for the player.
  resolveSpreadOrientation(result: TarotResult): { result: TarotResult; auto: boolean; reversed: boolean } {
    const originalOrientation = result.orientation;
    const { draft } = this.dispatchAt('tarot:orient', { outcome: result });
    const out = (draft.outcome as TarotResult) ?? result;
    const auto = out.orientation !== originalOrientation;
    this.notify();
    return { result: out, auto, reversed: out.orientation === 'reversed' };
  }

  // Pre-commit dice reroll. Fate (Ascendant+) may make it hollow (same face).
  resolveReroll(current: DiceResult): { result: DiceResult; hollow: boolean } {
    const fresh = this.orchestrator.drawSingleResult('d20', this.affinityEngine.getState()) as DiceResult;
    const { draft } = this.dispatchAt('dice:reroll', { outcome: fresh }, { previous: current });
    const result = (draft.outcome as DiceResult) ?? fresh;
    this.notify();
    return { result, hollow: result === current };
  }

  // Will: redraw one disliked spread position. Draws a fresh distinct card, feeds Will.
  redrawSpreadPosition(faces: TarotCardFace[], index: number): TarotCardFace[] {
    const used = new Set(faces.map((f) => f.id));
    const candidates = FULL_DECK.filter((c) => !used.has(c.id));
    const card = candidates[Math.floor(Math.random() * candidates.length)] ?? DECK_BY_ID[faces[index].id];
    const next = [...faces];
    next[index] = buildFace(card, pickOrientation(this.affinityEngine.getState()));
    this.affinityEngine.applyAction('take-reroll'); // agency → Will
    this.notify();
    return next;
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
    // For a tarot spread, name the position whose card has the largest absolute dimensions.
    if (preview.type === 'tarot' && preview.spread && preview.spread.length > 1) {
      let maxPos = preview.spread[0];
      let maxSum = Math.abs(maxPos.card.dimensions.favorability)
        + Math.abs(maxPos.card.dimensions.certainty)
        + Math.abs(maxPos.card.dimensions.volatility);
      for (let i = 1; i < preview.spread.length; i++) {
        const sp = preview.spread[i];
        const s = Math.abs(sp.card.dimensions.favorability)
          + Math.abs(sp.card.dimensions.certainty)
          + Math.abs(sp.card.dimensions.volatility);
        if (s > maxSum) { maxSum = s; maxPos = sp; }
      }
      const posLabel = maxPos.position.charAt(0).toUpperCase() + maxPos.position.slice(1);
      const fav = maxPos.card.dimensions.favorability;
      if (fav >= 1) return `The ${posLabel} pulls strongest, toward fortune...`;
      if (fav <= -1) return `The ${posLabel} pulls strongest, toward hardship...`;
      return `The ${posLabel} pulls strongest, in uneasy balance...`;
    }
    const fav = preview.dimensions.favorability;
    if (fav >= 1) return 'The current leans toward fortune...';
    if (fav <= -1) return 'The current leans toward hardship...';
    return 'The current holds in uneasy balance...';
  }

  // ── Tarot Draft Minigame ──

  startTarotDraft(): void {
    const shuffled = [...FULL_DECK].sort(() => Math.random() - 0.5);
    const dealCount = 9;
    const dealt = shuffled.splice(0, dealCount);
    const table: TableCard[] = dealt.map((card, i) => ({
      cardId: card.id,
      originIndex: i,
      faceUp: false,
    }));

    const draft: TarotDraftState = {
      method: 'tarot',
      deck: shuffled.map((c) => c.id),
      table,
      hand: [null, null, null],
      dealCount,
      shufflesRemaining: this.affinityEngine.getEffects().spreadRedraws,
      phase: 'drafting',
    };

    this.state.minigameState = draft;
    this.dispatchAt('tarot:draft:started', {});
    this.notify();
  }

  pickForHand(handIndex: number, tableIndex: number): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    if (draft.hand[handIndex] !== null) throw new Error(`Hand slot ${handIndex} already filled`);
    if (handIndex < 0 || handIndex > 2) throw new Error(`Invalid hand index: ${handIndex}`);
    if (tableIndex < 0 || tableIndex >= draft.table.length) throw new Error(`Invalid table index: ${tableIndex}`);

    const slot = draft.table[tableIndex];
    if (!slot) throw new Error(`Table slot ${tableIndex} is empty`);

    draft.hand[handIndex] = {
      cardId: slot.cardId,
      tableOriginIndex: slot.originIndex,
      peeked: false,
    };
    draft.table[tableIndex] = null;

    this.dispatchAt('tarot:picked', { handIndex, tableIndex });
    this.notify();
  }

  returnToTable(handIndex: number): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    const handCard = draft.hand[handIndex];
    if (!handCard) throw new Error(`Hand slot ${handIndex} is empty`);

    // Find target: origin slot if free, else lowest open slot, else append
    let targetIdx = handCard.tableOriginIndex;
    if (targetIdx >= draft.table.length || draft.table[targetIdx] !== null) {
      const openIdx = draft.table.findIndex((t) => t === null);
      if (openIdx >= 0) {
        targetIdx = openIdx;
      } else {
        targetIdx = draft.table.length;
      }
    }

    const faceUp = handCard.peeked;
    const newSlot: TableCard = {
      cardId: handCard.cardId,
      originIndex: targetIdx,
      faceUp,
      revealedFace: faceUp ? handCard.revealedFace : undefined,
    };

    if (targetIdx >= draft.table.length) {
      draft.table.push(newSlot);
      draft.dealCount = draft.table.length;
    } else {
      draft.table[targetIdx] = newSlot;
    }

    draft.hand[handIndex] = null;
    this.dispatchAt('tarot:returned:table', { handIndex, tableIndex: targetIdx });
    this.notify();
  }

  returnToDeck(handIndex: number): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    const handCard = draft.hand[handIndex];
    if (!handCard) throw new Error(`Hand slot ${handIndex} is empty`);

    draft.deck.push(handCard.cardId);
    // Shuffle deck so the returned card isn't predictably on top
    for (let i = draft.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [draft.deck[i], draft.deck[j]] = [draft.deck[j], draft.deck[i]];
    }
    draft.hand[handIndex] = null;
    this.dispatchAt('tarot:returned:deck', { handIndex });
    this.notify();
  }

  shuffleTable(): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    if (draft.shufflesRemaining <= 0) throw new Error('No shuffles remaining');

    // Flip all face-up table cards face-down
    for (const slot of draft.table) {
      if (slot && slot.faceUp) {
        slot.faceUp = false;
        slot.revealedFace = undefined;
      }
    }

    // Collect all non-null table cards + remaining deck, shuffle
    const collected = draft.table.filter((t): t is TableCard => t !== null);
    const pool = [
      ...collected.map((t) => t.cardId),
      ...draft.deck,
    ];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Redeal
    const dealCount = draft.dealCount;
    const dealt = pool.splice(0, Math.min(dealCount, pool.length));
    draft.table = dealt.map((cardId, i) => ({
      cardId,
      originIndex: i,
      faceUp: false,
    }));
    draft.deck = pool;
    draft.shufflesRemaining--;

    this.affinityEngine.applyAction('take-reroll');
    this.dispatchAt('tarot:shuffled', {});
    this.notify();
  }

  peekHandCard(handIndex: number): { success: boolean; card?: TarotCardFace; message: string } {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    const handCard = draft.hand[handIndex];
    if (!handCard) throw new Error(`Hand slot ${handIndex} is empty`);
    if (handCard.peeked) throw new Error('Card already peeked');

    const { failed } = this.affinityEngine.usePeek();
    if (failed) {
      this.dispatchAt('tarot:peeked', { handIndex, success: false });
      this.notify();
      return { success: false, message: 'The vision clouds over — nothing is revealed.' };
    }

    const cardData = DECK_BY_ID[handCard.cardId];
    if (!cardData) throw new Error(`Card not found: ${handCard.cardId}`);
    const face = buildFace(cardData, pickOrientation(this.affinityEngine.getState()));
    handCard.peeked = true;
    handCard.revealedFace = face;

    this.dispatchAt('tarot:peeked', { handIndex, success: true });
    this.notify();
    return { success: true, card: face, message: `${face.name} — ${face.orientation === 'upright' ? '▲ Upright' : '▼ Reversed'}` };
  }

  swapHandCards(a: number, b: number): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    if (a < 0 || a > 2 || b < 0 || b > 2) throw new Error('Invalid hand index');
    [draft.hand[a], draft.hand[b]] = [draft.hand[b], draft.hand[a]];
    this.dispatchAt('tarot:swapped', { a, b });
    this.notify();
  }

  commitDraft(reverse: boolean = false): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    if (draft.hand.some((h) => h === null)) throw new Error('Hand is not full');

    draft.phase = 'committing';
    const faces = draft.hand.map((h) => {
      if (h!.revealedFace) return h!.revealedFace; // use peeked face (locked orientation)
      return buildFace(DECK_BY_ID[h!.cardId], pickOrientation(this.affinityEngine.getState()));
    });

    let result = consolidateSpread(faces);
    if (reverse) result = reverseSpread(result);

    const meta = reverse
      ? { reversed: true }
      : { revealedAsDrawn: true };

    // Reset minigame state before completing (completeMinigame may trigger transitions)
    this.state.minigameState = null;
    this.completeMinigame(result, meta);
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
      // Use buildPool so select:draw triggers fire (shrouding, etc.) and shroudedMethods is set.
      // buildPool may consume forced IDs via dispatchAt; restore the scenario config afterward so
      // the debug panel always reflects the full forced list the scenario declared.
      this.buildPool();
      this.state.debugConfig = { forced: scenario.forced, isolate: scenario.isolate };
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
      effects: this.turnEffects,
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
    this.state.shroudedMethods = [];
    this.state.selectedMethod = null;
    this.state.turnResults = [];
    this.state.minigamesCompleted = 0;
    this.state.activeSlotIndex = null;
    this.state.minigameState = null;
    this.state.synthesis = null;
    this.state.happening = null;
    this.state.selectedHappeningChoice = null;
    this.state.eventQueue = [];
    this.turnEffects = [];
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
