import { describe, it, expect } from 'vitest';
import { sealStageForValue, SEED_OMEN, LIGHT_LEAD_IN, TAUNT_LIGHT } from '../../data/corruption';

describe('sealStageForValue', () => {
  it('is none below spreading (dormant/seeded — no card seal yet)', () => {
    expect(sealStageForValue(0)).toBe('none');
    expect(sealStageForValue(20)).toBe('none');  // seeded
    expect(sealStageForValue(34)).toBe('none');  // top of seeded
  });
  it('is intact in early/mid spreading', () => {
    expect(sealStageForValue(35)).toBe('intact');
    expect(sealStageForValue(56)).toBe('intact');
  });
  it('strains from late spreading into early virulent', () => {
    expect(sealStageForValue(57)).toBe('strain'); // late spreading
    expect(sealStageForValue(66)).toBe('strain'); // top of spreading
    expect(sealStageForValue(78)).toBe('strain'); // early virulent
  });
  it('shatters from mid virulent onward', () => {
    expect(sealStageForValue(79)).toBe('shattered');
    expect(sealStageForValue(99)).toBe('shattered');
    expect(sealStageForValue(100)).toBe('shattered');
  });
});

describe('warning copy', () => {
  it('exposes the seed omen, light lead-in, and at least one taunt', () => {
    expect(SEED_OMEN).toContain('weave');
    expect(LIGHT_LEAD_IN).toBe('There is something in the —');
    expect(TAUNT_LIGHT.length).toBeGreaterThan(0);
    expect(TAUNT_LIGHT[0]).toBe('i let it warn you. watch how little it matters.');
  });
});
