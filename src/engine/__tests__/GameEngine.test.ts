import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import { buildFace, DECK_BY_ID, consolidateSpread } from '../../data/tarot';
import type { SlotResult, DiceResult } from '../types';

const dieResult = (result = 10, tags = ['roll', 'numeric']): SlotResult => ({
  type: 'd20', result, threshold: 'neutral', interpretation: 'Steady',
  tags, themes: ['harmony'],
  dimensions: { favorability: 0.0, certainty: -1.0, volatility: 0.0 }, modifierRoles: ['effect'],
} as SlotResult);

// Drive a full turn deterministically, avoiding happening interrupts.
function completeTurn(engine: GameEngine): void {
  const orig = Math.random; Math.random = () => 0.99; // suppress probabilistic responders
  try {
    for (let i = 0; i < 3; i++) {
      const methods = engine.getState().availableMethods;
      const idx = methods.findIndex((m) => m !== 'happening');
      if (idx === -1) return;
      engine.selectMethod(idx);
      if (engine.getState().screen === 'happening') {
        engine.resolveHappening(0);
        const ix2 = engine.getState().availableMethods.findIndex((m) => m !== 'happening');
        if (ix2 === -1) return;
        engine.selectMethod(ix2);
      }
      engine.completeMinigame(dieResult());
    }
  } finally {
    Math.random = orig;
  }
}

describe('GameEngine — new lifecycle', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
  });

  it('starts in title screen with an empty event queue and default debug config', () => {
    const s = engine.getState();
    expect(s.screen).toBe('title');
    expect(s.eventQueue).toEqual([]);
    expect(s.debugConfig).toEqual({ forced: [], isolate: false });
  });

  it('startTurn generates availableMethods and goes to method-select', () => {
    engine.startTurn('self');
    const state = engine.getState();
    expect(state.screen).toBe('method-select');
    expect(state.availableMethods.length).toBeGreaterThan(0);
    expect(state.questionType).toBe('self');
  });

  it('selectMethod with valid index goes to minigame screen', () => {
    engine.startTurn('self');
    const idx = engine.getState().availableMethods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;
    engine.selectMethod(idx);
    expect(engine.getState().screen).toBe('minigame');
  });

  it('selectMethod with out-of-bounds index throws', () => {
    engine.startTurn('self');
    expect(() => engine.selectMethod(99)).toThrow('out of bounds');
  });

  it('selectMethod clears activeSlotIndex when entering a minigame', () => {
    engine.startTurn('self');
    engine.loadState({ availableMethods: ['d20', 'tarot', 'iching'], activeSlotIndex: 0, screen: 'method-select' });
    engine.selectMethod(0);
    const s = engine.getState();
    expect(s.screen).toBe('minigame');
    expect(s.activeSlotIndex).toBeNull();
  });

  it('synthesizes after 3 complete minigames and goes to result', () => {
    engine.startTurn('self');
    completeTurn(engine);
    const state = engine.getState();
    expect(state.turnResults.length).toBeGreaterThanOrEqual(3);
    expect(state.synthesis).toBeTruthy();
    expect(state.screen).toBe('result');
  });

  it('completeMinigame between minigames returns to method-select', () => {
    engine.startTurn('self');
    const idx = engine.getState().availableMethods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;
    engine.selectMethod(idx);
    if (engine.getState().screen !== 'minigame') return;
    const orig = Math.random; Math.random = () => 0.99;
    engine.completeMinigame(dieResult());
    Math.random = orig;
    expect(engine.getState().screen).toBe('method-select');
  });

  it('completeMinigame sets activeSlotIndex to the committed slot index', () => {
    engine.startTurn('self');
    const idx = engine.getState().availableMethods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;
    engine.selectMethod(idx);
    if (engine.getState().screen !== 'minigame') return;
    const orig = Math.random; Math.random = () => 0.99;
    engine.completeMinigame(dieResult());
    Math.random = orig;
    const state = engine.getState();
    expect(state.activeSlotIndex).toBe(state.turnResults.length - 1);
  });

  it('returnToQuestionSelect resets turn state, preserves history and affinities', () => {
    engine.startTurn('self');
    const idx = engine.getState().availableMethods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;
    engine.selectMethod(idx);
    if (engine.getState().screen !== 'minigame') return;
    const orig = Math.random; Math.random = () => 0.99;
    engine.completeMinigame(dieResult());
    Math.random = orig;

    const beforeAffinities = { ...engine.getState().affinities };
    engine.returnToQuestionSelect();
    const state = engine.getState();
    expect(state.screen).toBe('question');
    expect(state.turnResults).toEqual([]);
    expect(state.synthesis).toBeNull();
    expect(state.eventQueue).toEqual([]);
    expect(state.affinities).toEqual(beforeAffinities);
  });

  it('startTurn resets activeSlotIndex to null and clears the event queue', () => {
    engine.startTurn('self');
    engine.loadState({ activeSlotIndex: 2 });
    expect(engine.getState().activeSlotIndex).toBe(2);
    engine.startTurn('self');
    expect(engine.getState().activeSlotIndex).toBeNull();
    expect(engine.getState().eventQueue).toEqual([]);
  });

  it('resolveHappening fails with invalid index', () => {
    engine.startTurn('self');
    engine.triggerHappening();
    expect(engine.getState().screen).toBe('happening');
    expect(() => engine.resolveHappening(99)).toThrow('Choice 99 not found');
    expect(engine.getState().screen).toBe('happening');
  });

  it('resolveHappening throws when no happening active', () => {
    expect(() => engine.resolveHappening(0)).toThrow('No happening active');
  });
});

describe('GameEngine — dispatch effects', () => {
  it('forced chaos-second-result spawns a second slot on commit', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    const idx = engine.getState().availableMethods.findIndex((m) => m !== 'happening');
    if (idx === -1) return;
    engine.selectMethod(idx);
    engine.forceEffects(['chaos-second-result'], false);
    const before = engine.getState().turnResults.length;
    const orig = Math.random; Math.random = () => 0.99;
    engine.completeMinigame(dieResult());
    Math.random = orig;
    expect(engine.getState().turnResults.length).toBe(before + 2); // committed + spawned
    // forced flag consumed
    expect(engine.getState().debugConfig.forced).not.toContain('chaos-second-result');
  });

  it('a forced roll-mode effect lands a report in the event queue via planDiceRoll', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    engine.forceEffects(['will-choice'], false);
    const orig = Math.random; Math.random = () => 0.99;
    const plan = engine.planDiceRoll();
    Math.random = orig;
    expect(plan.reports.some((r) => r.responderId === 'roll-mode')).toBe(true);
    expect(engine.getState().eventQueue.some((r) => r.responderId === 'roll-mode')).toBe(true);
  });

  it('freezes on the minigame screen until the commit event batch is narrated', () => {
    const engine = new GameEngine();
    engine.startTurn('decision');
    engine.selectMethod(0); // not the final reading (minigamesPerTurn = 3)
    // Force a commit-phase responder so the commit enqueues an EffectReport.
    engine.forceEffects(['chaos-second-result'], true);

    const die = engine.getState().turnResults; // baseline length
    engine.completeMinigame({
      type: 'd20', result: 11, threshold: 'neutral', interpretation: '',
      tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
      modifierRoles: [],
    } as any);

    // Deferred: queue has events, screen has NOT advanced past minigame.
    expect(engine.getState().eventQueue.length).toBeGreaterThan(0);
    expect(engine.getState().screen).toBe('minigame');

    // Draining the batch runs the deferred transition.
    engine.finishEventBatch();
    expect(engine.getState().eventQueue.length).toBe(0);
    expect(engine.getState().screen).toBe('method-select');
    expect(die).toBeDefined();
  });

  it('records the turn effects into the run history', () => {
    const engine = new GameEngine();
    engine.startTurn('decision');
    engine.selectMethod(0);
    engine.forceEffects(['chaos-second-result'], true);
    engine.completeMinigame({ type: 'd20', result: 5, threshold: 'low', interpretation: '',
      tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [] } as any);
    engine.finishEventBatch(); // drain the deferred reading-1 transition
    // Complete the remaining readings to reach the final synthesis + RunRecord.
    while (engine.getState().screen !== 'result') {
      const methods = engine.getState().availableMethods;
      const idx = methods.findIndex((m) => m !== 'happening');
      engine.selectMethod(idx);
      engine.completeMinigame({ type: 'd20', result: 5, threshold: 'low', interpretation: '',
        tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [] } as any);
      engine.finishEventBatch();
    }
    const hist = engine.getState().history;
    const last = hist[hist.length - 1];
    expect(last.effects.length).toBeGreaterThan(0);
    expect(last.effects.some((r) => r.responderId === 'chaos-second-result')).toBe(true);
  });
});

function diceResult(): DiceResult {
  return {
    type: 'd20', result: 11, threshold: 'neutral',
    interpretation: '...', tags: ['roll', 'random', 'numeric', 'threshold', 'neutral'],
    themes: ['harmony'], dimensions: { favorability: 0, certainty: -1, volatility: 0 }, modifierRoles: ['effect'],
  };
}

describe('tarot deal + spread orientation', () => {
  it('resolveTarotDeal returns the same faces when Fate is dormant', () => {
    const e = new GameEngine();
    e.startTurn('self');
    const faces = [buildFace(DECK_BY_ID['the-fool'], 'upright'), buildFace(DECK_BY_ID['cups-2'], 'upright'), buildFace(DECK_BY_ID['swords-3'], 'upright')];
    const { faces: out, swappedIndex } = e.resolveTarotDeal(faces);
    expect(out).toHaveLength(3);
    expect(swappedIndex).toBeNull();
  });

  it('resolveSpreadOrientation passes through when Fate is dormant', () => {
    const e = new GameEngine();
    e.startTurn('self');
    const r = consolidateSpread([buildFace(DECK_BY_ID['the-star'], 'upright'), buildFace(DECK_BY_ID['cups-2'], 'upright'), buildFace(DECK_BY_ID['swords-3'], 'upright')]);
    const { auto } = e.resolveSpreadOrientation(r);
    expect(auto).toBe(false);
  });
});

describe('redrawSpreadPosition', () => {
  it('replaces one position with a different card and feeds Will', () => {
    const e = new GameEngine();
    e.startTurn('self');
    const before = e.getState().affinities.will;
    const faces = [buildFace(DECK_BY_ID['the-fool'], 'upright'), buildFace(DECK_BY_ID['cups-2'], 'upright'), buildFace(DECK_BY_ID['swords-3'], 'upright')];
    const out = e.redrawSpreadPosition(faces, 1);
    expect(out).toHaveLength(3);
    expect(out[0].id).toBe('the-fool');
    expect(out[2].id).toBe('swords-3');
    expect(e.getState().affinities.will).toBeGreaterThanOrEqual(before);
    expect(out[1].id).not.toBe('cups-2');
  });
});

describe('GameEngine — affinity effects snapshot', () => {
  it('carries affinityEffects in the snapshot and reflects band changes after notify', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    engine.loadState({ affinities: { ...engine.getState().affinities, will: 90 } });
    expect(engine.getState().affinityEffects.spreadRedraws).toBe(2);
    expect(engine.getAffinityEffects().spreadRedraws).toBe(2);
  });

  it('resolveReroll returns a usable dice result', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    const orig = Math.random; Math.random = () => 0.99;
    const { result } = engine.resolveReroll(diceResult());
    Math.random = orig;
    expect(result.type).toBe('d20');
  });
});
