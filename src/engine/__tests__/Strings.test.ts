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

import { planWeave } from '../strings';

const baseAff = { chaos: 50, order: 50, fate: 50, will: 50, light: 50, shadow: 50 };

describe('planWeave', () => {
  it('defaults at baseline: 4 bands, width 3, mood clarity, no agency extras', () => {
    const p = planWeave(baseAff);
    expect(p.bandCount).toBe(4);
    expect(p.width).toBe(3);
    expect(p.veil).toBe(0);
    expect(p.clarity).toBe('mood');
    expect(p.backtracks).toBe(0);
    expect(p.foresight).toBe(false);
  });

  it('Fate ascendant thins width; Will ascendant widens + grants a backtrack', () => {
    expect(planWeave({ ...baseAff, fate: 70 }).width).toBe(2);
    const will = planWeave({ ...baseAff, will: 70 });
    expect(will.width).toBe(4);
    expect(will.backtracks).toBe(1);
  });

  it('Light raises clarity + foresight; Shadow lowers clarity + veils; Chaos lengthens', () => {
    expect(planWeave({ ...baseAff, light: 70 }).clarity).toBe('themes');
    expect(planWeave({ ...baseAff, light: 70 }).foresight).toBe(true);
    expect(planWeave({ ...baseAff, shadow: 70 }).clarity).toBe('silhouette');
    expect(planWeave({ ...baseAff, shadow: 70 }).veil).toBe(1);
    expect(planWeave({ ...baseAff, chaos: 90 }).bandCount).toBe(5);
  });
});

import { generateWeave } from '../strings';
import type { WeaveGraph } from '../types';

function reaches(graph: WeaveGraph): boolean {
  const last = graph.bandCount - 1;
  const fwd = new Map<string, string[]>();
  for (const e of graph.edges) (fwd.get(e.from) ?? fwd.set(e.from, []).get(e.from)!).push(e.to);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>([graph.originId]);
  const stack = [graph.originId];
  while (stack.length) {
    const id = stack.pop()!;
    if (byId.get(id)!.band === last) return true;
    for (const to of fwd.get(id) ?? []) if (!seen.has(to)) { seen.add(to); stack.push(to); }
  }
  return false;
}

describe('generateWeave', () => {
  it('builds the planned bands with a reachable destination', () => {
    const plan = planWeave(baseAff);
    for (let i = 0; i < 25; i++) {
      const g = generateWeave('relationship', plan, () => (i * 0.37 + 0.13) % 1);
      expect(g.bandCount).toBe(4);
      expect(g.nodes.filter((n) => n.band === 0)).toHaveLength(1);
      expect(g.nodes.filter((n) => n.band === g.bandCount - 1).length).toBeGreaterThanOrEqual(1);
      // every non-destination node has a forward edge
      for (const n of g.nodes) {
        if (n.band < g.bandCount - 1) {
          expect(g.edges.some((e) => e.from === n.id)).toBe(true);
        }
      }
      expect(reaches(g)).toBe(true);
    }
  });

  it('only seeds destinations that answer the question', () => {
    const g = generateWeave('relationship', planWeave(baseAff), Math.random);
    const dests = g.nodes.filter((n) => n.band === g.bandCount - 1);
    for (const d of dests) {
      expect(CONCEPTS[d.conceptId].questionTypes).toContain('relationship');
    }
  });
});

import { revealFrom } from '../strings';

describe('revealFrom', () => {
  const plan = planWeave(baseAff);
  const g = generateWeave('self', plan, () => 0.42);

  it('reveals up to width pickable candidates from the active node', () => {
    const r = revealFrom(g, plan, g.originId);
    const fwd = g.edges.filter((e) => e.from === g.originId).map((e) => e.to);
    expect(r.candidateIds.length).toBe(Math.min(plan.width, fwd.length));
    for (const id of r.candidateIds) expect(fwd).toContain(id);
  });

  it('Shadow veils some candidates but always leaves at least one pickable', () => {
    const shadowPlan = planWeave({ ...baseAff, shadow: 90 }); // veil 2, silhouette
    const sg = generateWeave('self', shadowPlan, () => 0.42);
    const r = revealFrom(sg, shadowPlan, sg.originId);
    expect(r.candidateIds.length).toBeGreaterThanOrEqual(1);
    for (const id of r.veiledCandidateIds) expect(r.candidateIds).not.toContain(id);
  });

  it('Light surfaces look-ahead silhouettes; baseline does not', () => {
    expect(revealFrom(g, plan, g.originId).lookAheadIds).toHaveLength(0);
    const lightPlan = planWeave({ ...baseAff, light: 70 });
    const lg = generateWeave('self', lightPlan, () => 0.42);
    expect(revealFrom(lg, lightPlan, lg.originId).lookAheadIds.length).toBeGreaterThan(0);
  });
});

import { drawWeave } from '../strings';

describe('drawWeave', () => {
  it('auto-traverses a full path to a question destination and consolidates it', () => {
    const r = drawWeave(baseAff, () => 0.5, 'decision');
    expect(r.type).toBe('strings');
    expect(r.path.length).toBeGreaterThanOrEqual(2);
    expect(r.path[0].band).toBe(0);
    // a full auto-traversal walks one node per band, so the last node sits on the
    // destination band and its band index equals the final path index.
    expect(r.path[r.path.length - 1].band).toBe(r.path.length - 1);
    expect(CONCEPTS[r.destinationId].questionTypes).toContain('decision');
  });
});
