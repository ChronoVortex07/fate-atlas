import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../GameEngine';

beforeEach(() => localStorage.clear());

describe('corruption persistence', () => {
  it('saves corruption and reloads it into a fresh engine', () => {
    const e = new GameEngine(3);
    e.setCorruption(42);
    e.saveToStorage();

    const e2 = new GameEngine(3);
    e2.loadFromStorage();
    expect(e2.getState().corruption.value).toBe(42);
  });

  it('preserves corruption across reset (carryover, like affinities)', () => {
    const e = new GameEngine(3);
    e.setCorruption(42);
    e.reset();
    expect(e.getState().corruption.value).toBe(42);
  });

  it('preserves corruption across returnToTitle', () => {
    const e = new GameEngine(3);
    e.setCorruption(42);
    e.returnToTitle();
    expect(e.getState().corruption.value).toBe(42);
  });

  it('clears corruption on clearHistory', () => {
    const e = new GameEngine(3);
    e.setCorruption(42);
    e.clearHistory();
    expect(e.getState().corruption.value).toBe(0);
  });
});
