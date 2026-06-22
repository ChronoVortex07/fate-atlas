import type { TarotResult, TarotCardFace, ThemeTag, DimensionValues, ModifierRole, SpreadPosition } from '../engine/types';

export interface TarotCardData {
  id: string;
  name: string;
  number?: number;
  symbol: string;
  meaningUpright: string;
  meaningReversed: string;
  archetypeTag?: string;
  arcana: 'major' | 'minor';
  suit?: TarotCardFace['suit'];
  rank?: TarotCardFace['rank'];
  themes: ThemeTag[];
  dimensions: DimensionValues;
  modifierRoles: ModifierRole[];
}

export const MAJOR_ARCANA: TarotCardData[] = [
  { id: 'the-fool', name: 'The Fool', number: 0, symbol: '☉', meaningUpright: 'New beginnings, spontaneity, a leap of faith into the unknown', meaningReversed: 'Recklessness, hesitation, fear of the new', archetypeTag: 'fool-archetype',
    themes: ['renewal', 'mystery'], dimensions: { favorability: 0.5, certainty: -1.5, volatility: 1.5 }, arcana: 'major', modifierRoles: ['subject'] },
  { id: 'the-magician', name: 'The Magician', number: 1, symbol: '☿', meaningUpright: 'Willpower, mastery, manifestation of desires', meaningReversed: 'Manipulation, untapped potential, trickery', archetypeTag: 'magician-archetype',
    themes: ['authority', 'illumination'], dimensions: { favorability: 1.0, certainty: 1.0, volatility: 0.5 }, arcana: 'major', modifierRoles: ['action'] },
  { id: 'the-high-priestess', name: 'The High Priestess', number: 2, symbol: '☽', meaningUpright: 'Intuition, mystery, the subconscious mind', meaningReversed: 'Secrets revealed, disconnection from intuition', archetypeTag: 'priestess-archetype',
    themes: ['mystery', 'illumination'], dimensions: { favorability: 0.5, certainty: -1.0, volatility: 0.0 }, arcana: 'major', modifierRoles: ['subject'] },
  { id: 'the-empress', name: 'The Empress', number: 3, symbol: '♀', meaningUpright: 'Abundance, nurturing, connection to nature', meaningReversed: 'Dependence, creative block, neglect', archetypeTag: 'empress-archetype',
    themes: ['harmony', 'renewal'], dimensions: { favorability: 1.5, certainty: 0.5, volatility: -0.5 }, arcana: 'major', modifierRoles: ['subject', 'effect'] },
  { id: 'the-emperor', name: 'The Emperor', number: 4, symbol: '♃', meaningUpright: 'Authority, structure, stability and control', meaningReversed: 'Tyranny, rigidity, abuse of power', archetypeTag: 'emperor-archetype',
    themes: ['authority', 'conflict'], dimensions: { favorability: 0.5, certainty: 1.5, volatility: -1.0 }, arcana: 'major', modifierRoles: ['action'] },
  { id: 'the-hierophant', name: 'The Hierophant', number: 5, symbol: '♆', meaningUpright: 'Tradition, spiritual guidance, conformity', meaningReversed: 'Rebellion, unconventionality, hypocrisy', archetypeTag: 'hierophant-archetype',
    themes: ['authority', 'harmony'], dimensions: { favorability: 1.0, certainty: 1.0, volatility: -0.5 }, arcana: 'major', modifierRoles: ['subject', 'action'] },
  { id: 'the-lovers', name: 'The Lovers', number: 6, symbol: '⚤', meaningUpright: 'Love, harmony, choices and alignment', meaningReversed: 'Disharmony, imbalance, misalignment of values', archetypeTag: 'lovers-archetype',
    themes: ['harmony', 'transformation'], dimensions: { favorability: 1.5, certainty: -0.5, volatility: 1.0 }, arcana: 'major', modifierRoles: ['subject', 'action'] },
  { id: 'the-chariot', name: 'The Chariot', number: 7, symbol: '♈', meaningUpright: 'Determination, willpower, triumph through control', meaningReversed: 'Lack of direction, aggression, loss of control', archetypeTag: 'chariot-archetype',
    themes: ['conflict', 'authority'], dimensions: { favorability: 1.0, certainty: 1.5, volatility: -0.5 }, arcana: 'major', modifierRoles: ['action'] },
  { id: 'strength', name: 'Strength', number: 8, symbol: '♌', meaningUpright: 'Courage, inner strength, compassion over force', meaningReversed: 'Self-doubt, weakness, insecurity', archetypeTag: 'strength-archetype',
    themes: ['authority', 'harmony'], dimensions: { favorability: 1.5, certainty: 0.5, volatility: -0.5 }, arcana: 'major', modifierRoles: ['subject', 'action'] },
  { id: 'the-hermit', name: 'The Hermit', number: 9, symbol: '♍', meaningUpright: 'Solitude, introspection, seeking inner truth', meaningReversed: 'Isolation, loneliness, withdrawal from life', archetypeTag: 'hermit-archetype',
    themes: ['illumination', 'mystery'], dimensions: { favorability: 0.5, certainty: -0.5, volatility: 0.0 }, arcana: 'major', modifierRoles: ['subject'] },
  { id: 'wheel-of-fortune', name: 'Wheel of Fortune', number: 10, symbol: '☸', meaningUpright: 'Change, cycles, destiny and turning points', meaningReversed: 'Bad luck, resistance to change, setbacks', archetypeTag: 'fortune-archetype',
    themes: ['transformation', 'upheaval'], dimensions: { favorability: 0.0, certainty: -1.5, volatility: 2.0 }, arcana: 'major', modifierRoles: ['effect'] },
  { id: 'justice', name: 'Justice', number: 11, symbol: '♎', meaningUpright: 'Fairness, truth, consequence and clarity', meaningReversed: 'Injustice, dishonesty, lack of accountability', archetypeTag: 'justice-archetype',
    themes: ['authority', 'illumination'], dimensions: { favorability: 1.0, certainty: 1.5, volatility: -1.0 }, arcana: 'major', modifierRoles: ['action', 'effect'] },
  { id: 'the-hanged-man', name: 'The Hanged Man', number: 12, symbol: '♓', meaningUpright: 'Surrender, new perspective, letting go', meaningReversed: 'Stalling, resistance, refusal to see', archetypeTag: 'hanged-archetype',
    themes: ['surrender', 'illumination'], dimensions: { favorability: -0.5, certainty: -1.0, volatility: 1.5 }, arcana: 'major', modifierRoles: ['subject'] },
  { id: 'death', name: 'Death', number: 13, symbol: '♏', meaningUpright: 'Transformation, endings, inevitable change', meaningReversed: 'Stagnation, fear of change, holding on', archetypeTag: 'death-archetype',
    themes: ['transformation', 'upheaval'], dimensions: { favorability: -0.5, certainty: 1.5, volatility: 1.5 }, arcana: 'major', modifierRoles: ['action', 'effect'] },
  { id: 'temperance', name: 'Temperance', number: 14, symbol: '♐', meaningUpright: 'Balance, moderation, patience and purpose', meaningReversed: 'Excess, imbalance, lack of harmony', archetypeTag: 'temperance-archetype',
    themes: ['harmony', 'surrender'], dimensions: { favorability: 1.0, certainty: 0.5, volatility: 0.0 }, arcana: 'major', modifierRoles: ['action'] },
  { id: 'the-devil', name: 'The Devil', number: 15, symbol: '♑', meaningUpright: 'Bondage, materialism, facing one’s shadow', meaningReversed: 'Release, breaking free, reclaiming power', archetypeTag: 'devil-archetype',
    themes: ['conflict', 'authority', 'stagnation'], dimensions: { favorability: -1.5, certainty: 0.5, volatility: -1.0 }, arcana: 'major', modifierRoles: ['subject', 'effect'] },
  { id: 'the-tower', name: 'The Tower', number: 16, symbol: '♇', meaningUpright: 'Upheaval, sudden change, revelation through destruction', meaningReversed: 'Averting disaster, fear of change, delayed collapse', archetypeTag: 'tower-archetype',
    themes: ['upheaval', 'illumination'], dimensions: { favorability: -1.5, certainty: 1.5, volatility: 2.0 }, arcana: 'major', modifierRoles: ['action', 'effect'] },
  { id: 'the-star', name: 'The Star', number: 17, symbol: '⭐', meaningUpright: 'Hope, renewal, faith in the future', meaningReversed: 'Despair, disconnection, lack of faith', archetypeTag: 'star-archetype',
    themes: ['renewal', 'harmony'], dimensions: { favorability: 2.0, certainty: -0.5, volatility: 0.5 }, arcana: 'major', modifierRoles: ['subject', 'effect'] },
  { id: 'the-moon', name: 'The Moon', number: 18, symbol: '☾', meaningUpright: 'Illusion, the unconscious, navigating uncertainty', meaningReversed: 'Clarity emerging, fear dispelled, truths revealed', archetypeTag: 'moon-archetype',
    themes: ['mystery', 'stagnation'], dimensions: { favorability: -1.0, certainty: -1.5, volatility: 1.5 }, arcana: 'major', modifierRoles: ['subject', 'action'] },
  { id: 'the-sun', name: 'The Sun', number: 19, symbol: '☀', meaningUpright: 'Joy, success, vitality and enlightenment', meaningReversed: 'Temporary setbacks, diminished joy, blocked success', archetypeTag: 'sun-archetype',
    themes: ['illumination', 'harmony', 'renewal'], dimensions: { favorability: 2.0, certainty: 1.5, volatility: -1.0 }, arcana: 'major', modifierRoles: ['subject', 'effect'] },
  { id: 'judgement', name: 'Judgement', number: 20, symbol: '♒', meaningUpright: 'Rebirth, inner calling, absolution and awakening', meaningReversed: 'Self-doubt, refusal of the call, guilt', archetypeTag: 'judgement-archetype',
    themes: ['renewal', 'transformation', 'authority'], dimensions: { favorability: 1.0, certainty: 1.0, volatility: 1.0 }, arcana: 'major', modifierRoles: ['action', 'effect'] },
  { id: 'the-world', name: 'The World', number: 21, symbol: '♾', meaningUpright: 'Completion, fulfillment, wholeness and achievement', meaningReversed: 'Incompletion, lack of closure, delays in fulfillment', archetypeTag: 'world-archetype',
    themes: ['harmony', 'transformation'], dimensions: { favorability: 2.0, certainty: 2.0, volatility: -2.0 }, arcana: 'major', modifierRoles: ['subject', 'effect'] },
];

// ── Minor Arcana ──

type Suit = 'wands' | 'cups' | 'swords' | 'pentacles';

interface SuitDef {
  suit: Suit;
  name: string;
  element: 'fire' | 'water' | 'air' | 'earth';
  base: DimensionValues;
  pipRole: ModifierRole;
  lightThemes: [ThemeTag, ThemeTag];
  glyph: string;
  phrase: { up: string; rev: string };
}

const SUITS: SuitDef[] = [
  { suit: 'wands', name: 'Wands', element: 'fire', base: { favorability: 0.3, certainty: 0.2, volatility: 0.8 }, pipRole: 'action', lightThemes: ['conflict', 'transformation'] as [ThemeTag, ThemeTag], glyph: '♦', phrase: { up: 'drive, ambition, and the spark of action', rev: 'frustration, delay, and scattered energy' } },
  { suit: 'cups', name: 'Cups', element: 'water', base: { favorability: 0.8, certainty: -0.3, volatility: 0.2 }, pipRole: 'subject', lightThemes: ['harmony', 'mystery'] as [ThemeTag, ThemeTag], glyph: '♥', phrase: { up: 'emotion, connection, and intuition', rev: 'imbalance, withdrawal, and blocked feeling' } },
  { suit: 'swords', name: 'Swords', element: 'air', base: { favorability: -0.6, certainty: 0.5, volatility: 0.5 }, pipRole: 'effect', lightThemes: ['conflict', 'illumination'] as [ThemeTag, ThemeTag], glyph: '♠', phrase: { up: 'intellect, conflict, and hard truth', rev: 'confusion, cruelty, and self-defeat' } },
  { suit: 'pentacles', name: 'Pentacles', element: 'earth', base: { favorability: 0.5, certainty: 0.7, volatility: -0.5 }, pipRole: 'subject', lightThemes: ['stagnation', 'harmony'] as [ThemeTag, ThemeTag], glyph: '♣', phrase: { up: 'work, resources, and the material world', rev: 'insecurity, loss, and misplaced value' } },
];

export const ELEMENT_BY_SUIT: Record<Suit, string> =
  Object.fromEntries(SUITS.map((s) => [s.suit, s.element])) as Record<Suit, string>;

const COURTS = ['page', 'knight', 'queen', 'king'] as const;
const COURT_ROLE: Record<(typeof COURTS)[number], ModifierRole> =
  { page: 'subject', knight: 'action', queen: 'subject', king: 'action' };
const RANK_WORD: Record<number, string> =
  { 1: 'Ace', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten' };
const RANK_PHRASE: Record<string, string> = {
  ace: 'the pure seed of', two: 'a first balance of', three: 'early growth in', four: 'a steadying of',
  five: 'a struggle within', six: 'a turning toward', seven: 'a testing of', eight: 'swift movement in',
  nine: 'a near-fullness of', ten: 'the culmination of',
  page: 'a student of', knight: 'a pursuer of', queen: 'the nurturer of', king: 'the master of',
};

export function rankKey(rank: TarotCardFace['rank']): string {
  return typeof rank === 'number' ? (RANK_WORD[rank] ?? String(rank)).toLowerCase() : rank!;
}

const clampDim = (v: number) => Math.max(-2, Math.min(2, Math.round(v * 2) / 2)) as number;
const dominantAxis = (d: DimensionValues): keyof DimensionValues =>
  (['favorability', 'certainty', 'volatility'] as (keyof DimensionValues)[])
    .reduce((m, a) => (Math.abs(d[a]) > Math.abs(d[m]) ? a : m), 'favorability');

function minorDimensions(def: SuitDef, rank: TarotCardFace['rank']): DimensionValues {
  const isCourt = typeof rank !== 'number';
  const intensity = isCourt ? 1.2 : 0.6 + ((rank as number) - 1) / 9 * 1.4;
  const d: DimensionValues = {
    favorability: def.base.favorability * intensity,
    certainty: def.base.certainty * intensity,
    volatility: def.base.volatility * (isCourt ? 0.6 : 1) * intensity,
  };
  if (rank === 1) { const a = dominantAxis(def.base); d[a] += 0.5 * Math.sign(def.base[a]); }
  if (rank === 10) { d.volatility += 0.5; }
  return { favorability: clampDim(d.favorability), certainty: clampDim(d.certainty), volatility: clampDim(d.volatility) };
}

function minorThemes(def: SuitDef, rank: TarotCardFace['rank']): ThemeTag[] {
  if (rank === 1 || typeof rank !== 'number') return [def.lightThemes[0]];
  if (rank === 10) return [def.lightThemes[1]];
  return [];
}

export function generateMinorArcana(): TarotCardData[] {
  const out: TarotCardData[] = [];
  for (const def of SUITS) {
    const ranks: TarotCardFace['rank'][] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...COURTS];
    for (const rank of ranks) {
      const key = rankKey(rank);
      const isCourt = typeof rank !== 'number';
      out.push({
        id: `${def.suit}-${typeof rank === 'number' ? rank : rank}`,
        name: `${isCourt ? key[0].toUpperCase() + key.slice(1) : RANK_WORD[rank as number]} of ${def.name}`,
        number: typeof rank === 'number' ? rank : undefined,
        symbol: def.glyph,
        meaningUpright: `${RANK_PHRASE[key]} ${def.phrase.up}`,
        meaningReversed: `${RANK_PHRASE[key]} ${def.phrase.rev}`,
        arcana: 'minor',
        suit: def.suit,
        rank,
        themes: minorThemes(def, rank),
        dimensions: minorDimensions(def, rank),
        modifierRoles: [isCourt ? COURT_ROLE[rank as (typeof COURTS)[number]] : def.pipRole],
      });
    }
  }
  return out;
}

export const MINOR_ARCANA: TarotCardData[] = generateMinorArcana();

export const FULL_DECK: TarotCardData[] = [...MAJOR_ARCANA, ...MINOR_ARCANA];
export const DECK_BY_ID: Record<string, TarotCardData> =
  Object.fromEntries(FULL_DECK.map((c) => [c.id, c]));

function baseTagsFor(card: TarotCardData): string[] {
  const tags = ['draw', 'random', 'reversible', card.arcana === 'major' ? 'major-arcana' : 'minor-arcana'];
  if (card.archetypeTag) tags.push(card.archetypeTag);
  if (card.suit) tags.push(`suit-${card.suit}`, `element-${ELEMENT_BY_SUIT[card.suit]}`);
  if (card.rank !== undefined) tags.push(`rank-${rankKey(card.rank)}`);
  return tags;
}

export function buildFace(card: TarotCardData, orientation: 'upright' | 'reversed'): TarotCardFace {
  const reversed = orientation === 'reversed';
  let themes = card.themes;
  const dimensions: DimensionValues = { ...card.dimensions };
  if (reversed) {
    dimensions.favorability = (-dimensions.favorability) as DimensionValues['favorability'];
    themes = [...new Set(themes.map((t) => REVERSAL_THEME_MAP[t] ?? t))];
  }
  return {
    id: card.id,
    name: card.name,
    arcana: card.arcana,
    suit: card.suit,
    rank: card.rank,
    number: card.number,
    orientation,
    symbol: card.symbol,
    themes,
    dimensions,
    modifierRoles: card.modifierRoles,
    meaningUpright: card.meaningUpright,
    meaningReversed: card.meaningReversed,
    archetypeTag: card.archetypeTag,
    tags: [...baseTagsFor(card), reversed ? 'reversed' : 'upright'],
  };
}

export const SPREAD_GLYPH = '✦';
const SPREAD_POSITIONS: SpreadPosition[] = ['past', 'present', 'future'];
const AXES: (keyof DimensionValues)[] = ['favorability', 'certainty', 'volatility'];
const sumAbs = (d: DimensionValues) => Math.abs(d.favorability) + Math.abs(d.certainty) + Math.abs(d.volatility);

export function consolidateSpread(faces: TarotCardFace[]): TarotResult {
  const n = faces.length;

  const dimensions: DimensionValues = { favorability: 0, certainty: 0, volatility: 0 };
  for (const f of faces) for (const a of AXES) dimensions[a] += f.dimensions[a];
  for (const a of AXES) dimensions[a] = clampDim(dimensions[a] / n);

  const count = new Map<ThemeTag, number>();
  const mag = new Map<ThemeTag, number>();
  for (const f of faces) for (const t of f.themes) {
    count.set(t, (count.get(t) ?? 0) + 1);
    mag.set(t, (mag.get(t) ?? 0) + sumAbs(f.dimensions));
  }
  const themes = [...count.keys()]
    .sort((a, b) => (count.get(b)! - count.get(a)!) || (mag.get(b)! - mag.get(a)!))
    .slice(0, 2);

  const modifierRoles = [...new Set(faces.flatMap((f) => f.modifierRoles))];

  const reversedCount = faces.filter((f) => f.orientation === 'reversed').length;
  const orientation: 'upright' | 'reversed' = reversedCount * 2 > n ? 'reversed' : 'upright';

  const tagSet = new Set<string>();
  for (const f of faces) for (const t of f.tags) if (t !== 'upright' && t !== 'reversed') tagSet.add(t);
  tagSet.add('draw'); tagSet.add('random'); tagSet.add('reversible'); tagSet.add(orientation);

  const spread = faces.map((card, i) => ({ position: SPREAD_POSITIONS[i] ?? 'present', card }));
  const single = n === 1;
  const present = faces[Math.min(1, n - 1)];

  return {
    type: 'tarot',
    id: single ? faces[0].id : 'spread:' + faces.map((f) => f.id).join('+'),
    name: single ? faces[0].name : faces.map((f) => f.name).join(' · '),
    number: present.number ?? 0,
    orientation,
    symbol: single ? faces[0].symbol : SPREAD_GLYPH,
    meaningUpright: present.meaningUpright,
    meaningReversed: present.meaningReversed,
    themes,
    dimensions,
    modifierRoles,
    tags: [...tagSet],
    spread,
  };
}

const REVERSAL_THEME_MAP: Partial<Record<ThemeTag, ThemeTag>> = {
  upheaval: 'stagnation',
  renewal: 'stagnation',
  stagnation: 'renewal',
  illumination: 'mystery',
  harmony: 'conflict',
  conflict: 'harmony',
  mystery: 'illumination',
  authority: 'surrender',
  surrender: 'authority',
  // transformation stays as transformation (neutral in opposition)
};

export function pickOrientation(affinities: Record<string, number>): 'upright' | 'reversed' {
  const reversalChance = 0.5 + ((affinities.chaos ?? 0) / 100) * 0.3;
  const orderMod = ((affinities.order ?? 0) / 100) * 0.2;
  const finalChance = Math.max(0.1, Math.min(0.9, reversalChance - orderMod));
  return Math.random() < finalChance ? 'reversed' : 'upright';
}

export function reverseFace(face: TarotCardFace): TarotCardFace {
  return buildFace(DECK_BY_ID[face.id], face.orientation === 'upright' ? 'reversed' : 'upright');
}

export function reverseSpread(result: TarotResult): TarotResult {
  const faces = (result.spread ?? []).map((s) => reverseFace(s.card));
  return consolidateSpread(faces);
}

export function drawTarotSpread(affinities: Record<string, number>): TarotResult {
  const pool = [...FULL_DECK];
  const faces: TarotCardFace[] = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const [card] = pool.splice(idx, 1);
    faces.push(buildFace(card, pickOrientation(affinities)));
  }
  return consolidateSpread(faces);
}

export function drawTarotCard(affinities: Record<string, number>): TarotResult {
  const card = MAJOR_ARCANA[Math.floor(Math.random() * MAJOR_ARCANA.length)];
  return consolidateSpread([buildFace(card, pickOrientation(affinities))]);
}
