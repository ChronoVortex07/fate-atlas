# Tarot Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the incomplete, emoji-dependent tarot icon system with a complete, pure, testable geometric sigil module (22 bespoke majors + composed minors), a standardized constellation-crest card back, and a celestial+arcane polish pass on the draft UI.

**Architecture:** Extract sigil *resolution* into a framework-free `src/data/sigils.ts` (data + pure `resolveSigil`) that the engine test suite can cover; `CardSigil` becomes a thin SVG renderer over it (majors = multi-stroke paths, minors = emblem + corner cartouche + optional crown, spreads = crest). A new presentational `CardBack` standardizes face-down cards. UI polish in `TarotMinigame` reuses existing `StarField`-style atmosphere, `OrnamentalBorder`, and `RunicBand` — presentational only, no engine changes.

**Tech Stack:** React 18 + TypeScript + Vite, framer-motion, Vitest (engine tests only: `src/engine/__tests__/**`, Node env). SVG line-art, `viewBox 0 0 48 48`, `stroke=currentColor`, `fill=none`, `stroke-width 1.5`.

## Global Constraints

- `src/data/sigils.ts` is framework-free: zero React/DOM imports (it is imported by the engine test scope).
- UI polish is presentational only — no engine/logic changes; keep the engine/React split.
- Shared drawing contract for every sigil: `viewBox 0 0 48 48`, `stroke=currentColor`, `fill=none`, `stroke-width ≈ 1.5`, rounded caps/joins, centered with balanced negative space.
- No generic-circle fallback may render for a real tarot card (all 22 majors authored; every minor composes).
- Reversed cards keep the existing 180° rotation convention.
- `tsc` runs with `strict`, `noUnusedLocals`, `noUnusedParameters`. Typecheck via `npx tsc -b`.
- Vitest only discovers `src/engine/__tests__/**`; component code has no automated tests (verify by typecheck + dev server).
- Non-tarot iconography (dice, I Ching, question types) is out of scope; the tarot `symbol` data field may remain but must no longer be *rendered* for tarot.

---

## Task 1: Pure sigil module + completeness tests

**Files:**
- Create: `src/data/sigils.ts`
- Test: `src/engine/__tests__/Sigils.test.ts`

**Interfaces:**
- Produces:
  - `type SigilSpec = { kind: 'major'; paths: string[] } | { kind: 'minor'; emblem: string[]; rank: { label: string; court: boolean } } | { kind: 'spread'; paths: string[] }`
  - `MAJOR_SIGILS: Record<string, string[]>` — keyed by major id; value is an array of path `d` strings (multi-stroke).
  - `SUIT_EMBLEMS: Record<'wands'|'cups'|'swords'|'pentacles', string[]>`
  - `SPREAD_CREST: string[]`
  - `resolveSigil(card: TarotResult | TarotCardFace): SigilSpec`
  - `rankLabel(rank: number | 'page' | 'knight' | 'queen' | 'king'): string` — `'A'` for 1; roman `II`–`X` for 2–10; `P/N/Q/K` for courts.

- [ ] **Step 1: Write the failing completeness tests**

Create `src/engine/__tests__/Sigils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveSigil, MAJOR_SIGILS, rankLabel } from '../../data/sigils';
import type { TarotCardFace, TarotResult } from '../types';
import { MAJOR_ARCANA, generateMinorArcana } from '../../data/tarot';

const face = (o: Partial<TarotCardFace>): TarotCardFace => ({
  id: 'x', name: 'X', arcana: 'major', orientation: 'upright', symbol: '',
  themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 },
  modifierRoles: [], meaningUpright: '', meaningReversed: '', tags: [], ...o,
});

describe('resolveSigil', () => {
  it('every major id resolves to a bespoke multi-stroke major sigil (no generic fallback)', () => {
    for (const m of MAJOR_ARCANA) {
      const spec = resolveSigil(face({ id: m.id, arcana: 'major' }));
      expect(spec.kind).toBe('major');
      if (spec.kind === 'major') {
        expect(MAJOR_SIGILS[m.id]).toBeDefined();
        expect(spec.paths.length).toBeGreaterThan(0);
        expect(spec.paths.every((p) => p.length > 0)).toBe(true);
      }
    }
  });

  it('MAJOR_SIGILS has exactly the 22 canonical ids and nothing extra', () => {
    const ids = new Set(MAJOR_ARCANA.map((m) => m.id));
    expect(Object.keys(MAJOR_SIGILS).sort()).toEqual([...ids].sort());
  });

  it('every minor composes: emblem present, correct rank label and court flag', () => {
    for (const m of generateMinorArcana()) {
      const spec = resolveSigil(face({ id: m.id, arcana: 'minor', suit: m.suit, rank: m.rank }));
      expect(spec.kind).toBe('minor');
      if (spec.kind === 'minor') {
        expect(spec.emblem.length).toBeGreaterThan(0);
        const court = typeof m.rank !== 'number';
        expect(spec.rank.court).toBe(court);
        expect(spec.rank.label).toBe(rankLabel(m.rank!));
      }
    }
  });

  it('rankLabel maps aces, pips, and courts', () => {
    expect(rankLabel(1)).toBe('A');
    expect(rankLabel(2)).toBe('II');
    expect(rankLabel(9)).toBe('IX');
    expect(rankLabel(10)).toBe('X');
    expect(rankLabel('page')).toBe('P');
    expect(rankLabel('knight')).toBe('N');
    expect(rankLabel('queen')).toBe('Q');
    expect(rankLabel('king')).toBe('K');
  });

  it('a multi-card spread resolves to the crest', () => {
    const spread = {
      type: 'tarot', id: 's', name: 'Spread', orientation: 'upright', spread: [
        { position: 'past', card: face({ id: 'the-fool' }) },
        { position: 'present', card: face({ id: 'the-sun' }) },
        { position: 'future', card: face({ id: 'the-moon' }) },
      ],
    } as unknown as TarotResult;
    const spec = resolveSigil(spread);
    expect(spec.kind).toBe('spread');
  });

  it('a single-card tarot result resolves by its underlying face', () => {
    const single = {
      type: 'tarot', id: 'the-tower', name: 'The Tower', orientation: 'upright',
      spread: [{ position: 'present', card: face({ id: 'the-tower' }) }],
    } as unknown as TarotResult;
    const spec = resolveSigil(single);
    expect(spec.kind).toBe('major');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/engine/__tests__/Sigils.test.ts`
Expected: FAIL — `../../data/sigils` cannot be resolved (module missing).

- [ ] **Step 3: Create `src/data/sigils.ts` with the full registry and resolver**

Create `src/data/sigils.ts`:

```typescript
import type { TarotResult, TarotCardFace } from '../engine/types';

type AnyCard = TarotResult | TarotCardFace;
type Suit = 'wands' | 'cups' | 'swords' | 'pentacles';
type Rank = number | 'page' | 'knight' | 'queen' | 'king';

export type SigilSpec =
  | { kind: 'major'; paths: string[] }
  | { kind: 'minor'; emblem: string[]; rank: { label: string; court: boolean } }
  | { kind: 'spread'; paths: string[] };

// All paths share the contract: viewBox 0 0 48 48, stroke=currentColor, fill=none,
// stroke-width ~1.5, rounded caps/joins. Each value is an array of independent strokes.
export const MAJOR_SIGILS: Record<string, string[]> = {
  // 0 The Fool — cliff edge + rising sun disc + a small bundle (leap into the unknown)
  'the-fool': ['M8 36 H22 L26 30', 'M30 16 A8 8 0 1 1 29.99 16', 'M38 36 l4 -4 l-2 6 Z'],
  // I The Magician — infinity lemniscate over an upright wand
  'the-magician': ['M24 10 V30', 'M16 12 H32', 'M14 36 a5 4 0 1 0 10 0 a5 4 0 1 0 10 0'],
  // II The High Priestess — crescent between two pillars + veil line
  'the-high-priestess': ['M14 10 V38', 'M34 10 V38', 'M20 24 a6 6 0 1 0 9 -5 a8 8 0 1 1 -9 5', 'M14 30 H34'],
  // III The Empress — Venus glyph crowned (orb + cross + small crown arc)
  'the-empress': ['M24 12 a7 7 0 1 0 0.01 0', 'M24 26 V40', 'M17 33 H31', 'M18 9 l3 4 l3 -4 l3 4 l3 -4'],
  // IV The Emperor — Aries ram horns over a squared throne
  'the-emperor': ['M24 14 V30', 'M24 14 a6 6 0 0 0 -10 -2', 'M24 14 a6 6 0 0 1 10 -2', 'M16 30 H32 V40 H16 Z'],
  // V The Hierophant — triple cross / keys (vertical staff + 3 crossbars + base)
  'the-hierophant': ['M24 8 V40', 'M16 16 H32', 'M14 24 H34', 'M18 32 H30', 'M20 40 H28'],
  // VI The Lovers — two interlocking rings beneath an arc
  'the-lovers': ['M19 28 a6 6 0 1 0 0.01 0', 'M29 28 a6 6 0 1 0 0.01 0', 'M14 16 a10 6 0 0 1 20 0'],
  // VII The Chariot — chariot canopy + two wheels
  'the-chariot': ['M12 26 H36 L32 16 H16 Z', 'M18 34 a4 4 0 1 0 0.01 0', 'M30 34 a4 4 0 1 0 0.01 0'],
  // VIII Strength — lemniscate over a gentle lion-jaw arc (force tamed)
  'strength': ['M12 22 a5 4 0 1 0 10 0 a5 4 0 1 0 10 0', 'M16 30 a8 7 0 0 0 16 0', 'M20 30 V33', 'M28 30 V33'],
  // IX The Hermit — lantern (diamond) on a staff with a small flame
  'the-hermit': ['M30 10 V40', 'M22 20 l6 -6 l6 6 l-6 6 Z', 'M28 18 v-3', 'M12 40 H30'],
  // X Wheel of Fortune — spoked ring
  'wheel-of-fortune': ['M24 8 a16 16 0 1 0 0.01 0', 'M24 12 V36', 'M12 24 H36', 'M15 15 L33 33', 'M33 15 L15 33'],
  // XI Justice — balance scales (beam, two pans, central post)
  'justice': ['M24 10 V34', 'M12 16 H36', 'M12 16 l-3 7 h6 Z', 'M36 16 l-3 7 h6 Z', 'M16 38 H32'],
  // XII The Hanged Man — inverted suspended figure (T-bar + hanging line + triangle legs)
  'the-hanged-man': ['M12 12 H36', 'M24 12 V26', 'M24 26 a4 4 0 1 0 0.01 0', 'M21 33 L18 40', 'M27 33 L30 40'],
  // XIII Death — scythe (curved blade + long snath)
  'death': ['M16 40 L34 14', 'M34 14 a10 10 0 0 0 -14 2', 'M20 30 a5 5 0 1 0 0.01 0'],
  // XIV Temperance — two vessels with a flowing stream between them
  'temperance': ['M14 14 a6 4 0 0 0 12 0', 'M22 34 a6 4 0 0 0 12 0', 'M20 16 L30 32', 'M22 14 L18 18', 'M30 34 L34 30'],
  // XV The Devil — inverted pentagram inside a horned arc
  'the-devil': ['M24 14 L31 34 L14 21 H34 L17 34 Z', 'M14 12 a6 5 0 0 1 8 2', 'M34 12 a6 5 0 0 0 -8 2'],
  // XVI The Tower — struck tower with falling crown + lightning bolt
  'the-tower': ['M16 40 V20 H32 V40', 'M14 20 H34 L30 14 H18 Z', 'M24 6 L20 16 H27 L23 26', 'M19 30 H29'],
  // XVII The Star — eight-point star over wavy water
  'the-star': ['M24 8 L27 21 L40 24 L27 27 L24 40 L21 27 L8 24 L21 21 Z', 'M14 36 q5 -3 10 0 t10 0'],
  // XVIII The Moon — crescent + a winding path between two towers
  'the-moon': ['M20 22 a8 8 0 1 0 9 -6 a10 10 0 1 1 -9 6', 'M16 40 q4 -8 0 -16', 'M32 40 q-4 -8 0 -16', 'M24 40 V20'],
  // XIX The Sun — radiant disc with rays
  'the-sun': ['M24 16 a8 8 0 1 0 0.01 0', 'M24 6 V10', 'M24 38 V42', 'M6 24 H10', 'M38 24 H42', 'M11 11 L14 14', 'M37 11 L34 14', 'M11 37 L14 34', 'M37 37 L34 34'],
  // XX Judgement — trumpet with three sound-arcs
  'judgement': ['M12 30 L30 22 L34 26 L16 34 Z', 'M30 22 L38 18', 'M20 14 a6 6 0 0 1 6 4', 'M16 12 a10 10 0 0 1 11 6'],
  // XXI The World — laurel wreath (ellipse) cradling a small cross of axes
  'the-world': ['M24 8 a12 16 0 1 0 0.01 0', 'M24 14 V34', 'M16 24 H32', 'M18 12 l-3 3', 'M30 12 l3 3', 'M18 36 l-3 -3', 'M30 36 l3 -3'],
};

export const SUIT_EMBLEMS: Record<Suit, string[]> = {
  // Wands — a budding staff
  wands: ['M24 8 V40', 'M24 8 l-5 6', 'M24 8 l5 6', 'M24 18 l-4 4', 'M24 18 l4 4'],
  // Cups — a footed chalice
  cups: ['M14 14 H34 a10 10 0 0 1 -20 0 Z', 'M24 24 V36', 'M16 40 H32', 'M20 40 v-4 h8 v4'],
  // Swords — an upright blade with crossguard
  swords: ['M24 6 V34', 'M16 30 H32', 'M24 34 l-4 6 h8 Z', 'M20 8 L24 6 L28 8'],
  // Pentacles — a five-point star within a ring
  pentacles: ['M24 8 a16 16 0 1 0 0.01 0', 'M24 12 L29 32 L11 19 H37 L19 32 Z'],
};

// Three overlapping cards crest (refined) — drawn back-to-front.
export const SPREAD_CREST: string[] = [
  'M10 16 H26 V40 H10 Z',
  'M16 11 H34 V36 H16 Z',
  'M22 6 H42 V32 H22 Z',
];

const ROMAN: Record<number, string> = {
  1: 'A', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
};
const COURT_LETTER: Record<string, string> = { page: 'P', knight: 'N', queen: 'Q', king: 'K' };

export function rankLabel(rank: Rank): string {
  if (typeof rank === 'number') return ROMAN[rank] ?? String(rank);
  return COURT_LETTER[rank] ?? rank[0].toUpperCase();
}

function isFace(c: AnyCard): c is TarotCardFace {
  return 'arcana' in c;
}

/** The face a result should be drawn as: its own (face) or the middle/only spread card. */
function primaryFace(card: AnyCard): TarotCardFace | undefined {
  if (isFace(card)) return card;
  const spread = card.spread;
  if (!spread || spread.length === 0) return undefined;
  return spread[Math.min(1, spread.length - 1)].card;
}

export function resolveSigil(card: AnyCard): SigilSpec {
  if (!isFace(card) && (card.spread?.length ?? 1) > 1) {
    return { kind: 'spread', paths: SPREAD_CREST };
  }
  const f = primaryFace(card);
  if (f && f.arcana === 'minor' && f.suit) {
    return {
      kind: 'minor',
      emblem: SUIT_EMBLEMS[f.suit],
      rank: { label: rankLabel(f.rank ?? 1), court: typeof f.rank !== 'number' },
    };
  }
  const id = f?.id ?? (isFace(card) ? card.id : card.id);
  return { kind: 'major', paths: MAJOR_SIGILS[id] ?? [] };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/__tests__/Sigils.test.ts`
Expected: PASS (all 6 tests). The completeness test fails loudly if any of the 22 majors is missing or has an empty path.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc -b
git add src/data/sigils.ts src/engine/__tests__/Sigils.test.ts
git commit -m "feat(sigils): pure tarot sigil registry with 22 majors and minor composition"
```

---

## Task 2: `CardSigil` renders over `resolveSigil`

**Files:**
- Modify: `src/components/cards/CardSigil.tsx` (full rewrite)

**Interfaces:**
- Consumes: `resolveSigil`, `SigilSpec` from `src/data/sigils.ts`.

No automated test (component layer). Verify by typecheck; visual check on the dev server.

- [ ] **Step 1: Rewrite `CardSigil.tsx` as a thin renderer**

Replace the entire contents of `src/components/cards/CardSigil.tsx`:

```tsx
import type { TarotResult, TarotCardFace } from '../../engine/types';
import { resolveSigil } from '../../data/sigils';

type AnyCard = TarotResult | TarotCardFace;

function isFace(c: AnyCard): c is TarotCardFace { return 'arcana' in c; }

export default function CardSigil({
  card, size = 48, color = 'currentColor',
}: { card: AnyCard; size?: number; color?: string }) {
  const reversed = card.orientation === 'reversed';
  const spec = resolveSigil(card);
  const label = isFace(card) ? card.name : (card as TarotResult).name;

  const stroke = (
    <g stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round">
      {spec.kind === 'major' && spec.paths.map((d, i) => <path key={i} d={d} />)}
      {spec.kind === 'spread' && spec.paths.map((d, i) => <path key={i} d={d} />)}
      {spec.kind === 'minor' && (
        <>
          {/* Court crown above the emblem */}
          {spec.rank.court && <path d="M17 9 l3 4 l4 -4 l4 4 l3 -4 v4 h-14 Z" />}
          {spec.emblem.map((d, i) => <path key={i} d={d} />)}
          {/* Rank cartouche — rounded rect bottom-right + numeral */}
          <rect x="31" y="33" width="14" height="11" rx="2.5" />
          <text
            x="38" y="41.5" textAnchor="middle" fontSize="8"
            fontFamily="'Cormorant Garamond', serif" fill={color} stroke="none"
          >
            {spec.rank.label}
          </text>
        </>
      )}
    </g>
  );

  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={label}
      style={{ transform: reversed ? 'rotate(180deg)' : undefined, color }}
    >
      {stroke}
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors. (Confirms the old `MAJOR_SIGILS`/`SUIT_EMBLEM`/`GENERIC` locals are gone and `resolveSigil` is wired.)

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/CardSigil.tsx
git commit -m "feat(sigils): CardSigil renders composed majors, minors, and spread crest"
```

---

## Task 3: Standardized `CardBack` + replace runes

**Files:**
- Create: `src/components/cards/CardBack.tsx`
- Modify: `src/components/screens/TarotMinigame.tsx` (face-down table cards L304-309 region; face-down hand cards L376-381 region; deck stack `deckCardBack`)
- Modify: `src/components/cards/FanCard.tsx` (replace the two `RUNE_SETS` bands with `CardBack` framing)

**Interfaces:**
- Produces: `CardBack` — `export default function CardBack({ size = 48, color = '#7b9ec7', accent = '#d4a854' }: { size?: number; color?: string; accent?: string })` — a self-contained SVG constellation-crest back.

No automated test (component layer). Verify by typecheck + dev server.

- [ ] **Step 1: Create `src/components/cards/CardBack.tsx`**

```tsx
// Standardized face-down card back: a faint geometric crest over a sparse
// star pattern, in muted blue/gold. Pure presentational SVG, scales to `size`.
export default function CardBack({
  size = 48,
  color = '#7b9ec7',
  accent = '#d4a854',
}: { size?: number; color?: string; accent?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 64" role="img" aria-label="Face-down card" style={{ display: 'block' }}>
      <rect x="1" y="1" width="46" height="62" rx="4" fill="#080d18" stroke={color} strokeWidth="0.75" opacity="0.9" />
      <rect x="4" y="4" width="40" height="56" rx="3" fill="none" stroke={accent} strokeWidth="0.5" opacity="0.4" />
      {/* Central crest — diamond + ring */}
      <g stroke={accent} strokeWidth="0.9" fill="none" opacity="0.7" strokeLinejoin="round">
        <circle cx="24" cy="32" r="9" />
        <path d="M24 21 L31 32 L24 43 L17 32 Z" />
        <path d="M24 26 L24 38 M18 32 H30" stroke={color} strokeWidth="0.6" opacity="0.8" />
      </g>
      {/* Sparse stars */}
      <g fill={color} opacity="0.7">
        <circle cx="12" cy="12" r="0.7" />
        <circle cx="36" cy="14" r="0.6" />
        <circle cx="10" cy="50" r="0.6" />
        <circle cx="38" cy="52" r="0.7" />
        <circle cx="24" cy="9" r="0.5" />
        <circle cx="24" cy="55" r="0.5" />
      </g>
      <g fill={accent} opacity="0.6">
        <circle cx="14" cy="30" r="0.5" />
        <circle cx="34" cy="34" r="0.5" />
      </g>
    </svg>
  );
}
```

- [ ] **Step 2: Use `CardBack` for face-down table cards in `TarotMinigame`**

In `src/components/screens/TarotMinigame.tsx`, add the import near the top (after the `CardSigil` import):

```typescript
import CardBack from '../cards/CardBack';
```

Replace the face-down table-card branch (the `<>...ᚠᚢᚦ...✧...</>` else-branch inside the table card, currently:

```tsx
                    ) : (
                      <>
                        <span style={tableRuneStyle}>ᚠᚢᚦ</span>
                        <span style={tableStarStyle}>✧</span>
                      </>
                    )}
```

with:

```tsx
                    ) : (
                      <CardBack size={44} />
                    )}
```

- [ ] **Step 3: Use `CardBack` for face-down hand cards in `TarotMinigame`**

Replace the face-down hand-card branch (currently:

```tsx
                        ) : (
                          <>
                            <span style={handRuneStyle}>ᚠᚢᚦᚨ</span>
                            <span style={handStarStyle}>✧</span>
                          </>
                        )}
```

with:

```tsx
                        ) : (
                          <CardBack size={64} />
                        )}
```

- [ ] **Step 4: Give the deck stack a crest back**

In `src/components/screens/TarotMinigame.tsx`, the deck stack renders up to three `deckCardBack(i)` divs. Leave the stacked-offset divs as the depth shadow, but overlay a `CardBack` on the top of the stack. Replace the `deckStackStyle` block:

```tsx
          <div style={deckStackStyle}>
            {draft.deck.length > 0 && <div style={deckCardBack(0)} />}
            {draft.deck.length > 1 && <div style={deckCardBack(1)} />}
            {draft.deck.length > 2 && <div style={deckCardBack(2)} />}
          </div>
```

with:

```tsx
          <div style={deckStackStyle}>
            {draft.deck.length > 1 && <div style={deckCardBack(1)} />}
            {draft.deck.length > 2 && <div style={deckCardBack(2)} />}
            {draft.deck.length > 0 && (
              <div style={{ ...deckCardBack(0), display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none' }}>
                <CardBack size={46} />
              </div>
            )}
          </div>
```

- [ ] **Step 5: Replace `FanCard` runic bands with the crest back framing**

In `src/components/cards/FanCard.tsx`, the two runic-band `<div>`s (top at L214-231 and bottom at L297-314) render `{runes}`. The face is always shown content-side up here, so just refine the bands to a subtle gold hairline instead of runes (the full `CardBack` is for face-down contexts; `FanCard` shows revealed results). Replace the `{runes}` content in **both** band divs with a centered middot row:

Top band — replace `{runes}` with:

```tsx
        ·····
```

Bottom band — replace `{runes}` with:

```tsx
        ·····
```

Then remove the now-unused `RUNE_SETS` constant (L86) and the `const runes = RUNE_SETS[index % RUNE_SETS.length];` line (L130) — `tsc` with `noUnusedLocals` will flag them.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b`
Expected: no errors (no unused `RUNE_SETS`/`runes`, `tableRuneStyle`/`tableStarStyle`/`handRuneStyle`/`handStarStyle` may now be unused — remove any that `tsc` flags).

- [ ] **Step 7: Remove any newly-unused styles flagged by tsc**

If `npx tsc -b` reports `tableRuneStyle`, `tableStarStyle`, `handRuneStyle`, or `handStarStyle` as unused in `TarotMinigame.tsx`, delete those style constants. Re-run `npx tsc -b` → no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/cards/CardBack.tsx src/components/screens/TarotMinigame.tsx src/components/cards/FanCard.tsx
git commit -m "feat(ui): standardized constellation-crest CardBack across table, hand, deck, fan"
```

---

## Task 4: `ResultReading` sub-cards use `CardSigil`

**Files:**
- Modify: `src/components/screens/ResultReading.tsx` (`subCards` type + mapping ~L28/L38; sub-card render ~L178-183)

**Interfaces:**
- Consumes: `CardSigil` (already imported at L9), `TarotCardFace` from engine types.

No automated test. Verify by typecheck + dev server.

- [ ] **Step 1: Add `face` to the `subCards` shape and mapping**

In `src/components/screens/ResultReading.tsx`, change the `subCards` type (currently `subCards?: { position: string; name: string; orientation: string; symbol: string; meaning: string }[];`) to include the face:

```typescript
  subCards?: { position: string; name: string; orientation: string; symbol: string; meaning: string; face: import('../../engine/types').TarotCardFace }[];
```

In the `subCards: spread.map(...)` mapping, add `face: sp.card,` to the returned object (alongside the existing `position`/`name`/`orientation`/`symbol`/`meaning` fields).

- [ ] **Step 2: Render the sub-card sigil instead of the emoji symbol**

Replace the emoji symbol span (currently):

```tsx
                          <span style={{
                            fontSize: '1.2rem',
                            color: sc.orientation === '▲ Upright' ? '#7b9ec7' : '#d4a854',
                          }}>
                            {sc.symbol}
                          </span>
```

with:

```tsx
                          <CardSigil
                            card={sc.face}
                            size={26}
                            color={sc.orientation === '▲ Upright' ? '#7b9ec7' : '#d4a854'}
                          />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: no errors. (If `sc.symbol` is now unused elsewhere it is fine — `symbol` stays on the type; only the render switched.)

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/ResultReading.tsx
git commit -m "fix(result): render tarot sub-card sigils instead of emoji symbols"
```

---

## Task 5: Celestial + arcane UI polish in `TarotMinigame`

**Files:**
- Modify: `src/components/screens/TarotMinigame.tsx` (table area atmosphere, deck glow, focus-glow, ornaments, dividers, labels, heading rules)

**Interfaces:**
- Consumes: `OrnamentalBorder` (`src/components/shared/OrnamentalBorder.tsx`), `RunicBand` (`src/components/shared/RunicBand.tsx`).

Presentational only. No automated test. Verify by typecheck + dev server.

- [ ] **Step 1: Import the shared ornaments**

In `src/components/screens/TarotMinigame.tsx`, add after the `CardBack` import:

```typescript
import OrnamentalBorder from '../shared/OrnamentalBorder';
import RunicBand from '../shared/RunicBand';
```

- [ ] **Step 2: Add a celestial backdrop + corner flourishes to the table area**

The table area `<div ref={tableRef} style={{ ...tableAreaStyle, ... }}>` is the tableau frame. Give it a relative position (it already participates in layout) and nest a starfield/nebula gradient layer plus corner flourishes behind the cards. Replace the `tableAreaStyle` constant:

```tsx
const tableAreaStyle: React.CSSProperties = {
  width: '100%', minHeight: '120px', border: '1px dashed #1a2440',
  borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1rem', transition: 'border-color 0.3s ease', overflow: 'hidden',
};
```

with:

```tsx
const tableAreaStyle: React.CSSProperties = {
  width: '100%', minHeight: '120px', border: '1px solid #1a2440',
  borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1rem', transition: 'border-color 0.3s ease', overflow: 'hidden',
  position: 'relative',
  background:
    'radial-gradient(120% 90% at 50% 0%, rgba(42,21,69,0.28), transparent 60%),' +
    'radial-gradient(80% 70% at 20% 100%, rgba(15,31,61,0.25), transparent 70%),' +
    '#070b14',
  boxShadow: 'inset 0 0 36px rgba(8,13,24,0.9)',
};
```

Then, immediately inside the table `<div ref={tableRef} ...>` and BEFORE the `<AnimatePresence mode="popLayout">`, add a non-interactive starfield + corner flourishes layer:

```tsx
          {/* Celestial backdrop + arcane corner flourishes */}
          <svg
            viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.5 }}
          >
            {TABLE_STARS.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.gold ? '#d4a854' : '#7b9ec7'} opacity={s.o} />
            ))}
          </svg>
          {CORNER_FLOURISHES.map((transform, i) => (
            <svg
              key={i} width="22" height="22" viewBox="0 0 22 22" aria-hidden
              style={{ position: 'absolute', pointerEvents: 'none', color: '#d4a854', opacity: 0.55, ...cornerPos(i), transform }}
            >
              <path d="M1 1 H9 M1 1 V9 M1 1 Q11 11 21 11 M1 1 Q11 11 11 21" stroke="currentColor" strokeWidth="0.8" fill="none" strokeLinecap="round" />
            </svg>
          ))}
```

- [ ] **Step 3: Add the backdrop data + helpers at the bottom of the file**

In the `// ── Helpers ──` section of `TarotMinigame.tsx` (near `cardIndexZ`), add:

```typescript
// Static decorative starfield for the tableau backdrop (viewBox 0 0 200 100).
const TABLE_STARS: { x: number; y: number; r: number; o: number; gold?: boolean }[] = [
  { x: 18, y: 22, r: 0.7, o: 0.7 }, { x: 46, y: 12, r: 0.5, o: 0.5 },
  { x: 80, y: 30, r: 0.6, o: 0.6, gold: true }, { x: 120, y: 18, r: 0.5, o: 0.55 },
  { x: 150, y: 36, r: 0.7, o: 0.65 }, { x: 182, y: 24, r: 0.5, o: 0.5, gold: true },
  { x: 30, y: 70, r: 0.6, o: 0.55 }, { x: 70, y: 82, r: 0.5, o: 0.5 },
  { x: 110, y: 74, r: 0.7, o: 0.6, gold: true }, { x: 160, y: 80, r: 0.5, o: 0.5 },
  { x: 100, y: 50, r: 0.4, o: 0.4 }, { x: 138, y: 58, r: 0.5, o: 0.45 },
];

// Four corner flourish rotations (TL, TR, BL, BR).
const CORNER_FLOURISHES = ['none', 'scaleX(-1)', 'scaleY(-1)', 'scale(-1,-1)'];

function cornerPos(i: number): React.CSSProperties {
  const v = i < 2 ? { top: '6px' } : { bottom: '6px' };
  const h = i % 2 === 0 ? { left: '6px' } : { right: '6px' };
  return { ...v, ...h };
}
```

- [ ] **Step 4: Glow the deck stack and the focused table card**

Give the deck a soft gold glow: replace `deckStackStyle`:

```tsx
const deckStackStyle: React.CSSProperties = {
  position: 'relative', width: '50px', height: '60px',
};
```

with:

```tsx
const deckStackStyle: React.CSSProperties = {
  position: 'relative', width: '50px', height: '60px',
  filter: 'drop-shadow(0 0 8px rgba(212,168,84,0.35))',
};
```

Add a gold focus-glow to the hovered/opened table card. In the table-card `<motion.div>` `whileHover`, change:

```tsx
                    whileHover={!handFull ? { borderColor: '#d4a854', y: -3 } : {}}
```

to:

```tsx
                    whileHover={!handFull ? { borderColor: '#d4a854', y: -3, boxShadow: '0 0 14px rgba(212,168,84,0.5)' } : {}}
```

- [ ] **Step 5: Frame the tableau with runic-band dividers**

Wrap the table `<div ref={tableRef}>` with a `RunicBand` above and below. Immediately BEFORE the `<div ref={tableRef} ...>` add:

```tsx
        <RunicBand color="#d4a854" opacity={0.22} fontSize="0.7rem" />
```

and immediately AFTER the closing `</div>` of the table area add:

```tsx
        <RunicBand color="#d4a854" opacity={0.22} fontSize="0.7rem" />
```

- [ ] **Step 6: Refine hand labels and add gold hairlines under heading + commit row**

Refine the engraved hand labels — replace `handLabelStyle`:

```tsx
const handLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 600,
  fontSize: '0.75rem', color: '#7b9ec7', letterSpacing: '0.08em', textTransform: 'uppercase',
};
```

with:

```tsx
const handLabelStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif", fontWeight: 700,
  fontSize: '0.78rem', color: '#d4a854', letterSpacing: '0.18em', textTransform: 'uppercase',
  textShadow: '0 0 8px rgba(212,168,84,0.25)',
};
```

Add a gold hairline under the heading: immediately AFTER the closing `</motion.h1>` add:

```tsx
        <OrnamentalBorder width="120px" />
```

- [ ] **Step 7: Refine empty-slot styling**

Replace `emptyHandSlotStyle`:

```tsx
const emptyHandSlotStyle: React.CSSProperties = {
  width: '90px', height: '130px', border: '1px dashed #1a2440', borderRadius: '6px',
  display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4,
};
```

with:

```tsx
const emptyHandSlotStyle: React.CSSProperties = {
  width: '90px', height: '130px', border: '1px dashed #3a2a50', borderRadius: '8px',
  display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5,
  background: 'radial-gradient(60% 60% at 50% 40%, rgba(155,107,176,0.08), transparent)',
};
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc -b`
Expected: no errors. (Remove any style constant `tsc` flags as unused — e.g. if `deckCountStyle` or others remain referenced, leave them.)

- [ ] **Step 9: Manual dev-server verification**

Run `npm run dev`. Play a tarot reading and confirm: (a) every major shows a distinct line-art sigil (no plain circle); (b) minors show a suit emblem with a corner numeral cartouche, courts show a crown; (c) reversed cards render rotated 180°; (d) face-down cards (table, hand, deck) show the constellation-crest back; (e) the tableau has a starfield backdrop, corner flourishes, runic-band dividers above/below, a glowing deck, and gold focus-glow on hover; (f) the Result page sub-cards show sigils, not emoji.

- [ ] **Step 10: Commit**

```bash
git add src/components/screens/TarotMinigame.tsx
git commit -m "feat(ui): celestial+arcane polish for the tarot draft tableau"
```

---

## Task 6: Documentation sync

**Files:**
- Modify: `docs/game-systems.md` (SVG sigils section ~`### 4f`)
- Modify: `README.md` (Tarot row / visual note)

**Interfaces:** none (prose only).

- [ ] **Step 1: Update `docs/game-systems.md`**

In the SVG sigils subsection (`### 4f. SVG sigils`), document that sigil resolution now lives in the pure, engine-test-covered module `src/data/sigils.ts` (`resolveSigil`), that all 22 majors have bespoke geometric line-art (no generic-circle fallback), minors compose as a refined suit emblem + a corner rank cartouche (roman numeral / `A` for aces, `P/N/Q/K` for courts with a crown), multi-card spreads use a refined crest, and `CardSigil` is a thin renderer over `resolveSigil`. Note that face-down cards across the draft (table, hand, deck) and the fan use a standardized constellation-crest `CardBack`, and that tarot no longer renders the emoji `symbol` field (the Result page sub-cards use `CardSigil`).

- [ ] **Step 2: Update `README.md`**

In the Divination Methods table's Tarot row (or the nearby visual description), note that tarot cards use a complete standardized geometric sigil system (22 bespoke majors + composed minors) and a constellation-crest card back, replacing the previous emoji/rune placeholders.

- [ ] **Step 3: Commit**

```bash
git add docs/game-systems.md README.md
git commit -m "docs: sync standardized tarot sigil system and card back"
```

---

## Self-Review

**Spec coverage:**
- §1.1 pure testable module (`src/data/sigils.ts`, `resolveSigil`, `MAJOR_SIGILS`, `SUIT_EMBLEMS`, spread crest) → Task 1.
- §1.2 author all 22 majors (bespoke multi-stroke, no generic fallback, completeness test) → Task 1 (data) + Task 1 test.
- §1.3 compose 56 minors (emblem + cartouche + court crown; `CardSigil` renders a group) → Task 1 (data/`resolveSigil`) + Task 2 (render).
- §1.4 orientation (180° preserved) + spread crest → Task 1 (crest) + Task 2 (reversed transform).
- §1.5 replace remaining tarot emoji (ResultReading sub-card → `CardSigil`; audit) → Task 4; FanCard/ConstellationFan already use `CardSigil` and upgrade automatically (Task 2).
- §2.1 standardized `CardBack` (table, hand, deck; FanCard backs updated) → Task 3.
- §2.2 celestial atmosphere (starfield ground, deck glow, focus-glow) → Task 5.
- §2.3 arcane ornamentation (corner flourishes, runic-band dividers, engraved labels, heading hairline, empty-slot refinement) → Task 5.
- §2.4 consistency (FanCard/ResultReading/ConstellationFan upgrade with the completed registry; verify small sizes) → Tasks 2/4 + Task 5 Step 9 dev-server check.
- §3 files affected → all listed files are touched across Tasks 1-6 (`Sigils.test.ts` Task 1; `sigils.ts` Task 1; `CardSigil.tsx` Task 2; `CardBack.tsx` Task 3; `TarotMinigame.tsx` Tasks 3+5; `FanCard.tsx` Task 3; `ResultReading.tsx` Task 4; docs Task 6).
- §4 testing (`resolveSigil` completeness unit-tested; rest via dev server) → Task 1 test + Task 5 Step 9.
- §5 out of scope (functional fixes, non-tarot icons) → respected; only tarot visuals changed.

**Placeholder scan:** No TBD/TODO; every code step shows full code; all 22 major path arrays are concrete; the test asserts completeness against `MAJOR_ARCANA`/`generateMinorArcana` so a missing/empty sigil fails CI.

**Type consistency:** `SigilSpec` discriminated union (`kind: 'major'|'minor'|'spread'`) is consistent between `sigils.ts` (Task 1), the test (Task 1), and `CardSigil` (Task 2). `rankLabel` signature matches its test and its call inside `resolveSigil`. `CardBack` prop shape (`size/color/accent`) consistent between Task 3 definition and all call sites. `resolveSigil(card)` accepts `TarotResult | TarotCardFace`, matching every caller (`CardSigil`, sub-card faces).
