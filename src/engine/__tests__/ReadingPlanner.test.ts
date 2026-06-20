import { describe, it, expect } from 'vitest';
import { ReadingPlanner } from '../ReadingPlanner';
import type { SlotResult } from '../types';

// Test fixtures
const makeTarot = (overrides: Partial<SlotResult> = {}): SlotResult => ({
  type: 'tarot', id: 'test', name: 'Test Card', number: 0,
  orientation: 'upright', symbol: '☉',
  meaningUpright: 'Test', meaningReversed: 'Test Rev',
  tags: ['test'],
  themes: ['illumination'],
  dimensions: { favorability: 1.0, certainty: 0.5, volatility: 0.0 },
  modifierRoles: ['subject'],
  ...overrides,
} as SlotResult);

const makeDice = (overrides: Partial<SlotResult> = {}): SlotResult => ({
  type: 'd20', result: 10, threshold: 'neutral',
  interpretation: 'Test',
  tags: ['roll'],
  themes: ['harmony'],
  dimensions: { favorability: 0.0, certainty: -1.0, volatility: 0.0 },
  modifierRoles: ['effect'],
  ...overrides,
} as SlotResult);

const makeIChing = (overrides: Partial<SlotResult> = {}): SlotResult => ({
  type: 'iching', hexagramNumber: 1, name: 'Test', symbol: '䷀',
  judgment: 'Test',
  changingLines: [],
  tags: ['draw'],
  themes: ['transformation'],
  dimensions: { favorability: 0.5, certainty: 0.0, volatility: 1.0 },
  modifierRoles: ['action'],
  ...overrides,
} as SlotResult);

describe('ReadingPlanner', () => {
  const planner = new ReadingPlanner();

  describe('analyzeGaps', () => {
    it('single result reports all gaps', () => {
      const gaps = planner.analyzeGaps([makeTarot()]);
      expect(gaps.themeConfidence).toBe(false);
      expect(gaps.missingDimensions).toContain('volatility');
      expect(gaps.missingModifiers).toContain('action');
      expect(gaps.missingModifiers).toContain('effect');
    });

    it('3 complementary results report no gaps', () => {
      const results = [
        makeTarot({ themes: ['illumination'], dimensions: { favorability: 1.5, certainty: 1.0, volatility: 0.0 }, modifierRoles: ['subject'] }),
        makeDice({ themes: ['harmony'], dimensions: { favorability: 1.0, certainty: 0.0, volatility: 1.5 }, modifierRoles: ['effect'] }),
        makeIChing({ themes: ['illumination'], dimensions: { favorability: 0.5, certainty: 1.5, volatility: 1.0 }, modifierRoles: ['action'] }),
      ];
      const gaps = planner.analyzeGaps(results);
      expect(gaps.themeConfidence).toBe(true); // illumination appears twice
      expect(gaps.missingDimensions).toEqual([]);
      expect(gaps.missingModifiers).toEqual([]);
    });

    it('3 same-theme results -> theme confidence true, dimension gaps still checked', () => {
      const results = [
        makeTarot({ themes: ['upheaval'], dimensions: { favorability: 0.0, certainty: 0.0, volatility: 0.0 }, modifierRoles: ['subject'] }),
        makeDice({ themes: ['upheaval'], dimensions: { favorability: 0.0, certainty: 0.0, volatility: 0.0 }, modifierRoles: ['subject'] }),
        makeIChing({ themes: ['upheaval'], dimensions: { favorability: 0.0, certainty: 0.0, volatility: 0.0 }, modifierRoles: ['subject'] }),
      ];
      const gaps = planner.analyzeGaps(results);
      expect(gaps.themeConfidence).toBe(true);
      expect(gaps.missingDimensions).toEqual(['favorability', 'certainty', 'volatility']);
      expect(gaps.missingModifiers).toEqual(['action', 'effect']);
    });
  });

  describe('getBiasForRefill', () => {
    it('missing certainty -> biases tarot + iching', () => {
      const gaps = { themeConfidence: true, missingDimensions: ['certainty' as const], missingModifiers: [] };
      const bias = planner.getBiasForRefill(gaps);
      expect(bias.tarot).toBeGreaterThan(0);
      expect(bias.iching).toBeGreaterThan(0);
    });

    it('missing effect modifier -> biases d20', () => {
      const gaps = { themeConfidence: true, missingDimensions: [], missingModifiers: ['effect' as const] };
      const bias = planner.getBiasForRefill(gaps);
      expect(bias.d20).toBeGreaterThan(0);
    });

    it('all gaps filled -> neutral bias (all zeros)', () => {
      const gaps = { themeConfidence: true, missingDimensions: [], missingModifiers: [] };
      const bias = planner.getBiasForRefill(gaps);
      expect(bias.tarot).toBe(0);
      expect(bias.d20).toBe(0);
      expect(bias.iching).toBe(0);
    });

    it('missing theme confidence biases all-coverage types', () => {
      const gaps = { themeConfidence: false, missingDimensions: [], missingModifiers: [] };
      const bias = planner.getBiasForRefill(gaps);
      expect(bias.tarot).toBeGreaterThan(0);
      expect(bias.iching).toBeGreaterThan(0);
    });
  });

  describe('aggregate', () => {
    it('theme ranking with clear winner', () => {
      const results = [
        makeTarot({ themes: ['upheaval'] }),
        makeDice({ themes: ['upheaval'] }),
        makeIChing({ themes: ['harmony'] }),
      ];
      const agg = planner.aggregate(results, 'decision');
      expect(agg.dominantTheme).toBe('upheaval');
      expect(agg.secondaryTheme).toBe('harmony');
    });

    it('dimension weighted averaging (primary role = 2x weight)', () => {
      // decision -> primary role = action
      const results = [
        makeTarot({ dimensions: { favorability: 2.0, certainty: 0, volatility: 0 }, modifierRoles: ['action'] }),
        makeDice({ dimensions: { favorability: -1.0, certainty: 0, volatility: 0 }, modifierRoles: ['effect'] }),
      ];
      const agg = planner.aggregate(results, 'decision');
      // action result: 2.0 x 2 = 4.0; effect result: -1.0 x 1 = -1.0; total = 3.0 / 3 = 1.0
      expect(agg.dimensionProfile.favorability).toBe(1.0);
    });

    it('empty results array returns mystery fallback', () => {
      const agg = planner.aggregate([], 'self');
      expect(agg.dominantTheme).toBe('mystery');
      expect(agg.secondaryTheme).toBeNull();
      expect(agg.hasTension).toBe(false);
    });

    it('tension detection for opposing themes', () => {
      const results = [
        makeTarot({ themes: ['upheaval'] }),
        makeDice({ themes: ['harmony'] }),
      ];
      const agg = planner.aggregate(results, 'self');
      expect(agg.hasTension).toBe(true);
      expect(agg.tensionPair).toEqual(['upheaval', 'harmony']);
    });

    it('tension detection for high favorability variance (std > 1.5)', () => {
      const results = [
        makeTarot({ themes: ['illumination'], dimensions: { favorability: 2.0, certainty: 0, volatility: 0 } }),
        makeDice({ themes: ['illumination'], dimensions: { favorability: -2.0, certainty: 0, volatility: 0 } }),
      ];
      const agg = planner.aggregate(results, 'self');
      expect(agg.hasTension).toBe(true);
    });

    it('no tension when themes compatible and variance low', () => {
      const results = [
        makeTarot({ themes: ['harmony'], dimensions: { favorability: 1.0, certainty: 0, volatility: 0 } }),
        makeDice({ themes: ['renewal'], dimensions: { favorability: 0.5, certainty: 0, volatility: 0 } }),
      ];
      const agg = planner.aggregate(results, 'self');
      expect(agg.hasTension).toBe(false);
    });

    it('modifier assignments sorted by signal strength', () => {
      const weak = makeTarot({ modifierRoles: ['subject'], dimensions: { favorability: 0.0, certainty: 0.0, volatility: 0.0 } });
      const strong = makeIChing({ modifierRoles: ['subject'], dimensions: { favorability: 2.0, certainty: 2.0, volatility: 2.0 } });
      const agg = planner.aggregate([weak, strong], 'self');
      expect(agg.modifierAssignments.subject[0]).toBe(strong); // stronger first
      expect(agg.modifierAssignments.subject[1]).toBe(weak);
    });
  });
});
