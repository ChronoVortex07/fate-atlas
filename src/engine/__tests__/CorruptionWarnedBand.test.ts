import { describe, it, expect } from 'vitest';
import { CorruptionEngine } from '../CorruptionEngine';

describe('CorruptionEngine.warnedBand', () => {
  it('defaults to dormant', () => {
    expect(new CorruptionEngine().getWarnedBand()).toBe('dormant');
  });

  it('records the highest band warned', () => {
    const e = new CorruptionEngine();
    e.markWarned('spreading');
    expect(e.getWarnedBand()).toBe('spreading');
  });

  it('resets to dormant on clear()', () => {
    const e = new CorruptionEngine();
    e.markWarned('virulent');
    e.clear();
    expect(e.getWarnedBand()).toBe('dormant');
  });

  it('resets to dormant when corruption starves to 0', () => {
    const e = new CorruptionEngine();
    e.setValue(8); // DECAY_RATE = 8 → one starved tick reaches 0
    e.markWarned('spreading');
    const balanced = { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50 };
    e.tick(balanced, 0); // no food → starve
    expect(e.getValue()).toBe(0);
    expect(e.getWarnedBand()).toBe('dormant');
  });

  it('round-trips warnedBand through serialize/loadFrom', () => {
    const e = new CorruptionEngine();
    e.setValue(40);
    e.markWarned('spreading');
    const json = e.serialize();
    const e2 = new CorruptionEngine();
    e2.loadFrom(json);
    expect(e2.getWarnedBand()).toBe('spreading');
  });
});
