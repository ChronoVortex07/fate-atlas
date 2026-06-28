import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import { CorruptionEngine } from '../CorruptionEngine';

describe('forbidden-sight availability (Virulent+)', () => {
  it('is false while corruption is below virulent', () => {
    const e = new GameEngine(3);
    e.setCorruption(50); // spreading
    expect(e.getState().forbiddenSightAvailable).toBe(false);
  });

  it('is true at virulent and pinnacle', () => {
    const e = new GameEngine(3);
    e.setCorruption(80); // virulent
    expect(e.getState().forbiddenSightAvailable).toBe(true);
    e.setCorruption(100); // pinnacle
    expect(e.getState().forbiddenSightAvailable).toBe(true);
  });

  it('defaults to false on a fresh engine', () => {
    expect(new GameEngine(3).getState().forbiddenSightAvailable).toBe(false);
  });
});

describe('CorruptionEngine.add', () => {
  it('adds and clamps to [0,100]', () => {
    const c = new CorruptionEngine();
    c.setValue(50); c.add(10);
    expect(c.getValue()).toBe(60);
    c.add(100);
    expect(c.getValue()).toBe(100);
    c.add(-500);
    expect(c.getValue()).toBe(0);
  });
});
