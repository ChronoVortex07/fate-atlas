import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import { SEED_OMENS } from '../CorruptionGlitch';
import type { DiceResult } from '../types';

afterEach(() => vi.restoreAllMocks());
const dice = (): DiceResult => ({ type: 'd20', result: 10, threshold: 'neutral', interpretation: '',
  tags: [], themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [] });

function fullTurn(e: GameEngine) {
  for (let i = 0; i < 3; i++) {
    e.completeMinigame(dice());
    if (e.getState().eventQueue.length > 0) e.finishEventBatch();
    e.continueAfterReview();
  }
}

describe('corruption falsifies the reading output', () => {
  it('leaves the reading clean when corruption is dormant', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3);
    e.startTurn('self');
    fullTurn(e);
    const s = e.getState();
    expect(s.screen).toBe('result');
    // a clean reading contains no redaction blocks
    expect(JSON.stringify(s.synthesis)).not.toContain('█');
  });

  it('weaves a clean seed omen into the reading while corruption is seeded', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic: omen index 0, no glitch path
    const e = new GameEngine(3);
    e.startTurn('self');
    // high (not maxed) affinities feed corruption so it stays active in the seeded band
    e.loadState({ affinities: { chaos: 90, order: 90, fate: 90, will: 90, light: 90, shadow: 90 } });
    e.setCorruption(10); // seeded band (1–34); grows but stays < 35 across 3 readings
    fullTurn(e);
    const s = e.getState();
    expect(s.corruption.band).toBe('seeded');
    expect(JSON.stringify(s.synthesis)).toContain(SEED_OMENS[0]);
    expect(JSON.stringify(s.synthesis)).not.toContain('█'); // clean prose, never the glitch system
  });

  it('adds no seed omen when corruption is dormant', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const e = new GameEngine(3);
    e.startTurn('self');
    fullTurn(e);
    const s = e.getState();
    expect(s.corruption.band).toBe('dormant');
    for (const omen of SEED_OMENS) {
      expect(JSON.stringify(s.synthesis)).not.toContain(omen);
    }
  });
});
