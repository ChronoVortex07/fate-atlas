import { describe, it, expect } from 'vitest';
import { CONCEPTS, ORIGIN_IDS, CROSSING_IDS, destinationsFor, conceptTags } from '../../data/strings';
import type { QuestionType } from '../types';

describe('strings concept library', () => {
  it('has origins, a crossing pool large enough for two bands, and per-question destinations', () => {
    expect(ORIGIN_IDS.length).toBeGreaterThanOrEqual(1);
    // Two crossing bands of 4 distinct nodes each → need ≥ 8.
    expect(CROSSING_IDS.length).toBeGreaterThanOrEqual(8);
    for (const q of ['decision', 'relationship', 'future', 'self'] as QuestionType[]) {
      expect(destinationsFor(q).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('every concept is internally consistent', () => {
    for (const [id, c] of Object.entries(CONCEPTS)) {
      expect(c.id).toBe(id);
      expect(c.themes.length).toBeGreaterThanOrEqual(1);
      const tags = conceptTags(c);
      expect(tags).toContain(`concept-${id}`);
      expect(tags).toContain(`family-${c.family}`);
      // Destinations must declare which questions they answer.
      if (c.bands.includes('destination')) {
        expect(c.questionTypes && c.questionTypes.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
