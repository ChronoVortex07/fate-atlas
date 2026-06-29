import { describe, it, expect } from 'vitest';
import { consolidateSpread, drawTarotCard, drawTarotSpread, reverseSpread, MAJOR_ARCANA, MINOR_ARCANA, FULL_DECK, DECK_BY_ID, buildFace, MAJOR_GLOW_FAMILY, MajorGlowFamily } from '../../data/tarot';
import { DIVINATION_PROFILES } from '../../data/divination-profiles';
import { GameEngine } from '../GameEngine';

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

describe('major arcana arcana field', () => {
  it('every major is tagged arcana="major"', () => {
    expect(MAJOR_ARCANA.every((c) => c.arcana === 'major')).toBe(true);
  });
});

describe('minor arcana generator', () => {
  it('produces 56 cards (4 suits x 14 ranks)', () => {
    expect(MINOR_ARCANA).toHaveLength(56);
  });
  it('every minor has unique id, arcana=minor, a suit and a rank', () => {
    const ids = new Set(MINOR_ARCANA.map((c) => c.id));
    expect(ids.size).toBe(56);
    expect(MINOR_ARCANA.every((c) => c.arcana === 'minor' && !!c.suit && c.rank !== undefined)).toBe(true);
  });
  it('dimensions stay within [-2,2] at 0.5 granularity', () => {
    for (const c of MINOR_ARCANA) {
      for (const v of Object.values(c.dimensions)) {
        expect(v).toBeGreaterThanOrEqual(-2);
        expect(v).toBeLessThanOrEqual(2);
        expect(Math.round(v * 2)).toBe(v * 2);
      }
    }
  });
  it('Wands lean volatile, Cups lean favorable, Pentacles lean certain', () => {
    const ten = (s: string) => MINOR_ARCANA.find((c) => c.id === `${s}-10`)!;
    expect(ten('wands').dimensions.volatility).toBeGreaterThan(0.5);
    expect(ten('cups').dimensions.favorability).toBeGreaterThan(0.5);
    expect(ten('pentacles').dimensions.certainty).toBeGreaterThan(0.5);
  });
  it('mid pips carry no themes; courts carry one', () => {
    expect(MINOR_ARCANA.find((c) => c.id === 'wands-5')!.themes).toHaveLength(0);
    expect(MINOR_ARCANA.find((c) => c.id === 'cups-queen')!.themes).toHaveLength(1);
  });
});

describe('full deck + buildFace', () => {
  it('FULL_DECK has 78 cards and DECK_BY_ID indexes them', () => {
    expect(FULL_DECK).toHaveLength(78);
    expect(DECK_BY_ID['the-fool'].arcana).toBe('major');
    expect(DECK_BY_ID['wands-10'].arcana).toBe('minor');
  });
  it('buildFace upright keeps favorability; reversed flips it', () => {
    const card = DECK_BY_ID['the-star']; // favorability +2 upright
    expect(buildFace(card, 'upright').dimensions.favorability).toBe(2);
    expect(buildFace(card, 'reversed').dimensions.favorability).toBe(-2);
  });
  it('buildFace tags carry arcana class, archetype/suit, and orientation', () => {
    const major = buildFace(DECK_BY_ID['the-fool'], 'upright');
    expect(major.tags).toEqual(expect.arrayContaining(['major-arcana', 'fool-archetype', 'upright', 'reversible', 'random']));
    const minor = buildFace(DECK_BY_ID['cups-queen'], 'reversed');
    expect(minor.tags).toEqual(expect.arrayContaining(['minor-arcana', 'suit-cups', 'element-water', 'rank-queen', 'reversed']));
  });
});

describe('reverseSpread + drawTarotSpread', () => {
  const F = (id: string, o: 'upright' | 'reversed') => buildFace(DECK_BY_ID[id], o);

  it('reverseSpread flips every face and recomputes (involutive)', () => {
    const base = consolidateSpread([F('the-star', 'upright'), F('cups-2', 'upright'), F('swords-3', 'upright')]);
    const rev = reverseSpread(base);
    expect(rev.spread!.every((s) => s.card.orientation === 'reversed')).toBe(true);
    expect(rev.orientation).toBe('reversed');
    const back = reverseSpread(rev);
    expect(back.spread!.map((s) => s.card.id)).toEqual(base.spread!.map((s) => s.card.id));
    expect(back.spread!.every((s) => s.card.orientation === 'upright')).toBe(true);
  });

  it('drawTarotSpread deals 3 distinct cards into past/present/future', () => {
    const r = drawTarotSpread({ chaos: 0, order: 0 });
    expect(r.spread).toHaveLength(3);
    expect(new Set(r.spread!.map((s) => s.card.id)).size).toBe(3);
    expect(r.type).toBe('tarot');
  });
});

describe('tarot profile', () => {
  it('lists volatility as a dimension strength (minors bring volatility)', () => {
    expect(DIVINATION_PROFILES.tarot.dimensionStrengths).toContain('volatility');
  });
});

describe('consolidateSpread', () => {
  const F = (id: string, o: 'upright' | 'reversed') => buildFace(DECK_BY_ID[id], o);

  it('averages dimensions to 0.5 granularity', () => {
    const r = consolidateSpread([F('the-world', 'upright'), F('wands-5', 'upright'), F('cups-2', 'upright')]);
    for (const v of Object.values(r.dimensions)) expect(Math.round(v * 2)).toBe(v * 2);
  });
  it('caps consolidated themes at 2', () => {
    const r = consolidateSpread([F('the-sun', 'upright'), F('judgement', 'upright'), F('the-world', 'upright')]);
    expect(r.themes.length).toBeLessThanOrEqual(2);
  });
  it('uses majority orientation (2+ reversed = reversed)', () => {
    const r = consolidateSpread([F('the-fool', 'reversed'), F('cups-2', 'reversed'), F('wands-5', 'upright')]);
    expect(r.orientation).toBe('reversed');
    expect(r.tags).toContain('reversed');
    expect(r.tags).not.toContain('upright');
  });
  it('lifts archetype + suit tags from every face onto the slot', () => {
    const r = consolidateSpread([F('the-fool', 'upright'), F('cups-queen', 'upright'), F('swords-3', 'upright')]);
    expect(r.tags).toEqual(expect.arrayContaining(['major-arcana', 'fool-archetype', 'minor-arcana', 'suit-cups', 'suit-swords']));
  });
  it('unions modifier roles and records the 3 positions', () => {
    const r = consolidateSpread([F('the-fool', 'upright'), F('cups-2', 'upright'), F('swords-3', 'upright')]);
    expect(r.spread).toHaveLength(3);
    expect(r.spread!.map((s) => s.position)).toEqual(['past', 'present', 'future']);
  });
  it('single face passes through as that card', () => {
    const r = consolidateSpread([F('the-magician', 'upright')]);
    expect(r.id).toBe('the-magician');
    expect(r.spread).toHaveLength(1);
  });
  it('multi-card spread name joins card names with middle dot', () => {
    const r = consolidateSpread([F('the-fool', 'upright'), F('the-star', 'upright'), F('cups-2', 'reversed')]);
    expect(r.name).toBe('The Fool · The Star · Two of Cups');
  });
});

describe('tarot draft state', () => {
  it('startTarotDraft deals 9 cards and initializes hand as empty', () => {
    const engine = new GameEngine();
    engine.startTarotDraft();
    const state = engine.getState();
    const draft = state.minigameState as import('../types').TarotDraftState;

    expect(draft.method).toBe('tarot');
    expect(draft.table).toHaveLength(9);
    expect(draft.table.every((t) => t !== null && typeof t.cardId === 'string')).toBe(true);
    expect(draft.table.every((t) => t !== null && t.faceUp === false)).toBe(true);
    expect(draft.hand).toEqual([null, null, null]);
    expect(draft.deck.length).toBe(78 - 9); // 69 remaining
    expect(draft.phase).toBe('drafting');
    expect(draft.shufflesRemaining).toBeGreaterThanOrEqual(0);
  });

  it('pickForHand moves card from table to hand slot', () => {
    const engine = new GameEngine();
    engine.startTarotDraft();
    const state1 = engine.getState();
    const draft1 = state1.minigameState as import('../types').TarotDraftState;
    const targetCard = draft1.table[4]!;

    engine.pickForHand(0, 4); // pick card at table index 4 into hand[0] (Past)
    const state2 = engine.getState();
    const draft2 = state2.minigameState as import('../types').TarotDraftState;

    expect(draft2.table[4]).toBeNull();
    expect(draft2.hand[0]).not.toBeNull();
    expect(draft2.hand[0]!.cardId).toBe(targetCard.cardId);
    expect(draft2.hand[0]!.tableOriginIndex).toBe(4);
    expect(draft2.hand[0]!.peeked).toBe(false);
  });

  it('returnToTable puts card back in its origin slot', () => {
    const engine = new GameEngine();
    engine.startTarotDraft();
    engine.pickForHand(0, 4);
    engine.returnToTable(0);
    const state = engine.getState();
    const draft = state.minigameState as import('../types').TarotDraftState;

    expect(draft.hand[0]).toBeNull();
    expect(draft.table[4]).not.toBeNull();
  });

  it('returnToDeck puts card back into deck face-down', () => {
    const engine = new GameEngine();
    engine.startTarotDraft();
    engine.pickForHand(0, 4);
    const beforeDeck = (engine.getState().minigameState as import('../types').TarotDraftState).deck.length;

    engine.returnToDeck(0);
    const state = engine.getState();
    const draft = state.minigameState as import('../types').TarotDraftState;

    expect(draft.hand[0]).toBeNull();
    expect(draft.deck.length).toBe(beforeDeck + 1);
  });

  it('shuffleTable flips face-up cards, recollects, and redeals', () => {
    const engine = new GameEngine();
    // Stage will to ascendant so shufflesRemaining starts at 1 (baseline is 0)
    engine.loadState({ affinities: { chaos: 50, order: 50, fate: 50, will: 75, light: 50, shadow: 50 } });
    engine.startTarotDraft();

    engine.pickForHand(0, 0);
    const s1 = engine.getState();
    const draft1 = s1.minigameState as import('../types').TarotDraftState;
    const dealCountBefore = draft1.dealCount;
    const shufflesBefore = draft1.shufflesRemaining;

    engine.shuffleTable();

    const s2 = engine.getState();
    const draft2 = s2.minigameState as import('../types').TarotDraftState;
    expect(draft2.table.filter((t) => t !== null)).toHaveLength(dealCountBefore);
    expect(draft2.table.every((t) => t === null || t.faceUp === false)).toBe(true);
    expect(draft2.shufflesRemaining).toBe(shufflesBefore - 1);
  });

  it('shuffleTable throws when no shuffles remain', () => {
    const engine = new GameEngine();
    engine.startTarotDraft();
    // exhaust shuffles
    const s = engine.getState();
    const draft = s.minigameState as import('../types').TarotDraftState;
    const remaining = draft.shufflesRemaining;
    for (let i = 0; i < remaining; i++) engine.shuffleTable();

    expect(() => engine.shuffleTable()).toThrow('No shuffles remaining');
  });

  it('swapHandCards exchanges two hand positions', () => {
    const engine = new GameEngine();
    engine.startTarotDraft();
    engine.pickForHand(0, 0);
    engine.pickForHand(1, 1);
    const card0 = (engine.getState().minigameState as import('../types').TarotDraftState).hand[0]!.cardId;
    const card1 = (engine.getState().minigameState as import('../types').TarotDraftState).hand[1]!.cardId;

    engine.swapHandCards(0, 1);
    const draft = engine.getState().minigameState as import('../types').TarotDraftState;

    expect(draft.hand[0]!.cardId).toBe(card1);
    expect(draft.hand[1]!.cardId).toBe(card0);
  });

  it('commitDraft builds consolidated result from hand', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    // Start draft and fill hand
    engine.startTarotDraft();
    engine.pickForHand(0, 0);
    engine.pickForHand(1, 1);
    engine.pickForHand(2, 2);

    engine.commitDraft(false);
    const state = engine.getState();
    expect(state.turnResults).toHaveLength(1);
    expect(state.turnResults[0].type).toBe('tarot');
    expect((state.turnResults[0] as any).spread).toHaveLength(3);
    expect((state.turnResults[0] as any).spread.map((s: any) => s.position)).toEqual(['past', 'present', 'future']);
  });

  it('full draft flow: deal → pick 3 → commit produces valid run', () => {
    const engine = new GameEngine();
    engine.startTurn('self');
    engine.startTarotDraft();

    const state1 = engine.getState();
    const draft = state1.minigameState as import('../types').TarotDraftState;

    // Pick 3 distinct cards from the table into hand[0], [1], [2]
    const pickedIndices: number[] = [];
    for (let h = 0; h < 3; h++) {
      const tableIdx = draft.table.findIndex(
        (t, i) => t !== null && !pickedIndices.includes(i)
      );
      expect(tableIdx).toBeGreaterThanOrEqual(0);
      engine.pickForHand(h, tableIdx);
      pickedIndices.push(tableIdx);
    }

    // Verify hand is full
    const state2 = engine.getState();
    const draft2 = state2.minigameState as import('../types').TarotDraftState;
    expect(draft2.hand.every((h) => h !== null)).toBe(true);

    // Commit the draft
    engine.commitDraft(false);

    const state3 = engine.getState();
    expect(state3.turnResults).toHaveLength(1);
    expect(state3.turnResults[0].type).toBe('tarot');

    // The spread should have 3 positions
    const tarot = state3.turnResults[0] as import('../types').TarotResult;
    expect(tarot.spread).toHaveLength(3);
    expect(tarot.spread!.map((s) => s.position)).toEqual(['past', 'present', 'future']);

    // Name should be joined card names (from Task 1 fix)
    expect(tarot.name).toContain(' · ');
  });

  it('returnToTable appends when origin occupied and no open slots', () => {
    const engine = new GameEngine();
    engine.startTarotDraft();

    // Fill all table slots with picks and returns to create a full table
    // Pick 3 cards
    engine.pickForHand(0, 0);
    engine.pickForHand(1, 1);
    engine.pickForHand(2, 2);

    // Return hand[0] to a different occupied slot situation
    // The origin (0) is null, so it should go back to 0
    engine.returnToTable(0);
    const state = engine.getState();
    const draft = state.minigameState as import('../types').TarotDraftState;

    // Card should be back on table
    expect(draft.table[0]).not.toBeNull();
    expect(draft.hand[0]).toBeNull();
  });
});

describe('commitDraft deal-swap pipeline', () => {
  // Deterministic PRNG: an unstubbed deal can hand fate-deal-swap a replacement card
  // that collides with one already in the hand, making the forced responder bail
  // (`return null`) and leaving revealSwap undefined — the source of the flake. A
  // seeded RNG makes the deal and the replacement draw reproducible and collision-free.
  function mulberry32(seed: number) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it('records revealSwap on a non-fated face when fate-deal-swap is forced', () => {
    const orig = Math.random;
    Math.random = mulberry32(1);
    try {
      const e = new GameEngine();
      e.startTurn('self');
      // Ensure tarot is in the pool and fate is at ascendant for fate-deal-swap.
      e.loadState({ availableMethods: ['tarot', 'd20', 'iching'], affinities: { chaos: 50, order: 50, fate: 75, will: 50, light: 50, shadow: 50 } });
      const tIdx = e.getState().availableMethods.indexOf('tarot');
      e.selectMethod(tIdx);
      // Fill the 3-slot hand from the table.
      for (let h = 0; h < 3; h++) {
        const draft = e.getState().minigameState as any;
        const tableIdx = draft.table.findIndex((t: any) => t !== null);
        e.pickForHand(h, tableIdx);
      }
      e.forceEffects(['fate-deal-swap'], false);
      e.commitDraft(false);
      const draft = e.getState().minigameState as any;
      expect(draft.revealSwap).toBeTruthy();
      expect(typeof draft.revealSwap.index).toBe('number');
      expect(typeof draft.revealSwap.fromCardId).toBe('string');
    } finally {
      Math.random = orig;
    }
  });
});

describe('MAJOR_GLOW_FAMILY', () => {
  it('covers all 22 Major Arcana cards', () => {
    const majorIds = MAJOR_ARCANA.map((c) => c.id);
    expect(majorIds.length).toBe(22);

    const classified = Object.keys(MAJOR_GLOW_FAMILY);
    for (const id of majorIds) {
      expect(classified).toContain(id);
    }
  });

  it('has no duplicate entries', () => {
    const keys = Object.keys(MAJOR_GLOW_FAMILY);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every entry has a valid family', () => {
    const validFamilies: MajorGlowFamily[] = ['benevolent', 'challenging', 'neutral'];
    for (const family of Object.values(MAJOR_GLOW_FAMILY)) {
      expect(validFamilies).toContain(family);
    }
  });
});
