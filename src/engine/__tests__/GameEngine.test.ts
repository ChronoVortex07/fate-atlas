import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';

describe('GameEngine', () => {
  it('starts in title screen', () => {
    const engine = new GameEngine();
    const state = engine.getState();
    expect(state.screen).toBe('title');
  });

  it('full run: question → draw → reveal → interactions → synthesis → result', () => {
    const engine = new GameEngine();

    // Start turn
    engine.startTurn('self');
    let state = engine.getState();
    expect(state.screen).toBe('draw');
    expect(state.pool.length).toBe(3);

    // Draw 3 slots
    for (let i = 0; i < 3; i++) {
      engine.drawSlot(i);
    }
    state = engine.getState();
    expect(state.slots.filter(Boolean)).toHaveLength(3);

    // Reveal each slot
    for (let i = 0; i < 3; i++) {
      engine.revealSlot(i);
    }

    // Synthesize
    engine.synthesize();
    state = engine.getState();
    expect(state.synthesis).toBeTruthy();
    expect(state.screen).toBe('interpretation');
  });

  it('loadState() sets exact game state for debugging', () => {
    const engine = new GameEngine();
    engine.loadState({
      affinities: { chaos: 0.8, order: 0.2 },
      questionType: 'decision',
      pool: ['tarot', 'd20'],
      slots: [
        { type: 'tarot', id: 'the-fool', name: 'The Fool', number: 0,
          orientation: 'upright', symbol: '☉',
          meaningUpright: '...', meaningReversed: '...',
          tags: ['draw', 'random', 'major-arcana', 'reversible', 'fool-archetype', 'upright'] },
        { type: 'd20', result: 17, threshold: 'critical-high',
          interpretation: '...',
          tags: ['roll', 'random', 'numeric', 'threshold', 'high'] },
        null,
      ],
      revealedCount: 2,
      interactions: [],
      synthesis: null,
      happening: null,
      selectedHappeningChoice: null,
    });

    const state = engine.getState();
    expect(state.affinities.chaos).toBe(0.8);
    expect(state.questionType).toBe('decision');
    expect(state.slots.filter(Boolean)).toHaveLength(2);
  });
});
