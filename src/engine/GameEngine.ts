import type { GameState, QuestionType, AffinityId, AffinityBand, MinigameMeta, SlotResult, TarotResult, RunRecord, PendingEffect, InteractionEvent } from './types';
import { EventBus } from './EventBus';
import { TagSystem } from './TagSystem';
import { AffinityEngine } from './AffinityEngine';
import { TurnOrchestrator } from './TurnOrchestrator';
import { InteractionResolver } from './InteractionResolver';
import { ReadingPlanner } from './ReadingPlanner';
import { NarrativeAssembler } from './NarrativeAssembler';
import { AFFINITY_DEFINITIONS, defaultAffinityState, BAND_ORDER, BAND_POWER_STEP, TIER_BASE_CHANCE } from '../data/affinities';
import { INTERACTION_RULES } from '../data/interactions';
import { selectHappening } from '../data/happenings';
import { loadScenario, SCENARIO_PRESETS } from './scenarios';

const STORAGE_KEY = 'fate-atlas-save';

export class GameEngine {
  private bus: EventBus;
  private tagSystem: TagSystem;
  private affinityEngine: AffinityEngine;
  private orchestrator: TurnOrchestrator;
  private interactionResolver: InteractionResolver;
  private readingPlanner: ReadingPlanner;
  private narrativeAssembler: NarrativeAssembler;

  private state: GameState;
  private cachedSnapshot: GameState;
  private listeners = new Set<(state: GameState) => void>();
  private usedHappeningIds = new Set<string>();
  private minigamesPerTurn: number;

  constructor(minigamesPerTurn = 3) {
    this.minigamesPerTurn = minigamesPerTurn;
    this.bus = new EventBus();
    this.tagSystem = new TagSystem();
    this.affinityEngine = new AffinityEngine(AFFINITY_DEFINITIONS);
    this.orchestrator = new TurnOrchestrator(this.bus);
    this.interactionResolver = new InteractionResolver(this.tagSystem, this.bus);
    this.readingPlanner = new ReadingPlanner();
    this.narrativeAssembler = new NarrativeAssembler();
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
      interactionApplied: false,
      minigameState: null,
      pendingEffects: [],
      interactionQueue: [],
      pendingHappening: false,
      interactions: [],
      synthesis: null,
      happening: null,
      selectedHappeningChoice: null,
      history: [],
      eventLog: [],
      chainDepth: 0,
      debug: false,
      debugForcedEffect: null,
      affinityEffects: {
        handSize: 3, methodCount: 3, hintClarity: 0,
        readingDetail: 0, poolPreview: 'none', peekAvailable: false,
      },
    };
  }

  private notify(): void {
    this.state.affinities = this.affinityEngine.getState();
    this.state.affinityEffects = this.affinityEngine.getEffects();
    this.state.eventLog = this.bus.getHistory();
    this.cachedSnapshot = JSON.parse(JSON.stringify(this.state)) as GameState;
    this.listeners.forEach((fn) => fn(this.cachedSnapshot));
  }

  // ---------- Turn lifecycle ----------

  startTurn(question: QuestionType): void {
    this.affinityEngine.beginRun();
    const affinities = this.affinityEngine.getState();
    const availableMethods = this.orchestrator.generatePool(
      question, affinities, this.affinityEngine.getEffects().methodCount,
    );

    // Decrement turnsRemaining on all pending effects; remove expired
    this.state.pendingEffects = this.state.pendingEffects
      .map((e) => ({ ...e, turnsRemaining: e.turnsRemaining - 1 }))
      .filter((e) => e.turnsRemaining > 0);

    this.state.screen = 'method-select';
    this.state.questionType = question;
    this.state.availableMethods = availableMethods;
    this.state.selectedMethod = null;
    this.state.turnResults = [];
    this.state.minigamesCompleted = 0;
    this.state.activeSlotIndex = null;
    this.state.interactionApplied = false;
    this.state.minigameState = null;
    this.state.interactionQueue = [];
    this.state.pendingHappening = false;
    this.state.interactions = [];
    this.state.synthesis = null;
    this.state.happening = null;
    this.state.selectedHappeningChoice = null;
    this.state.chainDepth = 0;

    this.narrativeAssembler.resetRotation();

    this.bus.emit('turn-started', { question, availableMethods });
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
    // Canonical index of the just-committed result. NOTE: not `completed - 1`,
    // which diverges from the array index after a `second-result` append.
    const committedIndex = this.state.turnResults.length - 1;
    this.state.activeSlotIndex = committedIndex;
    const completed = this.state.minigamesCompleted + 1;
    this.state.minigamesCompleted = completed;

    // Apply affinities from the result (Chaos/Order tag feeds, routed through shift)
    if (result.type !== 'happening') {
      this.affinityEngine.applyResultTags(result);
      this.maybeWildSurge(result);
    }

    // Player-action feeds derived from how this result was reached.
    if (meta) {
      if (meta.reversed) this.affinityEngine.applyAction('reverse');
      else if (meta.revealedAsDrawn) this.affinityEngine.applyAction('reveal-as-drawn');
      if (meta.viaReroll) this.affinityEngine.applyAction('take-reroll');
    }

    // Check pending effects against this result
    const { matched, remaining } = this.interactionResolver.checkPendingEffects(
      this.state.pendingEffects,
      result,
    );
    this.state.pendingEffects = remaining;

    // Build interaction events from matched pending effects
    const interactionEvents: InteractionEvent[] = matched.map((effect) => ({
      ruleId: effect.id,
      sourceSlotIndex: effect.sourceSlotIndex,
      targetSlotIndex: committedIndex,
      effect: effect.action,
      description: effect.description,
    }));
    this.state.interactions = [...this.state.interactions, ...interactionEvents];

    // Create new pending effects from this result's tags
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newEffects = this.interactionResolver.createPendingEffects(
      result,
      runId,
      INTERACTION_RULES,
      committedIndex,
    );
    this.state.pendingEffects = [...this.state.pendingEffects, ...newEffects];

    // Push interaction events onto the queue
    if (interactionEvents.length > 0) {
      this.state.interactionQueue = [
        ...this.state.interactionQueue,
        ...interactionEvents,
      ];
    }

    // If queue is non-empty, freeze current screen — sequencer overlays on top
    // and handles advancing. The minigame stays mounted so dice/cards remain visible.
    if (this.state.interactionQueue.length > 0) {
      this.bus.emit('minigame-complete', { result, completed, interactions: interactionEvents });
      this.notify();
      return;
    }

    // No interactions queued — proceed with normal screen transition
    if (completed >= this.minigamesPerTurn) {
      this.synthesizeAll();
      this.buildRunRecord();
      this.state.screen = 'result';
      this.saveToStorage();
    } else {
      this.orchestrator.removeUsedMethod(result.type as 'tarot' | 'd20' | 'iching');

      if (this.maybeHappeningInterrupt()) {
        this.triggerHappening();
        return;
      } else {
        const affinities = this.affinityEngine.getState();
        const gaps = this.readingPlanner.analyzeGaps(this.state.turnResults);
        const bias = this.readingPlanner.getBiasForRefill(gaps);
        this.state.availableMethods = this.orchestrator.refillPool(
          this.state.questionType!,
          affinities,
          bias,
        );
        this.state.screen = 'method-select';
        this.state.selectedMethod = null;
      }
    }

    this.bus.emit('minigame-complete', { result, completed, interactions: interactionEvents });
    this.notify();
  }

  // Apply the head interaction's effect while the minigame is still mounted
  // (called by the sequencer at its reveal step). Does not dequeue or change
  // the screen; the guard makes repeat calls safe.
  applyHeadInteraction(): void {
    if (this.state.interactionQueue.length === 0) return;
    if (this.state.interactionApplied) return;
    this.executeEffect(this.state.interactionQueue[0]);
    this.state.interactionApplied = true;
    this.notify();
  }

  advanceInteractionQueue(): void {
    if (this.state.interactionQueue.length === 0) return;

    const completed = this.state.interactionQueue[0];
    // The effect is normally applied earlier at the sequencer's reveal step;
    // apply here only if that didn't happen (e.g. a fast tap skipped the beat).
    if (!this.state.interactionApplied) {
      this.executeEffect(completed);
    }
    this.state.interactionApplied = false;
    this.state.interactionQueue = this.state.interactionQueue.slice(1);

    if (this.state.interactionQueue.length > 0) {
      // More interactions waiting — stay frozen, sequencer plays next
      this.notify();
      return;
    }

    // Queue drained — resolve pending screen transition
    if (this.state.pendingHappening) {
      this.state.pendingHappening = false;
      this.triggerHappening();
      return;
    }

    if (this.state.minigamesCompleted >= this.minigamesPerTurn) {
      this.synthesizeAll();
      this.buildRunRecord();
      this.state.screen = 'result';
      this.saveToStorage();
    } else {
      const affinities = this.affinityEngine.getState();
      const gaps = this.readingPlanner.analyzeGaps(this.state.turnResults);
      const bias = this.readingPlanner.getBiasForRefill(gaps);
      this.state.availableMethods = this.orchestrator.refillPool(
        this.state.questionType!,
        affinities,
        bias,
        this.affinityEngine.getEffects().methodCount,
      );
      this.state.screen = 'method-select';
      this.state.selectedMethod = null;
    }
    this.notify();
  }

  private executeEffect(event: InteractionEvent): void {
    const targetIndex = event.targetSlotIndex;
    const target = this.state.turnResults[targetIndex];
    if (!target) return;

    const affinities = this.affinityEngine.getState();

    switch (event.effect) {
      case 'reroll': {
        if (target.type === 'd20') {
          const newResult = this.orchestrator.drawSingleResult('d20', affinities);
          this.state.turnResults = [
            ...this.state.turnResults.slice(0, targetIndex),
            newResult,
            ...this.state.turnResults.slice(targetIndex + 1),
          ];
        }
        break;
      }
      case 'flip': {
        if (target.type === 'tarot') {
          this.state.turnResults = this.state.turnResults.map((r, i) =>
            i === targetIndex && r.type === 'tarot'
              ? {
                  ...r,
                  orientation: r.orientation === 'upright' ? 'reversed' as const : 'upright' as const,
                }
              : r,
          );
        }
        break;
      }
      case 'mirror': {
        const sourceIndex = event.sourceSlotIndex;
        this.state.turnResults = this.state.turnResults.map((r, i) => {
          if ((i === targetIndex || i === sourceIndex) && r.type === 'tarot') {
            return {
              ...r,
              orientation: r.orientation === 'upright' ? 'reversed' as const : 'upright' as const,
            };
          }
          return r;
        });
        break;
      }
      case 'add-choice': {
        if (this.state.happening && this.state.happening.choices.length > 0) {
          const bonusChoice = {
            text: 'A hidden path emerges — ' + this.state.happening.choices[0].text,
            affinityChanges: { chaos: 5 },
          };
          this.state.happening = {
            ...this.state.happening,
            choices: [...this.state.happening.choices, bonusChoice],
          };
        }
        break;
      }
      case 'second-result': {
        if (target.type !== 'happening') {
          const secondResult = this.orchestrator.drawSingleResult(
            target.type as 'tarot' | 'd20' | 'iching',
            affinities,
          );
          this.state.turnResults = [...this.state.turnResults, secondResult];
        }
        break;
      }
      default:
        // Unknown effect type — should not happen with proper typing
        break;
    }
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

    // Aggregate all results
    const aggregated = this.readingPlanner.aggregate(results, question);

    // Assemble narrative
    const synthesisResult = this.narrativeAssembler.assemble(
      aggregated,
      results,
      question,
      affinities,
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

    // Apply affinity changes from chosen option through the shift pipeline.
    for (const [id, delta] of Object.entries(choice.affinityChanges)) {
      this.affinityEngine.shift(id as AffinityId, delta as number, `happening:${this.state.happening.id}`);
    }

    this.state.selectedHappeningChoice = choiceIndex;
    this.state.affinities = this.affinityEngine.getState();

    // Happening resolved — return to method select for the next minigame
    this.state.screen = 'method-select';
    this.state.selectedMethod = null;
    this.state.happening = null;
    this.state.selectedHappeningChoice = null;

    this.bus.emit('happening-resolved', { choiceIndex });

    // Refill pool for next minigame (the used method was already removed)
    const affinities = this.affinityEngine.getState();
    this.state.availableMethods = this.orchestrator.refillPool(
      this.state.questionType!,
      affinities,
      {},
      this.affinityEngine.getEffects().methodCount,
    );

    this.saveToStorage();
    this.notify();
  }

  // ---------- Event-resolved affinity decisions ----------

  // Returns true if the named effect should fire now: guaranteed when the debug
  // flag names it (flag then clears), otherwise band-gated × base chance.
  private forcedOrRoll(
    effectId: string,
    affinity: AffinityId,
    minBand: AffinityBand,
    baseChance: number,
  ): boolean {
    if (this.state.debugForcedEffect === effectId) {
      this.state.debugForcedEffect = null;
      return true;
    }
    const band = this.affinityEngine.resolveBand(affinity);
    const idx = BAND_ORDER.indexOf(band);
    const minIdx = BAND_ORDER.indexOf(minBand);
    if (idx < minIdx) return false;
    const scaled = baseChance * (1 + (idx - minIdx) * BAND_POWER_STEP);
    return Math.random() < Math.min(1, scaled);
  }

  // Chaos-Dominant wild surge: a committed result can spawn a second (Major, ~8%).
  maybeWildSurge(result: SlotResult): boolean {
    if (result.type === 'happening') return false;
    if (!this.forcedOrRoll('wild-surge', 'chaos', 'dominant', 0.08)) return false;
    const affinities = this.affinityEngine.getState();
    const second = this.orchestrator.drawSingleResult(
      result.type as 'tarot' | 'd20' | 'iching',
      affinities,
    );
    this.state.turnResults = [...this.state.turnResults, second];
    this.bus.emit('minigame-complete', { result: second, wildSurge: true });
    this.notify(); // snapshot contract: surfacing the appended result + cleared flag
    return true;
  }

  // Chaos-Dominant happening interrupt (Major); folds in the prior frequency roll.
  maybeHappeningInterrupt(): boolean {
    if (this.state.debugForcedEffect === 'happening-interrupt') {
      this.state.debugForcedEffect = null;
      this.notify(); // snapshot contract: surfacing the cleared flag
      return true;
    }
    const chaos = this.affinityEngine.getState().chaos;
    if (chaos < 40) return false;
    return Math.random() < (chaos / 100) * 0.5;
  }

  // ---------- Agency (Fate/Will) decisions ----------

  // Will-gated: should a "Reroll?" prompt be offered after the player's action?
  offerReroll(): boolean {
    return this.forcedOrRoll('offer-reroll', 'will', 'stirring', TIER_BASE_CHANCE.notable);
  }

  // Player takes an offered reroll. Feeds Will. Fate may make it hollow (same result).
  takeReroll(): { hollow: boolean } {
    this.affinityEngine.applyAction('take-reroll');
    const idx = this.state.activeSlotIndex;
    if (idx === null) { this.notify(); return { hollow: false }; }
    const target = this.state.turnResults[idx];
    if (!target || target.type === 'happening') { this.notify(); return { hollow: false }; }

    const hollow = this.forcedOrRoll('hollow-reroll', 'fate', 'ascendant', TIER_BASE_CHANCE.major);
    if (hollow) {
      this.notify(); // snapshot contract: cleared forced flag / Will feed surfaced
      return { hollow: true };
    }
    const affinities = this.affinityEngine.getState();
    const fresh = this.orchestrator.drawSingleResult(
      target.type as 'tarot' | 'd20' | 'iching',
      affinities,
    );
    this.state.turnResults = [
      ...this.state.turnResults.slice(0, idx),
      fresh,
      ...this.state.turnResults.slice(idx + 1),
    ];
    this.notify();
    return { hollow: false };
  }

  // Player declines an offered reroll → accepts what's given (Fate).
  declineReroll(): void {
    this.affinityEngine.applyAction('decline-reroll');
    this.notify();
  }

  // Fate: the card you pick may not be the one revealed (Ascendant: card-swap;
  // Dominant: the-hand-chooses). Returns the card to reveal and whether a swap occurred.
  resolveTarotPick(chosenIndex: number, hand: TarotResult[]): { card: TarotResult; swapped: boolean } {
    const chosen = hand[chosenIndex];
    if (hand.length < 2) return { card: chosen, swapped: false };

    const swap =
      this.forcedOrRoll('the-hand-chooses', 'fate', 'dominant', TIER_BASE_CHANCE.major) ||
      this.forcedOrRoll('card-swap', 'fate', 'ascendant', TIER_BASE_CHANCE.major);
    if (!swap) return { card: chosen, swapped: false };

    const others = hand.map((_, i) => i).filter((i) => i !== chosenIndex);
    const pick = others[Math.floor(Math.random() * others.length)];
    return { card: hand[pick], swapped: true };
  }

  // Fate: a coin-flip detail (orientation) may be decided for the player.
  maybeAutoOrient(): 'upright' | 'reversed' | null {
    if (!this.forcedOrRoll('auto-orient', 'fate', 'stirring', TIER_BASE_CHANCE.notable)) return null;
    return Math.random() < 0.5 ? 'upright' : 'reversed';
  }

  // Will: the player exercises a free orientation choice.
  setOrientation(_orientation: 'upright' | 'reversed'): void {
    this.affinityEngine.applyAction('set-orientation');
    this.notify();
  }

  // Will (Dominant): offer two candidate results; the player keeps one.
  maybeKeepOneOfTwo(result: SlotResult): SlotResult[] | null {
    if (result.type === 'happening') return null;
    if (!this.forcedOrRoll('keep-one-of-two', 'will', 'dominant', TIER_BASE_CHANCE.major)) return null;
    const affinities = this.affinityEngine.getState();
    const alt = this.orchestrator.drawSingleResult(
      result.type as 'tarot' | 'd20' | 'iching',
      affinities,
    );
    return [result, alt];
  }

  // Will: swap the offered method set — re-rolls the pool. Feeds Will.
  swapMethod(): void {
    this.affinityEngine.applyAction('swap-method');
    const affinities = this.affinityEngine.getState();
    this.state.availableMethods = this.orchestrator.generatePool(
      this.state.questionType!, affinities, this.affinityEngine.getEffects().methodCount,
    );
    this.state.selectedMethod = null;
    this.notify();
  }

  // Fate (Dominant): the method may be forced on the player.
  maybeForceMethod(): boolean {
    return this.forcedOrRoll('force-method', 'fate', 'dominant', TIER_BASE_CHANCE.notable);
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

  // ---------- Debug ----------

  injectPendingEffect(effect: PendingEffect): void {
    this.state.pendingEffects = [...this.state.pendingEffects, effect];
    this.notify();
  }

  loadScenarioById(presetId: string): boolean {
    const patch = loadScenario(presetId, this.state);
    if (patch === null) return false;
    // Affinities must go through the engine BEFORE notify(), which overwrites
    // state.affinities from the engine. Routing here fixes the old clobber bug.
    this.affinityEngine.setState(patch);
    this.notify();
    return true;
  }

  getScenarioPresets() {
    return SCENARIO_PRESETS.map((p) => ({ id: p.id, label: p.label, group: p.group }));
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

    // Re-aggregate for the prompt
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
    this.state.interactionApplied = false;
    this.state.minigameState = null;
    this.state.interactionQueue = [];
    this.state.pendingHappening = false;
    this.state.interactions = [];
    this.state.synthesis = null;
    this.state.happening = null;
    this.state.selectedHappeningChoice = null;
    this.state.chainDepth = 0;
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
