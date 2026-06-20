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
      minigameState: null,
      pendingEffects: [],
      activeInteraction: null,
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
    this.state.minigameState = null;
    this.state.activeInteraction = null;
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
    this.state.screen = 'minigame';
    this.notify();
  }

  completeMinigame(result: SlotResult): void {
    // Add result to the turn's results array
    this.state.turnResults = [...this.state.turnResults, result];
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
      targetSlotIndex: 0,
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
    );
    this.state.pendingEffects = [...this.state.pendingEffects, ...newEffects];

    // If any matched effects, show the interaction layer
    if (interactionEvents.length > 0) {
      this.state.activeInteraction = interactionEvents[0];
    }

    if (completed >= this.minigamesPerTurn) {
      // All minigames done — synthesize and go to result
      this.synthesizeAll();
      // Build run record
      this.buildRunRecord();
      // If active interaction, stay on minigame screen briefly then go to result
      if (this.state.activeInteraction) {
        // InteractionLayer will clear and we need to go to result
        // We'll handle this in clearActiveInteraction
      } else {
        this.state.screen = 'result';
      }
    } else {
      // More minigames to go — check for happening chance
      const goingBackToSelect = () => {
        // Remove the used method and refill pool
        this.orchestrator.removeUsedMethod(result.type as 'tarot' | 'd20' | 'iching');
        const affinities = this.affinityEngine.getState();
        this.state.availableMethods = this.orchestrator.refillPool(
          this.state.questionType!,
          affinities,
        );
        this.state.screen = 'method-select';
        this.state.selectedMethod = null;
        if (!this.state.activeInteraction) {
          this.notify();
        }
      };

      // Happening chance after each minigame (except the last)
      const chaos = this.affinityEngine.getState().chaos;
      if (chaos >= 0.4 && Math.random() < chaos * 0.5) {
        // Trigger a happening between minigames
        this.state.screen = 'method-select'; // set temporarily so clearActiveInteraction knows where to go
        if (this.state.activeInteraction) {
          // Show interaction first, then happening via clearActiveInteraction override
          // Store that we need to go to happening after interaction clears
          this.state.pendingHappening = true;
        } else {
          this.triggerHappening();
          return;
        }
      } else {
        goingBackToSelect();
      }
    }

    this.bus.emit('minigame-complete', { result, completed, interactions: interactionEvents });
    this.notify();
  }

  clearActiveInteraction(): void {
    const hadPendingHappening = this.state.pendingHappening;
    this.state.pendingHappening = false;
    this.state.activeInteraction = null;

    if (hadPendingHappening) {
      this.triggerHappening();
      return;
    }

    if (this.state.minigamesCompleted >= this.minigamesPerTurn) {
      this.state.screen = 'result';
    } else {
      this.state.screen = 'method-select';
      this.state.selectedMethod = null;
    }
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
    this.state.minigameState = null;
    this.state.activeInteraction = null;
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
