import type { GameState, QuestionType, AffinityId, SlotResult, RunRecord } from './types';
import { EventBus } from './EventBus';
import { TagSystem } from './TagSystem';
import { AffinityEngine } from './AffinityEngine';
import { TurnOrchestrator } from './TurnOrchestrator';
import { InteractionResolver } from './InteractionResolver';
import { SynthesisEngine } from './SynthesisEngine';
import { CHAOS_AFFINITY, ORDER_AFFINITY } from '../data/affinities';
import { INTERACTION_RULES } from '../data/interactions';
import { selectHappening } from '../data/happenings';

const STORAGE_KEY = 'fate-atlas-save';

export class GameEngine {
  private bus: EventBus;
  private tagSystem: TagSystem;
  private affinityEngine: AffinityEngine;
  private orchestrator: TurnOrchestrator;
  private interactionResolver: InteractionResolver;
  private synthesisEngine: SynthesisEngine;

  private state: GameState;
  private listeners = new Set<(state: GameState) => void>();
  private usedHappeningIds = new Set<string>();

  constructor() {
    this.bus = new EventBus();
    this.tagSystem = new TagSystem();
    this.affinityEngine = new AffinityEngine([CHAOS_AFFINITY, ORDER_AFFINITY]);
    this.orchestrator = new TurnOrchestrator(this.tagSystem, this.bus);
    this.interactionResolver = new InteractionResolver(this.tagSystem, this.bus);
    this.synthesisEngine = new SynthesisEngine();
    this.state = this.defaultState();
  }

  // ── Private helpers ──

  private defaultState(): GameState {
    return {
      screen: 'title',
      affinities: { chaos: 0.5, order: 0.5 },
      questionType: null,
      pool: [],
      slots: [],
      revealedCount: 0,
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
    const snapshot = JSON.parse(JSON.stringify(this.state)) as GameState;
    this.listeners.forEach((fn) => fn(snapshot));
  }

  // ── Turn lifecycle ──

  startTurn(question: QuestionType): void {
    const affinities = this.affinityEngine.getState();
    const pool = this.orchestrator.generatePool(question, affinities);

    this.state.screen = 'draw';
    this.state.questionType = question;
    this.state.pool = pool;
    this.state.slots = this.orchestrator.getSlots();
    this.state.revealedCount = 0;
    this.state.interactions = [];
    this.state.synthesis = null;
    this.state.happening = null;
    this.state.selectedHappeningChoice = null;
    this.state.chainDepth = 0;

    this.bus.emit('turn-started', { question, pool });
    this.notify();
  }

  drawSlot(index: number): void {
    const affinities = this.affinityEngine.getState();
    this.orchestrator.drawSlot(index, affinities);
    this.state.slots = this.orchestrator.getSlots();
    this.notify();
  }

  revealSlot(index: number): void {
    this.orchestrator.revealSlot(index);

    const slots = this.orchestrator.getSlots();
    const revealed = slots[index];
    if (!revealed) {
      throw new Error(`Slot ${index} is empty — cannot reveal`);
    }

    // Accumulate affinities from non-happening results
    if (revealed.type !== 'happening') {
      this.affinityEngine.apply([revealed]);
    }

    // Resolve interactions triggered by this reveal
    const affinities = this.affinityEngine.getState();
    const interactions = this.interactionResolver.checkAndResolve(
      slots, index, affinities, INTERACTION_RULES, this.state.chainDepth,
    );

    this.state.slots = slots;
    this.state.interactions = [...this.state.interactions, ...interactions];
    this.state.revealedCount++;
    this.state.affinities = this.affinityEngine.getState();
    this.notify();
  }

  resolveAllInteractions(): void {
    const slots = this.orchestrator.getSlots();
    const affinities = this.affinityEngine.getState();
    const allEntries: import('./types').InteractionEvent[] = [];

    for (let i = 0; i < slots.length; i++) {
      if (slots[i]) {
        const events = this.interactionResolver.checkAndResolve(
          slots, i, affinities, INTERACTION_RULES, 0,
        );
        allEntries.push(...events);
      }
    }

    this.state.slots = slots;
    this.state.interactions = allEntries;
    this.notify();
  }

  synthesize(): void {
    const slots = this.orchestrator.getSlots()
      .filter((s): s is SlotResult => s !== null && s.type !== 'happening');
    const affinities = this.affinityEngine.getState();
    const result = this.synthesisEngine.synthesize(
      slots,
      this.state.questionType!,
      this.state.interactions,
      affinities,
    );

    this.state.synthesis = result;
    this.state.screen = 'interpretation';

    this.bus.emit('synthesis-complete', { result });
    this.notify();
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
    this.state.screen = 'result';
    this.state.affinities = this.affinityEngine.getState();

    // Build run record and add to history
    const slots = this.orchestrator.getSlots()
      .filter((s): s is SlotResult => s !== null && s.type !== 'happening');
    const run: RunRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      question: this.state.questionType!,
      slots,
      interactions: this.state.interactions,
      synthesis: this.state.synthesis!,
      happening: this.state.happening,
      happeningChoice: choiceIndex,
    };
    this.state.history = [...this.state.history, run];

    this.bus.emit('happening-resolved', { choiceIndex });
    this.notify();
  }

  // ── State access ──

  getState(): GameState {
    this.state.affinities = this.affinityEngine.getState();
    this.state.eventLog = this.bus.getHistory();
    return JSON.parse(JSON.stringify(this.state)) as GameState;
  }

  loadState(json: Partial<GameState>): void {
    Object.assign(this.state, json);
    if (json.affinities) {
      this.affinityEngine.setState(json.affinities);
    }
    this.bus.emit('state-loaded', json);
    this.notify();
  }

  // ── Persistence ──

  saveToStorage(): void {
    const data = {
      affinities: this.affinityEngine.serialize(),
      history: this.state.history,
      usedHappeningIds: Array.from(this.usedHappeningIds),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  loadFromStorage(): boolean {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    try {
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

  // ── Subscription ──

  subscribe(fn: (state: GameState) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  // ── Reset ──

  reset(): void {
    const affinities = this.affinityEngine.getState();
    this.state = this.defaultState();
    this.affinityEngine.setState(affinities);
    this.state.affinities = this.affinityEngine.getState();
    this.usedHappeningIds.clear();
    this.bus.clear();
    this.notify();
  }
}
