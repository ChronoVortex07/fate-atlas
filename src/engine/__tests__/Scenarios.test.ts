import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import { drawTarotCard } from '../../data/tarot';

describe('debug scenarios', () => {
  it('exposes a group for every preset', () => {
    const engine = new GameEngine();
    const presets = engine.getScenarioPresets();
    expect(presets.length).toBeGreaterThan(0);
    for (const p of presets) expect(typeof p.group).toBe('string');
  });

  it('scenario affinity setup routes through the engine and survives notify()', () => {
    const engine = new GameEngine();
    let snapshot = engine.getState();
    const unsub = engine.subscribe((s) => { snapshot = s; });
    const ok = engine.loadScenarioById('chaos-wild-surge');
    expect(ok).toBe(true);
    // chaos-wild-surge sets Chaos to Dominant (>= 82); it must NOT be clobbered by notify()
    expect(snapshot.affinities.chaos).toBeGreaterThanOrEqual(82);
    unsub();
  });

  it('event-resolved scenarios set debugForcedEffect', () => {
    const engine = new GameEngine();
    engine.loadScenarioById('chaos-wild-surge');
    expect(engine.getState().debugForcedEffect).toBe('wild-surge');
  });
});

describe('Phase 2/3 scenarios', () => {
  it('includes Fate/Will and Light/Shadow groups', () => {
    const engine = new GameEngine();
    const groups = new Set(engine.getScenarioPresets().map((p) => p.group));
    expect(groups.has('Fate / Will')).toBe(true);
    expect(groups.has('Light / Shadow')).toBe(true);
  });

  it('card-swap scenario sets Fate Ascendant and forces the effect', () => {
    const engine = new GameEngine();
    const ok = engine.loadScenarioById('fate-card-swap');
    expect(ok).toBe(true);
    expect(engine.getState().affinities.fate).toBeGreaterThanOrEqual(60);
    expect(engine.getState().debugForcedEffect).toBe('card-swap');
  });

  it('peek-failure scenario sets Light Ascendant', () => {
    const engine = new GameEngine();
    engine.loadScenarioById('light-peek-failure');
    expect(engine.getState().affinities.light).toBeGreaterThanOrEqual(60);
  });

  it('every Phase 2/3 preset loads without error', () => {
    const engine = new GameEngine();
    const ids = engine.getScenarioPresets()
      .filter((p) => p.group === 'Fate / Will' || p.group === 'Light / Shadow')
      .map((p) => p.id);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    for (const id of ids) expect(engine.loadScenarioById(id)).toBe(true);
  });
});

describe('scenario turn baseline', () => {
  afterEach(() => vi.restoreAllMocks());

  // Scenarios jump straight into a minigame, bypassing startTurn — which is the
  // only place questionType is normally set. Completing the minigame triggers
  // refillPool(questionType), which crashed on QUESTION_WEIGHTS[null].
  it('a minigame scenario sets questionType so completing it does not crash', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // avoid happening-interrupt / wild-surge branches
    const engine = new GameEngine();
    engine.loadScenarioById('will-big-hand'); // tarot minigame, 0 completed
    expect(engine.getState().questionType).not.toBeNull();

    const card = drawTarotCard(engine.getState().affinities);
    expect(() => engine.completeMinigame(card, { revealedAsDrawn: true })).not.toThrow();
  });

  // fate-fewer-methods drops onto method-select; MethodSelect renders from
  // availableMethods, which the preset left empty → no cards shown.
  it('fewer-methods scenario populates a reduced, non-empty method pool', () => {
    const engine = new GameEngine();
    engine.loadScenarioById('fate-fewer-methods');
    const s = engine.getState();
    expect(s.screen).toBe('method-select');
    expect(s.availableMethods.length).toBeGreaterThan(0);
    expect(s.availableMethods.length).toBeLessThan(3); // Fate Ascendant → 2 methods
  });
});
