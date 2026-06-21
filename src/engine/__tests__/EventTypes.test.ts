import { describe, it, expect } from 'vitest';
import { PRIORITY_BANDS, bandValue } from '../events/types';

describe('priority bands', () => {
  it('orders structural < mutate < spawn < override', () => {
    expect(PRIORITY_BANDS).toEqual(['STRUCTURAL', 'MUTATE', 'SPAWN', 'OVERRIDE']);
    expect(bandValue('STRUCTURAL')).toBe(100);
    expect(bandValue('OVERRIDE')).toBe(400);
    expect(bandValue('STRUCTURAL')).toBeLessThan(bandValue('MUTATE'));
  });
});
