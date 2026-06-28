import type { GameState, QuestionType, AffinityId, MinigameMeta, SlotResult, TarotResult, DiceResult, RunRecord, RollMode, DivinationType, TarotCardFace, TableCard, TarotDraftState, AstralCast, IChingResult, HandCard } from './types';
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
import { buildAstralResponders } from './responders/astral';
import { buildIChingResponders } from './responders/iching';
import { buildRuneResponders } from './responders/runes';
import { buildStringsResponders } from './responders/strings';
import { findScenario, freshStage, DEBUG_SCENARIOS } from './events/scenarios';
import type { Responder, PhaseContext, PhaseDraft, EffectReport } from './events/types';
import { planAstralCast as planAstralCastPure, resolveCastSelection as resolveCastSelectionPure, shouldOfferRecast } from './astral';
import type { AstralCastMode } from './astral';
import { planRuneCast as planRuneCastPure, resolveGoverning as resolveGoverningPure, shouldOfferRecast as shouldOfferRuneRecast } from './runes';
import type { RuneCastMode } from './runes';
import type { RuneScatter } from './types';
import { deriveMandate, hexagramNudge, planHexagramResolution } from './iching';
import type { HexagramMode } from './iching';
import { planWeave, generateWeave, revealFrom } from './strings';
import { consolidatePath, pathCoherence } from '../data/strings';
import type { StringsMinigameState, StringsResult } from './types';
import { planDiceCheck, resolveCheck } from './dice';
import type { DiceCheckPlan, DiceCheckBreakdown } from './types';

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
  private pendingAdvance: (() => void) | null = null;
  private turnEffects: EffectReport[] = []; // per-turn accumulator of all reports (for RunRecord)

  constructor(minigamesPerTurn = 3) {
    this.minigamesPerTurn = minigamesPerTurn;
    this.bus = new EventBus();
    this.affinityEngine = new AffinityEngine(AFFINITY_DEFINITIONS);
    this.orchestrator = new TurnOrchestrator(this.bus);
    this.readingPlanner = new ReadingPlanner();
    this.narrativeAssembler = new NarrativeAssembler();
    this.responders = [...buildAffinityResponders(), ...buildInteractionResponders(), ...buildAstralResponders(), ...buildIChingResponders(), ...buildRuneResponders(), ...buildStringsResponders()];
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
      drawPhase: null,
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
      awaitingContinue: false,
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

  // ---------- Public accessors for debug panel ----------

  getReadingPlanner(): ReadingPlanner { return this.readingPlanner; }
  getNarrativeAssembler(): NarrativeAssembler { return this.narrativeAssembler; }

  /**
   * Compute a synthesis preview without consuming template rotation state.
   * Safe to call every render — snapshots and restores the assembler's rotation.
   */
  previewSynthesis(): import('./types').SynthesisResult | null {
    const results = this.state.turnResults;
    if (results.length === 0) return null;

    const rotSnapshot = this.narrativeAssembler.getRotationSnapshot();
    try {
      const question = this.state.questionType ?? 'self';
      const affinities = this.affinityEngine.getState();
      const aggregated = this.readingPlanner.aggregate(results, question);
      return this.narrativeAssembler.assemble(
        aggregated,
        results,
        question,
        affinities,
        this.affinityEngine.getEffects(),
      );
    } finally {
      this.narrativeAssembler.restoreRotation(rotSnapshot);
    }
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
    const queueBefore = this.state.eventQueue.length;

    const startDraft: PhaseDraft = { poolTarget: baseCount };
    const { reports: startReports } = this.dispatchAt('select:draw:start', startDraft);
    const target = (startDraft.poolTarget as number) ?? baseCount;

    const affinities = this.affinityEngine.getState();
    const pool = refill
      ? this.orchestrator.refillPool(this.state.questionType!, affinities, bias, target)
      : this.orchestrator.generatePool(this.state.questionType!, affinities, target);
    this.state.availableMethods = pool;

    // Render the drawn pool through the end-of-draw trigger (shrouding, etc.).
    const poolResults = pool.map((m) => ({ tags: [], type: m } as unknown as SlotResult));
    const { draft: endDraftPool, reports: endReports } = this.dispatchAt('select:draw:end', { pool: poolResults });
    this.state.shroudedMethods = Array.isArray(endDraftPool.shrouded)
      ? (endDraftPool.shrouded as number[])
      : [];

    // The draw-phase effects (widen/thin/shroud) are narrated INSIDE the card
    // spread by MethodSelect (EventBanner + in-spread animation), not by the
    // generic InteractionSequencer. Pull them back off the queue — they remain
    // in turnEffects (added by dispatchAt) for the RunRecord — and stash them,
    // ordered, on drawPhase for the UI to sequence.
    this.state.eventQueue = this.state.eventQueue.slice(0, queueBefore);
    this.state.drawPhase = {
      nonce: (this.state.drawPhase?.nonce ?? 0) + 1,
      effectReports: [...startReports, ...endReports],
      pendingSelection: null,
    };
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
    this.state.awaitingContinue = false;
    this.turnEffects = [];

    this.narrativeAssembler.resetRotation();

    this.buildPool();

    this.bus.emit('turn-started', { question, availableMethods: this.state.availableMethods });
    this.notify();
  }

  // Stage a selection: resolve Fate-force, stash a pendingSelection, but do NOT
  // transition — the card-draw UI plays the ascend / hand-of-fate / reveal, then
  // calls confirmSelection(). The fate-force report is diverted off eventQueue
  // (the FateForceOverlay narrates it) but stays in turnEffects for the record.
  beginSelection(index: number): void {
    if (!this.state.availableMethods[index]) {
      throw new Error(`Method index ${index} out of bounds`);
    }
    const queueBefore = this.state.eventQueue.length;
    const { draft, reports } = this.dispatchAt('select:pick', {
      methodIndex: index,
      methodPool: this.state.availableMethods,
    });
    const finalIndex = typeof draft.methodIndex === 'number' ? draft.methodIndex : index;
    const methodType = this.state.availableMethods[finalIndex];
    if (!methodType) {
      throw new Error(`Method index ${finalIndex} out of bounds`);
    }
    const forceReport = reports.find((r) => r.responderId === 'fate-force-method') ?? null;
    this.state.eventQueue = this.state.eventQueue.slice(0, queueBefore);

    const pending: import('./types').PendingSelection = {
      chosenIndex: index,
      finalIndex,
      method: methodType,
      wasForced: finalIndex !== index,
      shrouded: this.state.shroudedMethods.includes(finalIndex),
      forceReport,
    };
    this.state.drawPhase = {
      nonce: this.state.drawPhase?.nonce ?? 0,
      effectReports: this.state.drawPhase?.effectReports ?? [],
      pendingSelection: pending,
    };
    this.notify();
  }

  // Complete a staged selection: transition to the minigame for the (possibly
  // Fate-redirected) method. No-op without a pendingSelection.
  confirmSelection(): void {
    const pending = this.state.drawPhase?.pendingSelection;
    if (!pending) return;
    this.state.selectedMethod = pending.method;
    this.state.activeSlotIndex = null;
    this.state.screen = 'minigame';
    this.state.drawPhase = null;
    if (pending.method === 'tarot') {
      this.startTarotDraft(); // notifies
    } else if (pending.method === 'strings') {
      this.startWeave(); // notifies
    }
    this.notify();
  }

  // Synchronous convenience used by tests and any non-animated caller. Preserves
  // the original contract: after this returns, screen === 'minigame'.
  selectMethod(index: number): void {
    this.beginSelection(index);
    this.confirmSelection();
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

    // Strings coherence feeds (mirrors the tarot spread-coherence rule).
    if (result.type === 'strings') {
      const coh = pathCoherence((result as StringsResult).path);
      if (coh === 'coherent') this.affinityEngine.shift('order', 6, 'strings-coherent');
      else if (coh === 'tangled') this.affinityEngine.shift('chaos', 6, 'strings-tangled');
    }

    // Player-action feeds derived from how this result was reached.
    if (meta) {
      if (meta.reversed) this.affinityEngine.applyAction('reverse');
      else if (meta.revealedAsDrawn) this.affinityEngine.applyAction('reveal-as-drawn');
      if (meta.viaReroll) this.affinityEngine.applyAction('take-reroll');
    }

    // I Ching: one-time nudge (direct shifts) THEN set the lingering Mandate of
    // Change. The nudge runs BEFORE setMandate so its shifts are not scaled by
    // the freshly-set mandate — the mandate only affects FUTURE commits.
    if (result.type === 'iching') {
      const gov = result as IChingResult;
      for (const [id, delta] of hexagramNudge(gov)) {
        this.affinityEngine.shift(id, delta, `iching-nudge:${gov.hexagramNumber}`);
      }
      this.affinityEngine.setMandate(deriveMandate(gov));
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
      // Anchor the reroll animation to the rerolled die's fan slot so the fan
      // expands to it and the recast plays on the real card (not the dice board,
      // which has already advanced by the time the deferred sequencer runs).
      this.state.eventQueue = this.state.eventQueue.map((r) =>
        r.responderId === 'fool-reroll' ? { ...r, targetSlot: committedIndex } : r,
      );
    }

    // Chaos surge: spawn a second result of the same type.
    if (typeof draft.spawnSecond === 'string') {
      const affinities = this.affinityEngine.getState();
      const second = this.orchestrator.drawSingleResult(
        draft.spawnSecond as 'tarot' | 'd20' | 'iching' | 'astral' | 'rune' | 'strings',
        affinities,
        this.state.questionType ?? undefined,
      );
      this.state.turnResults = [...this.state.turnResults, second];
      const newIndex = this.state.turnResults.length - 1;
      // The responder cannot know the post-append index; patch its queued report
      // so the animation can spotlight the new fan slot.
      this.state.eventQueue = this.state.eventQueue.map((r) =>
        r.responderId === 'chaos-second-result' ? { ...r, targetSlot: newIndex } : r,
      );
    }

    // Shadow veil: the responder marked one spread position `veiled` on the
    // committed card but cannot know that card's fan-slot index. Patch its queued
    // report so the veil animation anchors to — and the fan expands to — the
    // committed card, where the concealed sigil now renders.
    this.state.eventQueue = this.state.eventQueue.map((r) =>
      r.responderId === 'shadow-veil-position' ? { ...r, targetSlot: committedIndex } : r,
    );

    // Commit/spread effects that act on the just-committed card → anchor to its
    // fan slot so the fan expands and the animation plays on the real card.
    // These responders fire at *:commit (interactions + spread-internal combine)
    // and cannot know their own post-append fan index. (Leave `mirror` alone —
    // it already carries target/source fan indices.)
    const COMMIT_ANCHORED = new Set([
      'critical-resonance', 'spread-cascade', 'spread-aligned',
      'suit-accord', 'elemental-clash', 'major-convergence',
      'iching-resonant-change',
    ]);
    this.state.eventQueue = this.state.eventQueue.map((r) =>
      COMMIT_ANCHORED.has(r.responderId) && typeof r.targetSlot !== 'number'
        ? { ...r, targetSlot: committedIndex } : r,
    );

    this.bus.emit('minigame-complete', { result, completed });

    // Resolve-first, narrate-second, then hold a review beat: store the real
    // advance and (once any event batch drains) show the Continue gate instead
    // of advancing. continueAfterReview() runs the stored advance.
    this.pendingAdvance = () => this.advanceAfterCommit(result, completed);
    this.runOrDefer(() => this.showReviewBeat());
  }

  private advanceAfterCommit(result: SlotResult, completed: number): void {
    // Decay the Mandate of Change once per completed minigame. No-op the commit
    // that SET it (mandateFresh), so the immediate next reading feels the full
    // mandate; each later commit weakens it toward 1.0.
    this.affinityEngine.decayMandate();

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
    this.orchestrator.removeUsedMethod(result.type as 'tarot' | 'd20' | 'iching' | 'astral' | 'rune' | 'strings');
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

  // Hold on the committed/revealed minigame view until the player clicks Continue.
  private showReviewBeat(): void {
    this.state.awaitingContinue = true;
    this.notify();
  }

  continueAfterReview(): void {
    if (!this.state.awaitingContinue) return;
    this.state.awaitingContinue = false;
    const advance = this.pendingAdvance;
    this.pendingAdvance = null;
    if (advance) advance();
    else this.notify();
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

  planAstralCast(): { mode: AstralCastMode; offerRecast: boolean; sources: string[] } {
    const affinities = this.affinityEngine.getState();
    return planAstralCastPure(affinities, shouldOfferRecast(affinities));
  }

  resolveCastSelection(casts: AstralCast[], mode: AstralCastMode): { chosen: AstralCast; index: 0 | 1; auto: boolean } {
    return resolveCastSelectionPure(casts, mode);
  }

  planRuneCast(): { mode: RuneCastMode; drift: number; offerRecast: boolean; sources: string[] } {
    const affinities = this.affinityEngine.getState();
    return planRuneCastPure(affinities, shouldOfferRuneRecast(affinities));
  }

  resolveGoverning(scatter: RuneScatter, mode: RuneCastMode): number {
    return resolveGoverningPure(scatter, mode);
  }

  // Resolves the I Ching transformation fork (willed/fated/unaligned) from the
  // current affinities and whether the drawn cast has changing lines. Pure read.
  planHexagramCast(hasChangingLines: boolean): { mode: HexagramMode; offerRecast: boolean } {
    return planHexagramResolution(this.affinityEngine.getState(), hasChangingLines);
  }

  // Runs chaos/order line-mutation responders against a consolidated IChingResult
  // before it is committed. Chaos may add a changing line; Order may remove one.
  // Returns the (possibly mutated) result AND the EffectReports so the minigame
  // can narrate them inline at the transform beat rather than at commit time.
  // The reports are stripped from eventQueue here (they stay in turnEffects for
  // the RunRecord); the caller is responsible for displaying them.
  runHexagramTransform(result: IChingResult): { result: IChingResult; reports: EffectReport[] } {
    const before = this.state.eventQueue.length;
    const { draft, reports } = this.dispatchAt('iching:transform', { outcome: result });
    // Narrated inline by the minigame's transform beat — keep them out of the
    // commit-time queue (they stay in turnEffects for the run record).
    if (reports.length > 0) this.state.eventQueue = this.state.eventQueue.slice(0, before);
    return { result: (draft.outcome as IChingResult) ?? result, reports };
  }

  // Fate may seize the spread-wide orientation before the player chooses. Rolled
  // pre-commit so TarotMinigame can suppress the Reveal/Invert buttons and play
  // the god-hand. Returns the decided orientation, or null when the player keeps
  // the choice. fate-auto-orient emits no report, so nothing reaches the queue.
  // NOTE: no notify() here — planReveal mutates no persistent state; calling
  // notify() would deep-clone state, giving minigameState a new object identity
  // and re-running the preempt useEffect, which clears the still-pending timers
  // (soft-lock: god-hand appears but commitDraft never fires).
  planReveal(): { preempt: boolean; orientation: 'upright' | 'reversed' | null } {
    const { draft } = this.dispatchAt('tarot:reveal', {});
    const orientation = (draft.fateOrientation as 'upright' | 'reversed' | undefined) ?? null;
    return { preempt: orientation !== null, orientation };
  }

  // Resolves every active roll modifier into one plan for the dice minigame.
  planDiceRoll(): {
    mode: RollMode; offerReroll: boolean;
    dc: number; bless: number; bane: number; sources: string[];
    reports: EffectReport[];
  } {
    const { draft, reports } = this.dispatchAt('dice:roll', { rollMods: [], outcome: undefined });
    // DC + Bless/Bane from the slots already committed this turn (the active dice
    // slot is not appended until completeMinigame, so turnResults == prior slots).
    const check = planDiceCheck(this.state.turnResults);
    this.notify();
    return {
      mode: draft.rollMode ?? 'single',
      offerReroll: draft.offerReroll ?? false,
      dc: check.dc, bless: check.bless, bane: check.bane, sources: check.sources,
      reports,
    };
  }

  // Resolve a thrown d20 against its check plan: rolls the Bless/Bane d4s and
  // returns the committed-shaped result plus the breakdown for the tally UI.
  resolveDiceCheck(d20: number, plan: DiceCheckPlan): { result: DiceResult; breakdown: DiceCheckBreakdown } {
    return resolveCheck(d20, plan);
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

  // ── Strings of Fate Minigame ──

  startWeave(): void {
    const affinities = this.affinityEngine.getState();
    const plan = planWeave(affinities);
    const graph = generateWeave(this.state.questionType ?? 'self', plan, Math.random);
    const originId = graph.originId;
    const { candidateIds, veiledCandidateIds, lookAheadIds } = revealFrom(graph, plan, originId);
    const weave: StringsMinigameState = {
      method: 'strings',
      graph,
      plan,
      visitedPath: [originId],
      activeId: originId,
      candidateIds,
      veiledCandidateIds,
      lookAheadIds,
      revealedIds: [...new Set([originId, ...candidateIds, ...veiledCandidateIds, ...lookAheadIds])],
      foresightId: null,
      backtracksRemaining: plan.backtracks,
      redrawUsed: false,
      phase: 'drawing',
      committed: false,
    };
    this.state.minigameState = weave;
    this.dispatchAt('strings:start', {});
    this.notify();
  }

  stepTo(nodeId: string): void {
    const w = this.state.minigameState;
    if (!w || w.method !== 'strings') throw new Error('No active weave');
    if (w.phase !== 'drawing') throw new Error('Weave already arrived');
    if (!w.candidateIds.includes(nodeId)) throw new Error(`Node ${nodeId} is not a current candidate`);

    const byId = new Map(w.graph.nodes.map((n) => [n.id, n]));
    const hasForwardAfter = byId.get(nodeId)!.band < w.graph.bandCount - 1;

    // strings:pick — Chaos/Fate may redirect (OVERRIDE); Fate may add a foregone step (SPAWN).
    const { draft } = this.dispatchAt('strings:pick', {
      chosenId: nodeId,
      candidateIds: [...w.candidateIds],
      hasForwardAfter,
    });
    const finalId = typeof draft.redirectTo === 'string' && w.candidateIds.includes(draft.redirectTo)
      ? draft.redirectTo : nodeId;

    const usedForesight = w.foresightId !== null;
    this.advanceWeave(w, finalId);

    // Affinity feed for accepting the step.
    if (!usedForesight) {
      if (w.plan.clarity === 'silhouette') this.affinityEngine.applyAction('embrace-mystery'); // blind → Shadow
      else this.affinityEngine.applyAction('reveal-as-drawn');                                  // hinted → Fate
    }
    w.foresightId = null;

    // Fate foregone step: weave one more automatically along a candidate edge.
    if (draft.foregoneStep === true && w.phase === 'drawing' && w.candidateIds.length > 0) {
      const auto = w.candidateIds[Math.floor(Math.random() * w.candidateIds.length)];
      this.advanceWeave(w, auto);
    }

    this.notify();
  }

  private advanceWeave(w: StringsMinigameState, nodeId: string): void {
    const byId = new Map(w.graph.nodes.map((n) => [n.id, n]));
    w.visitedPath = [...w.visitedPath, nodeId];
    w.activeId = nodeId;
    if (byId.get(nodeId)!.band === w.graph.bandCount - 1) {
      w.phase = 'arrived';
      w.candidateIds = [];
      w.veiledCandidateIds = [];
      w.lookAheadIds = [];
      return;
    }
    const r = revealFrom(w.graph, w.plan, nodeId);
    w.candidateIds = r.candidateIds;
    w.veiledCandidateIds = r.veiledCandidateIds;
    w.lookAheadIds = r.lookAheadIds;
    w.revealedIds = [...new Set([...w.revealedIds, nodeId, ...r.candidateIds, ...r.veiledCandidateIds, ...r.lookAheadIds])];
  }

  backtrack(): void {
    const w = this.state.minigameState;
    if (!w || w.method !== 'strings') throw new Error('No active weave');
    if (w.phase !== 'drawing') throw new Error('Cannot backtrack after arrival');
    if (w.backtracksRemaining <= 0 || w.visitedPath.length <= 1) throw new Error('No backtrack available');
    const prev = w.visitedPath[w.visitedPath.length - 2];
    w.visitedPath = w.visitedPath.slice(0, -1);
    w.activeId = prev;
    const r = revealFrom(w.graph, w.plan, prev);
    w.candidateIds = r.candidateIds;
    w.veiledCandidateIds = r.veiledCandidateIds;
    w.lookAheadIds = r.lookAheadIds;
    w.backtracksRemaining -= 1;
    this.affinityEngine.applyAction('take-reroll'); // Will
    this.notify();
  }

  redrawCandidates(): void {
    const w = this.state.minigameState;
    if (!w || w.method !== 'strings') throw new Error('No active weave');
    if (w.phase !== 'drawing') throw new Error('Cannot redraw after arrival');
    if (!w.plan.allowRedraw || w.redrawUsed) throw new Error('No redraw available');
    const r = revealFrom(w.graph, w.plan, w.activeId, Math.random); // rng → reshuffled subset
    w.candidateIds = r.candidateIds;
    w.veiledCandidateIds = r.veiledCandidateIds;
    w.lookAheadIds = r.lookAheadIds;
    w.revealedIds = [...new Set([...w.revealedIds, ...r.candidateIds, ...r.veiledCandidateIds, ...r.lookAheadIds])];
    w.redrawUsed = true;
    this.affinityEngine.applyAction('take-reroll'); // Will
    this.notify();
  }

  useForesight(nodeId: string): void {
    const w = this.state.minigameState;
    if (!w || w.method !== 'strings') throw new Error('No active weave');
    if (!w.plan.foresight) throw new Error('Foresight unavailable');
    if (!w.candidateIds.includes(nodeId)) throw new Error('Not a candidate');
    w.foresightId = nodeId;
    this.affinityEngine.applyAction('use-peek'); // Light
    this.notify();
  }

  commitWeave(): void {
    const w = this.state.minigameState;
    if (!w || w.method !== 'strings') throw new Error('No active weave');
    if (w.phase !== 'arrived') throw new Error('Weave has not reached a destination');
    if (w.committed) return; // idempotent: a repeated click must not commit a second copy
    w.committed = true;
    const byId = new Map(w.graph.nodes.map((n) => [n.id, n]));
    const path = w.visitedPath.map((id) => byId.get(id)!);
    this.completeMinigame(consolidatePath(path));
  }

  pickForHand(handIndex: number, tableIndex: number): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    if (draft.hand[handIndex] !== null) throw new Error(`Hand slot ${handIndex} already filled`);
    if (handIndex < 0 || handIndex > 2) throw new Error(`Invalid hand index: ${handIndex}`);
    if (tableIndex < 0 || tableIndex >= draft.table.length) throw new Error(`Invalid table index: ${tableIndex}`);

    const slot = draft.table[tableIndex];
    if (!slot) throw new Error(`Table slot ${tableIndex} is empty`);

    const originalCardId = slot.cardId;

    const handCard: HandCard = {
      cardId: originalCardId,
      tableOriginIndex: slot.originIndex,
      peeked: false,
    };
    draft.hand[handIndex] = handCard;
    draft.table[tableIndex] = null;

    // Dispatch tarot:picked so fate-fated-card responder can intercept
    const queueBefore = this.state.eventQueue.length;
    const { draft: dispatchedDraft } = this.dispatchAt('tarot:picked', {
      handIndex,
      tableIndex,
      fatedDrawnThisDraft: draft.fatedDrawnThisDraft,
      usedCardIds: [
        originalCardId,
        ...draft.hand.filter((h): h is HandCard => h !== null).map((h) => h.cardId),
        ...draft.table.filter((t): t is TableCard => t !== null).map((t) => t.cardId),
      ],
    });

    // Apply fated substitution if responder fired
    if (typeof dispatchedDraft.fatedHandIndex === 'number'
        && dispatchedDraft.fatedHandIndex === handIndex
        && typeof dispatchedDraft.fatedCardId === 'string') {
      handCard.cardId = dispatchedDraft.fatedCardId;
      handCard.fated = true;
      draft.fatedDrawnThisDraft = true;

      // Return the original table card to the deck (shuffled)
      draft.deck.push(originalCardId);
      for (let i = draft.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [draft.deck[i], draft.deck[j]] = [draft.deck[j], draft.deck[i]];
      }

      // The fated draw is narrated inline by TarotMinigame's Fate god-hand (it
      // reads handCard.fated), so keep this report out of the InteractionSequencer
      // — strip it from the queue but leave it in turnEffects for the run record.
      this.state.eventQueue = this.state.eventQueue.slice(0, queueBefore);
    }

    this.notify();
  }

  returnToTable(handIndex: number): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    const handCard = draft.hand[handIndex];
    if (!handCard) throw new Error(`Hand slot ${handIndex} is empty`);
    if (handCard.fated) throw new Error('Cannot return a fated card to the table');

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
    if (handCard.fated) throw new Error('Cannot return a fated card to the deck');

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
    const cardA = draft.hand[a];
    const cardB = draft.hand[b];
    if (cardA?.fated) throw new Error('Cannot swap a fated card');
    if (cardB?.fated) throw new Error('Cannot swap a fated card');
    [draft.hand[a], draft.hand[b]] = [cardB, cardA];
    this.dispatchAt('tarot:swapped', { a, b });
    this.notify();
  }

  commitDraft(reverse: boolean = false): void {
    const draft = this.state.minigameState as TarotDraftState | null;
    if (!draft || draft.method !== 'tarot') throw new Error('No active tarot draft');
    if (draft.hand.some((h) => h === null)) throw new Error('Hand is not full');

    draft.phase = 'committing';

    const fated: boolean[] = draft.hand.map((h) => h!.fated === true);
    let faces = draft.hand.map((h) => {
      if (h!.revealedFace) return h!.revealedFace;
      return buildFace(DECK_BY_ID[h!.cardId], pickOrientation(this.affinityEngine.getState()));
    });

    // Deal-swap: Fate may replace one non-fated face before reveal.
    const dealBefore = this.state.eventQueue.length;
    const { draft: dealDraft } = this.dispatchAt('tarot:deal', {
      faces: faces as unknown as SlotResult[],
      fated,
    });
    faces = (dealDraft.faces as unknown as TarotCardFace[]) ?? faces;
    if (typeof dealDraft.swappedIndex === 'number' && typeof dealDraft.swapFromCardId === 'string') {
      draft.revealSwap = { index: dealDraft.swappedIndex, fromCardId: dealDraft.swapFromCardId };
    }
    // Narrated inline by the reveal — keep the report out of the sequencer queue
    // (it stays in turnEffects for the run record).
    this.state.eventQueue = this.state.eventQueue.slice(0, dealBefore);

    // Existing pre-consolidation hook.
    this.dispatchAt('tarot:committed', { faces: faces as unknown as SlotResult[], reverse });

    let result = consolidateSpread(faces);
    if (reverse) result = reverseSpread(result);

    // Orient post-modifiers: Chaos flips one face; Order straightens all.
    const orientBefore = this.state.eventQueue.length;
    const { draft: orientDraft } = this.dispatchAt('tarot:orient', { outcome: result });
    result = (orientDraft.outcome as TarotResult) ?? result;
    if (typeof orientDraft.wildCardIndex === 'number') draft.revealWildCard = orientDraft.wildCardIndex;
    if (orientDraft.orderAnchored === true) draft.revealOrderAnchored = true;
    this.state.eventQueue = this.state.eventQueue.slice(0, orientBefore);

    const meta: MinigameMeta = reverse ? { reversed: true } : { revealedAsDrawn: true };
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

    // Preserve debug state across scenario load
    const { debug, debugConfig } = this.state;

    // Reset to a fresh game, then stage the scenario.
    this.affinityEngine.setState(defaultAffinityState());
    this.state = this.defaultState();

    // Restore debug state
    this.state.debug = debug;
    this.state.debugConfig = debugConfig;

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
    this.state.drawPhase = null;
    this.state.selectedMethod = null;
    this.state.turnResults = [];
    this.state.minigamesCompleted = 0;
    this.state.activeSlotIndex = null;
    this.state.minigameState = null;
    this.state.synthesis = null;
    this.state.happening = null;
    this.state.selectedHappeningChoice = null;
    this.state.eventQueue = [];
    this.state.awaitingContinue = false;
    this.turnEffects = [];
    this.notify();
  }

  returnToTitle(): void {
    // Preserve debug state
    const { debug, debugConfig } = this.state;

    const saved = {
      affinities: this.affinityEngine.getState(),
      history: this.state.history,
      usedHappeningIds: Array.from(this.usedHappeningIds),
    };
    this.state = this.defaultState();

    // Restore debug state
    this.state.debug = debug;
    this.state.debugConfig = debugConfig;
    this.affinityEngine.setState(saved.affinities);
    this.state.affinities = this.affinityEngine.getState();
    this.state.history = saved.history;
    this.usedHappeningIds = new Set(saved.usedHappeningIds);
    this.bus.clear();
    this.saveToStorage();
    this.notify();
  }

  reset(): void {
    // Preserve debug state
    const { debug, debugConfig } = this.state;

    const affinities = this.affinityEngine.getState();
    const history = this.state.history;
    const usedIds = Array.from(this.usedHappeningIds);
    this.state = this.defaultState();

    // Restore debug state
    this.state.debug = debug;
    this.state.debugConfig = debugConfig;
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
