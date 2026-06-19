import { describe, it, expect } from 'vitest';
import { rollD20, getThreshold } from '../../data/dice';

describe('rollD20', () => {
  it('returns a valid DiceResult', () => {
    const result = rollD20({ chaos: 0, order: 0 });
    expect(result.type).toBe('d20');
    expect(result.result).toBeGreaterThanOrEqual(1);
    expect(result.result).toBeLessThanOrEqual(20);
    expect(result.tags).toContain('roll');
    expect(result.tags).toContain('random');
    expect(result.tags).toContain('numeric');
    expect(result.tags).toContain('threshold');
    expect(['critical-low', 'low', 'neutral', 'high', 'critical-high']).toContain(result.threshold);
  });

  it('result 1-5 is critical-low', () => {
    // Mock Math.random to return 0 → roll of 1
    const orig = Math.random;
    Math.random = () => 0;
    const result = rollD20({ chaos: 0, order: 0 });
    Math.random = orig;
    expect(result.threshold).toBe('critical-low');
    expect(result.tags).toContain('low');
  });

  it('result 17-20 is critical-high', () => {
    const orig = Math.random;
    Math.random = () => 0.95; // roll of 20
    const result = rollD20({ chaos: 0, order: 0 });
    Math.random = orig;
    expect(result.threshold).toBe('critical-high');
    expect(result.tags).toContain('high');
  });
});

describe('getThreshold', () => {
  it('classifies correctly', () => {
    expect(getThreshold(1)).toBe('critical-low');
    expect(getThreshold(8)).toBe('low');
    expect(getThreshold(10)).toBe('neutral');
    expect(getThreshold(14)).toBe('high');
    expect(getThreshold(19)).toBe('critical-high');
  });
});
