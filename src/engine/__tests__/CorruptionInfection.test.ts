import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import { infectedCountForBand } from '../../data/corruption';

describe('minigame infection — infected method data', () => {
  it('marks no methods when corruption is dormant', () => {
    const e = new GameEngine(3);
    e.startTurn('self');
    expect(e.getState().infectedMethods).toEqual([]);
  });

  it('marks no methods at the seeded band', () => {
    const e = new GameEngine(3);
    e.setCorruption(20); // seeded
    e.startTurn('self');
    expect(e.getState().infectedMethods).toEqual([]);
  });

  it('taints one method at the spreading band', () => {
    const e = new GameEngine(3);
    e.setCorruption(50); // spreading
    e.startTurn('self');
    const infected = e.getState().infectedMethods;
    expect(infected).toHaveLength(1);
    expect(infected[0]).toBeGreaterThanOrEqual(0);
    expect(infected[0]).toBeLessThan(e.getState().availableMethods.length);
  });

  it('taints two distinct methods at the virulent band', () => {
    const e = new GameEngine(3);
    e.setCorruption(80); // virulent
    e.startTurn('self');
    const infected = e.getState().infectedMethods;
    expect(infected).toHaveLength(2);
    expect(new Set(infected).size).toBe(2); // distinct
  });

  it('infectedCountForBand returns 2 at pinnacle (same as virulent)', () => {
    expect(infectedCountForBand('pinnacle')).toBe(2);
  });
});
