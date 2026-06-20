import { describe, it, expect } from 'vitest';
import { drawTarotCard, MAJOR_ARCANA } from '../../data/tarot';

describe('tarot data', () => {
  it('has 22 Major Arcana cards', () => {
    expect(MAJOR_ARCANA).toHaveLength(22);
  });

  it('each card has required fields', () => {
    for (const card of MAJOR_ARCANA) {
      expect(card.id).toBeTruthy();
      expect(card.name).toBeTruthy();
      expect(card.number).toBeGreaterThanOrEqual(0);
      expect(card.number).toBeLessThanOrEqual(21);
    }
  });

  it('all card ids are unique', () => {
    const ids = MAJOR_ARCANA.map((c) => c.id);
    expect(new Set(ids).size).toBe(22);
  });
});

describe('drawTarotCard', () => {
  it('returns a valid TarotResult', () => {
    const result = drawTarotCard({ chaos: 0, order: 0 });
    expect(result.type).toBe('tarot');
    expect(result.tags).toContain('draw');
    expect(result.tags).toContain('random');
    expect(result.tags).toContain('major-arcana');
    expect(result.tags).toContain('reversible');
    expect(['upright', 'reversed']).toContain(result.orientation);
  });

  it('high chaos increases reversal probability', () => {
    let reversals = 0;
    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
      const result = drawTarotCard({ chaos: 90, order: 0 });
      if (result.orientation === 'reversed') reversals++;
    }
    // With chaos at 0.9, reversal chance ≈ 0.5 + 0.27 = 0.77
    expect(reversals).toBeGreaterThan(iterations * 0.6);
  });

  it('high order decreases reversal probability', () => {
    let reversals = 0;
    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
      const result = drawTarotCard({ chaos: 0, order: 90 });
      if (result.orientation === 'reversed') reversals++;
    }
    // Order 0.9 gives -0.18 mod, so chance ≈ 0.32, but clamped to 0.1 min
    expect(reversals).toBeLessThan(iterations * 0.5);
  });
});
