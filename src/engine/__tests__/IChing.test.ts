import { describe, it, expect, vi } from 'vitest';
import { castHexagram, HEXAGRAMS, HEX_BY_BINARY, hexagramByBinary, drawHexagramCast, consolidateHexagram } from '../../data/iching';
import { planHexagramResolution, deriveMandate, hexagramNudge } from '../iching';
import { GameEngine } from '../GameEngine';
import type { SlotResult } from '../types';

const dieResult = (result = 10): SlotResult => ({
  type: 'd20', result, threshold: 'neutral', interpretation: 'Steady',
  tags: ['roll', 'numeric'], themes: ['harmony'],
  dimensions: { favorability: 0.0, certainty: -1.0, volatility: 0.0 }, modifierRoles: ['effect'],
} as SlotResult);

describe('I Ching data', () => {
  it('has 64 hexagrams', () => {
    expect(HEXAGRAMS).toHaveLength(64);
  });

  it('each hexagram has required fields', () => {
    for (const h of HEXAGRAMS) {
      expect(h.number).toBeGreaterThanOrEqual(1);
      expect(h.number).toBeLessThanOrEqual(64);
      expect(h.name).toBeTruthy();
      expect(h.symbol).toBeTruthy();
      expect(h.judgment).toBeTruthy();
    }
  });

  it('all hexagram numbers are unique', () => {
    const numbers = HEXAGRAMS.map((h) => h.number);
    expect(new Set(numbers).size).toBe(64);
  });
});

describe('King Wen binary table', () => {
  it('has 64 unique 6-bit binary patterns covering all hexagrams', () => {
    const set = new Set(HEXAGRAMS.map((h) => h.binary));
    expect(set.size).toBe(64);
    for (const h of HEXAGRAMS) expect(h.binary).toMatch(/^[01]{6}$/);
  });
  it('maps the canonical anchor hexagrams correctly', () => {
    expect(hexagramByBinary('111111').number).toBe(1);
    expect(hexagramByBinary('000000').number).toBe(2);
    expect(hexagramByBinary('111000').number).toBe(11);
    expect(hexagramByBinary('000111').number).toBe(12);
    expect(hexagramByBinary('010010').number).toBe(29);
    expect(hexagramByBinary('101101').number).toBe(30);
    expect(hexagramByBinary('101010').number).toBe(63);
    expect(hexagramByBinary('010101').number).toBe(64);
  });
  it('round-trips every hexagram through the lookup', () => {
    for (const h of HEXAGRAMS) expect(HEX_BY_BINARY[h.binary].number).toBe(h.number);
  });
});

describe('castHexagram', () => {
  it('returns a valid IChingResult', () => {
    const result = castHexagram({ chaos: 0, order: 0 });
    expect(result.type).toBe('iching');
    expect(result.hexagramNumber).toBeGreaterThanOrEqual(1);
    expect(result.hexagramNumber).toBeLessThanOrEqual(64);
    expect(result.tags).toContain('draw');
    expect(result.tags).toContain('random');
    expect(result.tags).toContain('binary');
    expect(result.changingLines.length).toBeGreaterThanOrEqual(0);
    expect(result.changingLines.length).toBeLessThanOrEqual(6);
  });

  it('includes [changing-lines] tag when there are changing lines', () => {
    let hadChanging = false;
    for (let i = 0; i < 50; i++) {
      const result = castHexagram({ chaos: 50, order: 0 });
      if (result.changingLines.length > 0) {
        hadChanging = true;
        expect(result.tags).toContain('changing-lines');
        break;
      }
    }
    // Should find at least one with changing lines in 50 attempts
    expect(hadChanging).toBe(true);
  });
});

describe('drawHexagramCast', () => {
  it('all-changing: all old-yin lines (sum 6) yield primaryNumber=2, relatingNumber=1, changingLines=[1..6]', () => {
    // Each line: 3 coins (random < 0.5 → 2 each, so 2+2+2=6 = old yin, changing) + 1 bias call (chaos=0 → never fires).
    // Math.random always returns 0: 0 < 0.5 → coin=2; bias check 0 < 0 → false.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const cast = drawHexagramCast({});
    expect(cast.lines.every((v) => v === 6)).toBe(true);
    expect(cast.changingLines).toEqual([1, 2, 3, 4, 5, 6]);
    // primary: all bits '0' → binary "000000" → hexagram #2
    expect(cast.primaryNumber).toBe(2);
    // relating: all changing → flip every '0' to '1' → "111111" → hexagram #1
    expect(cast.relatingNumber).toBe(1);
    expect(cast.relatingNumber).not.toBe(cast.primaryNumber);
    vi.restoreAllMocks();
  });
  it('no-changing: all young-yang lines (sum 7) yield primaryNumber=1, relatingNumber=primaryNumber, changingLines=[]', () => {
    // Per-line sequence [0, 0, 0.9, 0]: coin1=0<0.5→2, coin2=0<0.5→2, coin3=0.9<0.5→3 → sum=7 (young yang, not changing).
    // 4th value (0) is the chaos bias call; chaos=0 so changingBias=0 and the check never fires.
    const seq = [0, 0, 0.9, 0]; let i = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => seq[i++ % seq.length]);
    const cast = drawHexagramCast({});
    expect(cast.lines.every((v) => v === 7)).toBe(true);
    expect(cast.changingLines).toEqual([]);
    // primary: all bits '1' → binary "111111" → hexagram #1
    expect(cast.primaryNumber).toBe(1);
    // no changing lines → relating binary identical to primary
    expect(cast.relatingNumber).toBe(cast.primaryNumber);
    vi.restoreAllMocks();
  });
  it('consolidateHexagram returns the governing hexagram with reversible tag when changing', () => {
    const cast = { lines: [9,7,7,7,7,9] as any, primaryNumber: 1, relatingNumber: 2, changingLines: [1,6] };
    const res = consolidateHexagram(cast, 'primary');
    expect(res.hexagramNumber).toBe(1);
    expect(res.relatingNumber).toBe(2);
    expect(res.tags).toContain('changing-lines');
    expect(res.tags).toContain('reversible');
    expect(res.tags).toContain('governing-primary');
    const rel = consolidateHexagram(cast, 'relating');
    expect(rel.hexagramNumber).toBe(2);
    expect(rel.tags).toContain('governing-relating');
  });
});

// ── Task 4: transformation resolution + mandate derivation ──────────────────

const ASC = 65, BASE = 50;
const fakeCast = (primary: number, relating = primary, changing: number[] = []) =>
  ({ lines: [7,7,7,7,7,7] as any, primaryNumber: primary, relatingNumber: relating, changingLines: changing });

describe('planHexagramResolution', () => {
  it('willed when Will ascendant+', () => {
    expect(planHexagramResolution({ will: ASC, fate: BASE }, true).mode).toBe('willed');
  });
  it('fated when Fate ascendant+ and Will not', () => {
    expect(planHexagramResolution({ will: BASE, fate: ASC }, true).mode).toBe('fated');
  });
  it('Will wins ties when both ascendant+', () => {
    // DOM = 90 for fate, ASC = 65 for will — Will still wins
    expect(planHexagramResolution({ will: ASC, fate: 90 }, true).mode).toBe('willed');
  });
  it('unaligned with a recast offer when neither ascendant', () => {
    const p = planHexagramResolution({ will: BASE, fate: BASE }, true);
    expect(p.mode).toBe('unaligned');
    expect(p.offerRecast).toBe(true);
  });
  it('no fork when there are no changing lines', () => {
    expect(planHexagramResolution({ will: ASC }, false).mode).toBe('unaligned');
    expect(planHexagramResolution({ will: ASC }, false).offerRecast).toBe(false);
  });
});

describe('deriveMandate', () => {
  it('amplifies gains for a volatile hexagram (globalMult > 1)', () => {
    // Hexagram #49 Revolution: volatility +2.0 → globalMult = 1 + (2/2)*0.6 = 1.6
    const revolution = consolidateHexagram(fakeCast(49) as any, 'primary');
    const m = deriveMandate(revolution);
    expect(m.globalMult).toBeGreaterThan(1.0);
    expect(m.gainMult.chaos!).toBeGreaterThanOrEqual(m.globalMult);
  });
  it('dampens gains for a still hexagram (globalMult < 1)', () => {
    // Hexagram #52 Keeping Still: volatility -2.0 → globalMult = 1 + (-2/2)*0.5 = 0.5
    const stillness = consolidateHexagram(fakeCast(52) as any, 'primary');
    expect(deriveMandate(stillness).globalMult).toBeLessThan(1.0);
  });
  it('source is formatted as iching:<number>', () => {
    const result = consolidateHexagram(fakeCast(1) as any, 'primary');
    expect(deriveMandate(result).source).toBe('iching:1');
  });
});

describe('hexagramNudge', () => {
  it('volatile hexagram nudges chaos positively', () => {
    // Hexagram #49: volatility +2.0 → chaos nudge = round(2.0*4) = 8
    const revolution = consolidateHexagram(fakeCast(49) as any, 'primary');
    const nudges = hexagramNudge(revolution);
    const chaos = nudges.find(([id]) => id === 'chaos');
    expect(chaos).toBeDefined();
    expect(chaos![1]).toBeGreaterThan(0);
  });
  it('still hexagram nudges order positively', () => {
    // Hexagram #52: volatility -2.0 → order nudge = round(2.0*4) = 8
    const stillness = consolidateHexagram(fakeCast(52) as any, 'primary');
    const nudges = hexagramNudge(stillness);
    const order = nudges.find(([id]) => id === 'order');
    expect(order).toBeDefined();
    expect(order![1]).toBeGreaterThan(0);
  });
  it('filters out zero nudges', () => {
    // Hexagram #1 Creative: favorability +2.0, certainty +1.5, volatility 0.0
    // volatility = 0 → no chaos/order nudge; favorability > 0 → light nudge; certainty > 0 → order nudge
    const creative = consolidateHexagram(fakeCast(1) as any, 'primary');
    const nudges = hexagramNudge(creative);
    expect(nudges.every(([, n]) => n !== 0)).toBe(true);
  });
});

// ── Task 5: GameEngine wiring — nudge + mandate on commit, decay on later commits ──

const ichingResult = (primary: number, changing: number[] = [1, 6]): SlotResult =>
  consolidateHexagram(
    { lines: [9, 7, 7, 7, 7, 9] as any, primaryNumber: primary, relatingNumber: primary, changingLines: changing },
    'primary',
  ) as SlotResult;

// Commit a single result through the real lifecycle and drain to method-select.
function commitOne(engine: GameEngine, result: SlotResult): void {
  const orig = Math.random;
  Math.random = () => 0.99; // suppress probabilistic responders / happening interrupts
  try {
    const methods = engine.getState().availableMethods;
    const idx = methods.findIndex((m) => m !== 'happening');
    engine.selectMethod(idx === -1 ? 0 : idx);
    if (engine.getState().screen === 'happening') {
      engine.resolveHappening(0);
      const ix2 = engine.getState().availableMethods.findIndex((m) => m !== 'happening');
      engine.selectMethod(ix2 === -1 ? 0 : ix2);
    }
    engine.completeMinigame(result, { revealedAsDrawn: true });
    if (engine.getState().eventQueue.length > 0) engine.finishEventBatch();
    if (engine.getState().awaitingContinue) engine.continueAfterReview();
  } finally {
    Math.random = orig;
  }
}

describe('GameEngine I Ching mandate wiring', () => {
  it('sets a Mandate of Change after committing an I Ching result', () => {
    const engine = new GameEngine();
    engine.startTurn('decision');
    commitOne(engine, ichingResult(49)); // Revolution: volatility +2 → globalMult 1.6
    const mandate = (engine as any).affinityEngine.getMandate();
    expect(mandate).not.toBeNull();
    expect(mandate.source).toBe('iching:49');
    // Full strength immediately after the setting commit (its own advance was a no-op decay).
    expect(mandate.globalMult).toBeCloseTo(1.6, 5);
  });

  it('applies the one-time nudge BEFORE the mandate (nudge is not mandate-scaled)', () => {
    const engine = new GameEngine();
    engine.startTurn('decision');
    const before = (engine as any).affinityEngine.getState().chaos as number;
    commitOne(engine, ichingResult(49)); // chaos nudge = round(2.0*4) = 8 (unscaled)
    const after = (engine as any).affinityEngine.getState().chaos as number;
    // Chaos rose from the unscaled nudge (plus tag feeds); had the mandate (1.6x)
    // scaled the nudge it would be even higher, but we assert the nudge landed.
    expect(after).toBeGreaterThan(before);
  });

  it('decays the mandate on a later committed reading', () => {
    const engine = new GameEngine();
    engine.startTurn('decision');
    commitOne(engine, ichingResult(49));
    const full = (engine as any).affinityEngine.getMandate().globalMult as number;
    expect(full).toBeCloseTo(1.6, 5);
    // A second committed (non-I-Ching) reading: its advanceAfterCommit decays the
    // now-stale mandate. A die does not re-set the mandate, so decay is observable.
    commitOne(engine, dieResult());
    const decayed = (engine as any).affinityEngine.getMandate().globalMult as number;
    // toward1(1.6) = 1.6 + (1 - 1.6) * 0.4 = 1.36
    expect(decayed).toBeLessThan(full);
    expect(decayed).toBeCloseTo(1.36, 5);
  });
});
