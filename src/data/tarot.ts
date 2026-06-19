import type { TarotResult } from '../engine/types';

export interface TarotCardData {
  id: string;
  name: string;
  number: number;
  symbol: string;
  meaningUpright: string;
  meaningReversed: string;
  archetypeTag: string;
}

export const MAJOR_ARCANA: TarotCardData[] = [
  { id: 'the-fool', name: 'The Fool', number: 0, symbol: '☉', meaningUpright: 'New beginnings, spontaneity, a leap of faith into the unknown', meaningReversed: 'Recklessness, hesitation, fear of the new', archetypeTag: 'fool-archetype' },
  { id: 'the-magician', name: 'The Magician', number: 1, symbol: '☿', meaningUpright: 'Willpower, mastery, manifestation of desires', meaningReversed: 'Manipulation, untapped potential, trickery', archetypeTag: 'magician-archetype' },
  { id: 'the-high-priestess', name: 'The High Priestess', number: 2, symbol: '☽', meaningUpright: 'Intuition, mystery, the subconscious mind', meaningReversed: 'Secrets revealed, disconnection from intuition', archetypeTag: 'priestess-archetype' },
  { id: 'the-empress', name: 'The Empress', number: 3, symbol: '♀', meaningUpright: 'Abundance, nurturing, connection to nature', meaningReversed: 'Dependence, creative block, neglect', archetypeTag: 'empress-archetype' },
  { id: 'the-emperor', name: 'The Emperor', number: 4, symbol: '♃', meaningUpright: 'Authority, structure, stability and control', meaningReversed: 'Tyranny, rigidity, abuse of power', archetypeTag: 'emperor-archetype' },
  { id: 'the-hierophant', name: 'The Hierophant', number: 5, symbol: '♆', meaningUpright: 'Tradition, spiritual guidance, conformity', meaningReversed: 'Rebellion, unconventionality, hypocrisy', archetypeTag: 'hierophant-archetype' },
  { id: 'the-lovers', name: 'The Lovers', number: 6, symbol: '⚤', meaningUpright: 'Love, harmony, choices and alignment', meaningReversed: 'Disharmony, imbalance, misalignment of values', archetypeTag: 'lovers-archetype' },
  { id: 'the-chariot', name: 'The Chariot', number: 7, symbol: '♈', meaningUpright: 'Determination, willpower, triumph through control', meaningReversed: 'Lack of direction, aggression, loss of control', archetypeTag: 'chariot-archetype' },
  { id: 'strength', name: 'Strength', number: 8, symbol: '♌', meaningUpright: 'Courage, inner strength, compassion over force', meaningReversed: 'Self-doubt, weakness, insecurity', archetypeTag: 'strength-archetype' },
  { id: 'the-hermit', name: 'The Hermit', number: 9, symbol: '♍', meaningUpright: 'Solitude, introspection, seeking inner truth', meaningReversed: 'Isolation, loneliness, withdrawal from life', archetypeTag: 'hermit-archetype' },
  { id: 'wheel-of-fortune', name: 'Wheel of Fortune', number: 10, symbol: '☸', meaningUpright: 'Change, cycles, destiny and turning points', meaningReversed: 'Bad luck, resistance to change, setbacks', archetypeTag: 'fortune-archetype' },
  { id: 'justice', name: 'Justice', number: 11, symbol: '♎', meaningUpright: 'Fairness, truth, consequence and clarity', meaningReversed: 'Injustice, dishonesty, lack of accountability', archetypeTag: 'justice-archetype' },
  { id: 'the-hanged-man', name: 'The Hanged Man', number: 12, symbol: '♓', meaningUpright: 'Surrender, new perspective, letting go', meaningReversed: 'Stalling, resistance, refusal to see', archetypeTag: 'hanged-archetype' },
  { id: 'death', name: 'Death', number: 13, symbol: '♏', meaningUpright: 'Transformation, endings, inevitable change', meaningReversed: 'Stagnation, fear of change, holding on', archetypeTag: 'death-archetype' },
  { id: 'temperance', name: 'Temperance', number: 14, symbol: '♐', meaningUpright: 'Balance, moderation, patience and purpose', meaningReversed: 'Excess, imbalance, lack of harmony', archetypeTag: 'temperance-archetype' },
  { id: 'the-devil', name: 'The Devil', number: 15, symbol: '♑', meaningUpright: 'Bondage, materialism, facing one’s shadow', meaningReversed: 'Release, breaking free, reclaiming power', archetypeTag: 'devil-archetype' },
  { id: 'the-tower', name: 'The Tower', number: 16, symbol: '♇', meaningUpright: 'Upheaval, sudden change, revelation through destruction', meaningReversed: 'Averting disaster, fear of change, delayed collapse', archetypeTag: 'tower-archetype' },
  { id: 'the-star', name: 'The Star', number: 17, symbol: '⭐', meaningUpright: 'Hope, renewal, faith in the future', meaningReversed: 'Despair, disconnection, lack of faith', archetypeTag: 'star-archetype' },
  { id: 'the-moon', name: 'The Moon', number: 18, symbol: '☾', meaningUpright: 'Illusion, the unconscious, navigating uncertainty', meaningReversed: 'Clarity emerging, fear dispelled, truths revealed', archetypeTag: 'moon-archetype' },
  { id: 'the-sun', name: 'The Sun', number: 19, symbol: '☀', meaningUpright: 'Joy, success, vitality and enlightenment', meaningReversed: 'Temporary setbacks, diminished joy, blocked success', archetypeTag: 'sun-archetype' },
  { id: 'judgement', name: 'Judgement', number: 20, symbol: '♒', meaningUpright: 'Rebirth, inner calling, absolution and awakening', meaningReversed: 'Self-doubt, refusal of the call, guilt', archetypeTag: 'judgement-archetype' },
  { id: 'the-world', name: 'The World', number: 21, symbol: '♾', meaningUpright: 'Completion, fulfillment, wholeness and achievement', meaningReversed: 'Incompletion, lack of closure, delays in fulfillment', archetypeTag: 'world-archetype' },
];

export function drawTarotCard(affinities: Record<string, number>): TarotResult {
  const index = Math.floor(Math.random() * MAJOR_ARCANA.length);
  const card = MAJOR_ARCANA[index];

  // Chaos affinity increases chance of reversal
  const reversalChance = 0.5 + (affinities.chaos ?? 0) * 0.3;
  // Order affinity decreases reversal chance
  const orderMod = (affinities.order ?? 0) * 0.2;
  const finalChance = Math.max(0.1, Math.min(0.9, reversalChance - orderMod));
  const orientation = Math.random() < finalChance ? 'reversed' : 'upright';

  const tags: string[] = [
    'draw', 'random', 'major-arcana', 'reversible',
    card.archetypeTag,
    orientation === 'reversed' ? 'reversed' : 'upright',
  ];

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
  };
}
