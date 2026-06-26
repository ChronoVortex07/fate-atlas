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

import { consolidatePath, pathCoherence, CONCEPTS as C } from '../../data/strings';
import type { WovenNode } from '../types';

const node = (conceptId: string, band: number): WovenNode =>
  ({ id: `b${band}`, conceptId, band, family: C[conceptId].family, x: 0, y: 0 });

describe('consolidatePath', () => {
  it('is destination-governed and carries the path + tags', () => {
    const path = [node('the-self', 0), node('the-blossom', 1), node('the-dawn', 3)];
    const r = consolidatePath(path);
    expect(r.type).toBe('strings');
    expect(r.destinationId).toBe('the-dawn');
    expect(r.path).toHaveLength(3);
    expect(r.tags).toEqual(expect.arrayContaining(['draw', 'random', 'strings', 'weave']));
    expect(r.tags).toContain('concept-the-dawn');
    // Destination favorability (+1.5, weight 2) dominates the milder origin/crossing.
    expect(r.dimensions.favorability).toBeGreaterThan(0.5);
    // Never emits a reversible/orientation tag (stays out of Mirror).
    expect(r.tags).not.toContain('reversible');
  });
});

describe('pathCoherence', () => {
  it('flags an opposed-theme path tangled and a single-family path coherent', () => {
    // conflict (the-severance) vs surrender (the-parting) → opposed pair.
    const tangled = [node('the-self', 0), node('the-severance', 1), node('the-parting', 3)];
    expect(pathCoherence(tangled)).toBe('tangled');
    // all renewal/harmony, low variance → coherent.
    const coherent = [node('the-hearth', 0), node('the-blossom', 1), node('the-dawn', 3)];
    expect(pathCoherence(coherent)).toBe('coherent');
  });
});
