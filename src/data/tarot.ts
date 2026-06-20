import type { TarotResult, ThemeTag, DimensionValues, ModifierRole } from '../engine/types';

export interface TarotCardData {
  id: string;
  name: string;
  number: number;
  symbol: string;
  meaningUpright: string;
  meaningReversed: string;
  archetypeTag: string;
  themes: ThemeTag[];
  dimensions: DimensionValues;
  modifierRoles: ModifierRole[];
}

export const MAJOR_ARCANA: TarotCardData[] = [
  { id: 'the-fool', name: 'The Fool', number: 0, symbol: '☉', meaningUpright: 'New beginnings, spontaneity, a leap of faith into the unknown', meaningReversed: 'Recklessness, hesitation, fear of the new', archetypeTag: 'fool-archetype',
    themes: ['renewal', 'mystery'], dimensions: { favorability: 0.5, certainty: -1.5, volatility: 1.5 }, modifierRoles: ['subject'] },
  { id: 'the-magician', name: 'The Magician', number: 1, symbol: '☿', meaningUpright: 'Willpower, mastery, manifestation of desires', meaningReversed: 'Manipulation, untapped potential, trickery', archetypeTag: 'magician-archetype',
    themes: ['authority', 'illumination'], dimensions: { favorability: 1.0, certainty: 1.0, volatility: 0.5 }, modifierRoles: ['action'] },
  { id: 'the-high-priestess', name: 'The High Priestess', number: 2, symbol: '☽', meaningUpright: 'Intuition, mystery, the subconscious mind', meaningReversed: 'Secrets revealed, disconnection from intuition', archetypeTag: 'priestess-archetype',
    themes: ['mystery', 'illumination'], dimensions: { favorability: 0.5, certainty: -1.0, volatility: 0.0 }, modifierRoles: ['subject'] },
  { id: 'the-empress', name: 'The Empress', number: 3, symbol: '♀', meaningUpright: 'Abundance, nurturing, connection to nature', meaningReversed: 'Dependence, creative block, neglect', archetypeTag: 'empress-archetype',
    themes: ['harmony', 'renewal'], dimensions: { favorability: 1.5, certainty: 0.5, volatility: -0.5 }, modifierRoles: ['subject', 'effect'] },
  { id: 'the-emperor', name: 'The Emperor', number: 4, symbol: '♃', meaningUpright: 'Authority, structure, stability and control', meaningReversed: 'Tyranny, rigidity, abuse of power', archetypeTag: 'emperor-archetype',
    themes: ['authority', 'conflict'], dimensions: { favorability: 0.5, certainty: 1.5, volatility: -1.0 }, modifierRoles: ['action'] },
  { id: 'the-hierophant', name: 'The Hierophant', number: 5, symbol: '♆', meaningUpright: 'Tradition, spiritual guidance, conformity', meaningReversed: 'Rebellion, unconventionality, hypocrisy', archetypeTag: 'hierophant-archetype',
    themes: ['authority', 'harmony'], dimensions: { favorability: 1.0, certainty: 1.0, volatility: -0.5 }, modifierRoles: ['subject', 'action'] },
  { id: 'the-lovers', name: 'The Lovers', number: 6, symbol: '⚤', meaningUpright: 'Love, harmony, choices and alignment', meaningReversed: 'Disharmony, imbalance, misalignment of values', archetypeTag: 'lovers-archetype',
    themes: ['harmony', 'transformation'], dimensions: { favorability: 1.5, certainty: -0.5, volatility: 1.0 }, modifierRoles: ['subject', 'action'] },
  { id: 'the-chariot', name: 'The Chariot', number: 7, symbol: '♈', meaningUpright: 'Determination, willpower, triumph through control', meaningReversed: 'Lack of direction, aggression, loss of control', archetypeTag: 'chariot-archetype',
    themes: ['conflict', 'authority'], dimensions: { favorability: 1.0, certainty: 1.5, volatility: -0.5 }, modifierRoles: ['action'] },
  { id: 'strength', name: 'Strength', number: 8, symbol: '♌', meaningUpright: 'Courage, inner strength, compassion over force', meaningReversed: 'Self-doubt, weakness, insecurity', archetypeTag: 'strength-archetype',
    themes: ['authority', 'harmony'], dimensions: { favorability: 1.5, certainty: 0.5, volatility: -0.5 }, modifierRoles: ['subject', 'action'] },
  { id: 'the-hermit', name: 'The Hermit', number: 9, symbol: '♍', meaningUpright: 'Solitude, introspection, seeking inner truth', meaningReversed: 'Isolation, loneliness, withdrawal from life', archetypeTag: 'hermit-archetype',
    themes: ['illumination', 'mystery'], dimensions: { favorability: 0.5, certainty: -0.5, volatility: 0.0 }, modifierRoles: ['subject'] },
  { id: 'wheel-of-fortune', name: 'Wheel of Fortune', number: 10, symbol: '☸', meaningUpright: 'Change, cycles, destiny and turning points', meaningReversed: 'Bad luck, resistance to change, setbacks', archetypeTag: 'fortune-archetype',
    themes: ['transformation', 'upheaval'], dimensions: { favorability: 0.0, certainty: -1.5, volatility: 2.0 }, modifierRoles: ['effect'] },
  { id: 'justice', name: 'Justice', number: 11, symbol: '♎', meaningUpright: 'Fairness, truth, consequence and clarity', meaningReversed: 'Injustice, dishonesty, lack of accountability', archetypeTag: 'justice-archetype',
    themes: ['authority', 'illumination'], dimensions: { favorability: 1.0, certainty: 1.5, volatility: -1.0 }, modifierRoles: ['action', 'effect'] },
  { id: 'the-hanged-man', name: 'The Hanged Man', number: 12, symbol: '♓', meaningUpright: 'Surrender, new perspective, letting go', meaningReversed: 'Stalling, resistance, refusal to see', archetypeTag: 'hanged-archetype',
    themes: ['surrender', 'illumination'], dimensions: { favorability: -0.5, certainty: -1.0, volatility: 1.5 }, modifierRoles: ['subject'] },
  { id: 'death', name: 'Death', number: 13, symbol: '♏', meaningUpright: 'Transformation, endings, inevitable change', meaningReversed: 'Stagnation, fear of change, holding on', archetypeTag: 'death-archetype',
    themes: ['transformation', 'upheaval'], dimensions: { favorability: -0.5, certainty: 1.5, volatility: 1.5 }, modifierRoles: ['action', 'effect'] },
  { id: 'temperance', name: 'Temperance', number: 14, symbol: '♐', meaningUpright: 'Balance, moderation, patience and purpose', meaningReversed: 'Excess, imbalance, lack of harmony', archetypeTag: 'temperance-archetype',
    themes: ['harmony', 'surrender'], dimensions: { favorability: 1.0, certainty: 0.5, volatility: 0.0 }, modifierRoles: ['action'] },
  { id: 'the-devil', name: 'The Devil', number: 15, symbol: '♑', meaningUpright: 'Bondage, materialism, facing one’s shadow', meaningReversed: 'Release, breaking free, reclaiming power', archetypeTag: 'devil-archetype',
    themes: ['conflict', 'authority', 'stagnation'], dimensions: { favorability: -1.5, certainty: 0.5, volatility: -1.0 }, modifierRoles: ['subject', 'effect'] },
  { id: 'the-tower', name: 'The Tower', number: 16, symbol: '♇', meaningUpright: 'Upheaval, sudden change, revelation through destruction', meaningReversed: 'Averting disaster, fear of change, delayed collapse', archetypeTag: 'tower-archetype',
    themes: ['upheaval', 'illumination'], dimensions: { favorability: -1.5, certainty: 1.5, volatility: 2.0 }, modifierRoles: ['action', 'effect'] },
  { id: 'the-star', name: 'The Star', number: 17, symbol: '⭐', meaningUpright: 'Hope, renewal, faith in the future', meaningReversed: 'Despair, disconnection, lack of faith', archetypeTag: 'star-archetype',
    themes: ['renewal', 'harmony'], dimensions: { favorability: 2.0, certainty: -0.5, volatility: 0.5 }, modifierRoles: ['subject', 'effect'] },
  { id: 'the-moon', name: 'The Moon', number: 18, symbol: '☾', meaningUpright: 'Illusion, the unconscious, navigating uncertainty', meaningReversed: 'Clarity emerging, fear dispelled, truths revealed', archetypeTag: 'moon-archetype',
    themes: ['mystery', 'stagnation'], dimensions: { favorability: -1.0, certainty: -1.5, volatility: 1.5 }, modifierRoles: ['subject', 'action'] },
  { id: 'the-sun', name: 'The Sun', number: 19, symbol: '☀', meaningUpright: 'Joy, success, vitality and enlightenment', meaningReversed: 'Temporary setbacks, diminished joy, blocked success', archetypeTag: 'sun-archetype',
    themes: ['illumination', 'harmony', 'renewal'], dimensions: { favorability: 2.0, certainty: 1.5, volatility: -1.0 }, modifierRoles: ['subject', 'effect'] },
  { id: 'judgement', name: 'Judgement', number: 20, symbol: '♒', meaningUpright: 'Rebirth, inner calling, absolution and awakening', meaningReversed: 'Self-doubt, refusal of the call, guilt', archetypeTag: 'judgement-archetype',
    themes: ['renewal', 'transformation', 'authority'], dimensions: { favorability: 1.0, certainty: 1.0, volatility: 1.0 }, modifierRoles: ['action', 'effect'] },
  { id: 'the-world', name: 'The World', number: 21, symbol: '♾', meaningUpright: 'Completion, fulfillment, wholeness and achievement', meaningReversed: 'Incompletion, lack of closure, delays in fulfillment', archetypeTag: 'world-archetype',
    themes: ['harmony', 'transformation'], dimensions: { favorability: 2.0, certainty: 2.0, volatility: -2.0 }, modifierRoles: ['subject', 'effect'] },
];

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

export function drawTarotCard(affinities: Record<string, number>): TarotResult {
  const index = Math.floor(Math.random() * MAJOR_ARCANA.length);
  const card = MAJOR_ARCANA[index];

  const reversalChance = 0.5 + ((affinities.chaos ?? 0) / 100) * 0.3;
  const orderMod = ((affinities.order ?? 0) / 100) * 0.2;
  const finalChance = Math.max(0.1, Math.min(0.9, reversalChance - orderMod));
  const orientation = Math.random() < finalChance ? 'reversed' : 'upright';

  const tags: string[] = [
    'draw', 'random', 'major-arcana', 'reversible',
    card.archetypeTag,
    orientation === 'reversed' ? 'reversed' : 'upright',
  ];

  // Apply reversal to themes and dimensions
  let themes = card.themes;
  let dimensions = { ...card.dimensions };
  if (orientation === 'reversed') {
    // Flip favorability sign
    dimensions.favorability = (-dimensions.favorability) as DimensionValues['favorability'];
    // Swap themes via reversal map
    themes = themes.map((t) => REVERSAL_THEME_MAP[t] ?? t);
    // Deduplicate after swap
    themes = [...new Set(themes)];
  }

  return {
    type: 'tarot',
    id: card.id,
    name: card.name,
    number: card.number,
    orientation,
    symbol: card.symbol,
    meaningUpright: card.meaningUpright,
    meaningReversed: card.meaningReversed,
    tags,
    themes,
    dimensions,
    modifierRoles: card.modifierRoles,
  };
}
