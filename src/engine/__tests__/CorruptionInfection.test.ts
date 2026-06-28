import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import { infectedCountForBand } from '../../data/corruption';
import { rollInfectedCount } from '../../data/corruption';

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

  it('taints 0 or 1 method at the spreading band', () => {
    const e = new GameEngine(3);
    e.setCorruption(50); // spreading
    e.startTurn('self');
    const infected = e.getState().infectedMethods;
    expect(infected.length).toBeGreaterThanOrEqual(0);
    expect(infected.length).toBeLessThanOrEqual(1);
    infected.forEach(i => {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(e.getState().availableMethods.length);
    });
  });

  it('taints 1 or 2 distinct methods at the virulent band', () => {
    const e = new GameEngine(3);
    e.setCorruption(80); // virulent
    e.startTurn('self');
    const infected = e.getState().infectedMethods;
    expect(infected.length).toBeGreaterThanOrEqual(1);
    expect(infected.length).toBeLessThanOrEqual(2);
    expect(new Set(infected).size).toBe(infected.length); // distinct
  });

  it('infectedCountForBand returns 2 at pinnacle (same as virulent)', () => {
    expect(infectedCountForBand('pinnacle')).toBe(2);
  });
});

describe('rollInfectedCount (chance-based)', () => {
  it('is always 0 at dormant/seeded regardless of roll', () => {
    expect(rollInfectedCount('dormant', () => 0)).toBe(0);
    expect(rollInfectedCount('seeded', () => 0.99)).toBe(0);
  });
  it('spreading rolls 0 or 1 around the split', () => {
    expect(rollInfectedCount('spreading', () => 0.2)).toBe(1); // < 0.5 → 1
    expect(rollInfectedCount('spreading', () => 0.8)).toBe(0); // >= 0.5 → 0
  });
  it('virulent/pinnacle rolls 1 or 2 around the split', () => {
    expect(rollInfectedCount('virulent', () => 0.2)).toBe(2);
    expect(rollInfectedCount('virulent', () => 0.8)).toBe(1);
    expect(rollInfectedCount('pinnacle', () => 0.2)).toBe(2);
  });
});
