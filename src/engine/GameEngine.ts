import type { GameState, QuestionType, AffinityId, SlotResult, RunRecord, PendingEffect, InteractionEvent } from './types';
import { EventBus } from './EventBus';
import { TagSystem } from './TagSystem';
import { AffinityEngine } from './AffinityEngine';
import { TurnOrchestrator } from './TurnOrchestrator';
import { InteractionResolver } from './InteractionResolver';
import { SynthesisEngine } from './SynthesisEngine';
import { CHAOS_AFFINITY, ORDER_AFFINITY } from '../data/affinities';
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
  private synthesisEngine: SynthesisEngine;

  private state: GameState;
  private cachedSnapshot: GameState;
  private listeners = new Set<(state: GameState) => void>();
  private usedHappeningIds = new Set<string>();
  private minigamesPerTurn: number;

  constructor(minigamesPerTurn = 3) {
    this.minigamesPerTurn = minigamesPerTurn;
    this.bus = new EventBus();
    this.tagSystem = new TagSystem();
    this.affinityEngine = new AffinityEngine([CHAOS_AFFINITY, ORDER_AFFINITY]);
    this.orchestrator = new TurnOrchestrator(this.bus);
    this.interactionResolver = new InteractionResolver(this.tagSystem, this.bus);
    this.synthesisEngine = new SynthesisEngine();
    this.state = this.defaultState();
    this.cachedSnapshot = JSON.parse(JSON.stringify(this.state)) as GameState;
  }

  // ---------- Private helpers ----------

  private defaultState(): GameState {
    return {
      screen: 'title',
      affinities: { chaos: 0.5, order: 0.5 },
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
    };
  }

  private notify(): void {
    this.state.affinities = this.affinityEngine.getState();
    this.state.eventLog = this.bus.getHistory();
    this.cachedSnapshot = JSON.parse(JSON.stringify(this.state)) as GameState;
    this.listeners.forEach((fn) => fn(this.cachedSnapshot));
  }

  // ---------- Turn lifecycle ----------

  startTurn(question: QuestionType): void {
    const affinities = this.affinityEngine.getState();
    const availableMethods = this.orchestrator.generatePool(question, affinities);

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

    this.bus.emit('turn-started', { question, availableMethods });
    this.notify();
  }

  selectMethod(index: number): void {
    const methodType = this.state.availableMethods[index];
    if (!methodType) {
      throw new Error(`Method index ${index} out of bounds`);
    }

    this.state.selectedMethod = methodType;

    // Happening gate: trigger happening scene directly instead of minigame
    if (methodType === 'happening') {
      // Remove happening from the pool so it isn't offered again this turn
      const happeningIdx = this.state.availableMethods.indexOf('happening');
      if (happeningIdx !== -1) {
        this.state.availableMethods = this.state.availableMethods.filter(
          (_m, i) => i !== happeningIdx,
        );
      }
      this.triggerHappening();
      return;
    }

    this.state.activeSlotIndex = null;
    this.state.screen = 'minigame';
    this.notify();
  }

  completeMinigame(result: SlotResult): void {
    // Add result to the turn's results array
    this.state.turnResults = [...this.state.turnResults, result];
    // Canonical index of the just-committed result. NOTE: not `completed - 1`,
    // which diverges from the array index after a `second-result` append.
    const committedIndex = this.state.turnResults.length - 1;
    this.state.activeSlotIndex = committedIndex;
    const completed = this.state.minigamesCompleted + 1;
    this.state.minigamesCompleted = completed;

    // Apply affinities from the result
    if (result.type !== 'happening') {
      this.affinityEngine.apply([result]);
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
    } else {
      this.orchestrator.removeUsedMethod(result.type as 'tarot' | 'd20' | 'iching');

      const chaos = this.affinityEngine.getState().chaos;
      if (chaos >= 0.4 && Math.random() < chaos * 0.5) {
        this.triggerHappening();
        return;
      } else {
        const affinities = this.affinityEngine.getState();
        this.state.availableMethods = this.orchestrator.refillPool(
          this.state.questionType!,
          affinities,
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
      this.state.screen = 'result';
    } else {
      const affinities = this.affinityEngine.getState();
      this.state.availableMethods = this.orchestrator.refillPool(
        this.state.questionType!,
        affinities,
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
            affinityChanges: { chaos: 0.05 },
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

    const nonHappeningResults = results.filter((r) => r.type !== 'happening');
    if (nonHappeningResults.length === 0) return;

    const affinities = this.affinityEngine.getState();
    const synthesisResult = this.synthesisEngine.synthesize(
      nonHappeningResults,
      this.state.questionType!,
      this.state.interactions,
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

    // Apply affinity changes from chosen option
    const current = this.affinityEngine.getState();
    for (const [id, delta] of Object.entries(choice.affinityChanges)) {
      const key = id as AffinityId;
      current[key] = Math.max(0, Math.min(1,
        Math.round((current[key] + (delta as number)) * 100) / 100,
      ));
    }
    this.affinityEngine.setState(current);

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
    );

    this.saveToStorage();
    this.notify();
  }

  // ---------- State access ----------

  getState(): GameState {
    return this.cachedSnapshot;
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
    const success = loadScenario(presetId, this.state);
    if (success) {
      this.notify();
    }
    return success;
  }

  getScenarioPresets() {
    return SCENARIO_PRESETS.map((p) => ({ id: p.id, label: p.label }));
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
    const nonHappening = results.filter((r) => r.type !== 'happening');
    if (nonHappening.length === 0) return '';
    return this.synthesisEngine.generateLLMPrompt({
      question: this.state.questionType!,
      slots: nonHappening,
      interactions: this.state.interactions,
      affinities: this.affinityEngine.getState(),
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
    this.notify();
  }

  clearHistory(): void {
    const defaultAffinities = { chaos: 0.5, order: 0.5 };
    this.affinityEngine.setState(defaultAffinities);
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
