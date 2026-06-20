import type { IChingResult } from '../engine/types';

export interface HexagramData {
  number: number;
  name: string;
  symbol: string;
  judgment: string;
}

export const HEXAGRAMS: HexagramData[] = [
  { number: 1,  name: 'The Creative',               symbol: '䷀', judgment: 'The creative principle brings success through perseverance. Sublime and initiative.' },
  { number: 2,  name: 'The Receptive',              symbol: '䷁', judgment: 'The receptive brings supreme success through devotion to what is right.' },
  { number: 3,  name: 'Difficulty at the Beginning', symbol: '䷂', judgment: 'Initial challenges bring growth. Perseverance furthers.' },
  { number: 4,  name: 'Youthful Folly',              symbol: '䷃', judgment: 'The inexperienced must seek guidance. It is not the teacher who seeks the student.' },
  { number: 5,  name: 'Waiting',                     symbol: '䷄', judgment: 'Patience and sincere waiting bring success. The timing is not yet ripe.' },
  { number: 6,  name: 'Conflict',                    symbol: '䷅', judgment: 'Conflict arises when truth is contested. Seek impartial resolution.' },
  { number: 7,  name: 'The Army',                    symbol: '䷆', judgment: 'Disciplined collective action brings success. Leadership is required.' },
  { number: 8,  name: 'Holding Together',            symbol: '䷇', judgment: 'Union and cohesion bring strength. Those uncertain will find their way.' },
  { number: 9,  name: 'Small Taming',                symbol: '䷈', judgment: 'Gentle restraint yields progress. Small forces shape great outcomes.' },
  { number: 10, name: 'Treading',                    symbol: '䷉', judgment: 'Conduct yourself with care. Even dangerous paths can be walked safely.' },
  { number: 11, name: 'Peace',                       symbol: '䷊', judgment: 'Harmony between heaven and earth. The small departs, the great approaches.' },
  { number: 12, name: 'Standstill',                  symbol: '䷋', judgment: 'Stagnation and blockage. The great departs, the small approaches. Endure.' },
  { number: 13, name: 'Fellowship',                  symbol: '䷌', judgment: 'Community and shared purpose bring clarity. Openness unites.' },
  { number: 14, name: 'Great Possession',            symbol: '䷍', judgment: 'Abundance in harmony. Generosity ensures continued prosperity.' },
  { number: 15, name: 'Modesty',                     symbol: '䷎', judgment: 'Humility elevates. The modest are carried forward by the flow of things.' },
  { number: 16, name: 'Enthusiasm',                  symbol: '䷏', judgment: 'Enthusiastic movement inspires others. But enthusiasm must be grounded.' },
  { number: 17, name: 'Following',                   symbol: '䷐', judgment: 'Adapting to the flow of events brings success. The wise yield when necessary.' },
  { number: 18, name: 'Work on the Decayed',         symbol: '䷑', judgment: 'Corruption can be corrected through determined effort. Renewal follows decay.' },
  { number: 19, name: 'Approach',                    symbol: '䷒', judgment: 'Advancement is at hand. Favor comes to those who act with generosity.' },
  { number: 20, name: 'Contemplation',               symbol: '䷓', judgment: 'Observation reveals the deeper patterns. Understanding comes through reflection.' },
  { number: 21, name: 'Biting Through',              symbol: '䷔', judgment: 'Obstacles must be overcome with decisive action. Obstruction yields to force.' },
  { number: 22, name: 'Grace',                       symbol: '䷕', judgment: 'Beauty and refinement enhance the natural. But substance matters more than ornament.' },
  { number: 23, name: 'Splitting Apart',             symbol: '䷖', judgment: 'Decay spreads from within. The inferior threaten the superior. Wait.' },
  { number: 24, name: 'Return',                      symbol: '䷗', judgment: 'The turning point has come. Renewal begins after the darkness recedes.' },
  { number: 25, name: 'Innocence',                   symbol: '䷘', judgment: 'Act with natural sincerity. Unplanned virtue brings unexpected rewards.' },
  { number: 26, name: 'Great Taming',                symbol: '䷙', judgment: 'Great power is enriched through discipline and restraint. Accumulation furthers.' },
  { number: 27, name: 'Nourishment',                 symbol: '䷚', judgment: 'Sustain yourself and others. Words and actions must be measured and deliberate.' },
  { number: 28, name: 'Great Preponderance',         symbol: '䷛', judgment: 'Excess strains all systems. Extraordinary times call for extraordinary measures.' },
  { number: 29, name: 'The Abysmal',                 symbol: '䷜', judgment: 'Danger repeated requires caution. Sincerity and adaptability carry one through.' },
  { number: 30, name: 'The Clinging',                symbol: '䷝', judgment: 'Dependence on what is luminous brings clarity. Attachment must be balanced.' },
  { number: 31, name: 'Influence',                   symbol: '䷞', judgment: 'Mutual attraction creates connection. True influence is gentle and persistent.' },
  { number: 32, name: 'Duration',                    symbol: '䷟', judgment: 'Endurance and constancy bring success. Change within stability is the way.' },
  { number: 33, name: 'Retreat',                     symbol: '䷠', judgment: 'Withdrawal is strategic, not weak. Timely retreat preserves strength.' },
  { number: 34, name: 'Great Power',                 symbol: '䷡', judgment: 'Strength must be guided by justice. Power without direction leads to excess.' },
  { number: 35, name: 'Progress',                    symbol: '䷢', judgment: 'Advancement comes to those who are bright and generous. Success through merit.' },
  { number: 36, name: 'Darkening of the Light',      symbol: '䷣', judgment: 'The light fades but is not extinguished. Endure hardship with inner clarity.' },
  { number: 37, name: 'The Family',                  symbol: '䷤', judgment: 'Proper order in the home extends to all affairs. Roles bring harmony.' },
  { number: 38, name: 'Opposition',                  symbol: '䷥', judgment: 'Divergence creates tension but also perspective. Small matters may still succeed.' },
  { number: 39, name: 'Obstruction',                 symbol: '䷦', judgment: 'Obstacles block the path. Turn inward and seek wisdom before proceeding.' },
  { number: 40, name: 'Deliverance',                 symbol: '䷧', judgment: 'Release from difficulty arrives. Act quickly when the moment opens.' },
  { number: 41, name: 'Decrease',                    symbol: '䷨', judgment: 'Loss brings hidden gain. Sacrifice now yields reward later.' },
  { number: 42, name: 'Increase',                    symbol: '䷩', judgment: 'Growth comes through selfless contribution. The more given, the more received.' },
  { number: 43, name: 'Breakthrough',                symbol: '䷪', judgment: 'Resolution must be decisive. Truth proclaimed brings change.' },
  { number: 44, name: 'Coming to Meet',              symbol: '䷫', judgment: 'Unexpected encounters bring new possibilities. Caution tempers opportunity.' },
  { number: 45, name: 'Gathering Together',          symbol: '䷬', judgment: 'Collective unity brings strength. The many are greater than the few.' },
  { number: 46, name: 'Pushing Upward',              symbol: '䷭', judgment: 'Steady advancement through merit. The worthy rise naturally.' },
  { number: 47, name: 'Oppression',                  symbol: '䷮', judgment: 'Exhaustion and limitation test the spirit. Perseverance in adversity refines character.' },
  { number: 48, name: 'The Well',                    symbol: '䷯', judgment: 'Nourishment is available to all who draw from the source. Community depends on shared resources.' },
  { number: 49, name: 'Revolution',                  symbol: '䷰', judgment: 'Fundamental change is necessary. Shed the old to make way for the new.' },
  { number: 50, name: 'The Cauldron',                symbol: '䷱', judgment: 'Transformation through refinement. The raw is made useful through careful tending.' },
  { number: 51, name: 'The Arousing',                symbol: '䷲', judgment: 'Shock awakens and brings terror, then laughter. Disruption precedes new order.' },
  { number: 52, name: 'Keeping Still',               symbol: '䷳', judgment: 'Stillness in the face of distraction brings clarity. Know when to act and when to rest.' },
  { number: 53, name: 'Development',                 symbol: '䷴', judgment: 'Gradual progress is the surest path. The journey unfolds one step at a time.' },
  { number: 54, name: 'The Marrying Maiden',         symbol: '䷵', judgment: 'Alliances create new patterns. Overreaching brings regret.' },
  { number: 55, name: 'Abundance',                   symbol: '䷶', judgment: 'Peak prosperity arrives. Greatness must be enjoyed but not clung to.' },
  { number: 56, name: 'The Wanderer',                symbol: '䷷', judgment: 'Travel and transition bring change. The stranger must act with care.' },
  { number: 57, name: 'The Gentle',                  symbol: '䷸', judgment: 'Gentle penetration achieves great effects. The wind shapes the mountain.' },
  { number: 58, name: 'The Joyous',                  symbol: '䷹', judgment: 'Joy shared multiplies. Expression of happiness attracts good fortune.' },
  { number: 59, name: 'Dispersion',                  symbol: '䷺', judgment: 'Division dissolves through shared purpose. Gather the scattered.' },
  { number: 60, name: 'Limitation',                  symbol: '䷻', judgment: 'Boundaries create form and meaning. Acceptance of limits brings success.' },
  { number: 61, name: 'Inner Truth',                 symbol: '䷼', judgment: 'Sincerity moves even the unreachable. Simple truth has great power.' },
  { number: 62, name: 'Small Preponderance',         symbol: '䷽', judgment: 'Small actions have large consequences. Moderation in all things.' },
  { number: 63, name: 'After Completion',            symbol: '䷾', judgment: 'Order has been achieved. Vigilance prevents decline into disorder.' },
  { number: 64, name: 'Before Completion',           symbol: '䷿', judgment: 'The work is nearly done. Caution and care complete the task.' },
];

export function castHexagram(affinities: Record<string, number>): IChingResult {
  // 3-coin method: 3 coins flipped 6 times
  // Each flip: heads=3, tails=2 -> sum 6,7,8,9
  // 6 (old yin, changing), 7 (young yang, stable), 8 (young yin, stable), 9 (old yang, changing)
  const changingLines: number[] = [];

  // Chaos increases chance of changing lines
  const changingBias = (affinities.chaos ?? 0) * 0.2;

  for (let line = 0; line < 6; line++) {
    let sum = 0;
    for (let coin = 0; coin < 3; coin++) {
      sum += Math.random() < 0.5 ? 2 : 3;
    }
    // With chaos bias, push toward changing values (6 or 9)
    if (Math.random() < changingBias && (sum === 7 || sum === 8)) {
      sum = sum === 7 ? 6 : 9;
    }
    if (sum === 6 || sum === 9) {
      changingLines.push(line + 1); // 1-indexed lines
    }
  }

  const hexagramIndex = Math.floor(Math.random() * 64);
  const hexagram = HEXAGRAMS[hexagramIndex];

  const tags: string[] = ['draw', 'random', 'binary'];
  if (changingLines.length > 0) {
    tags.push('changing-lines');
  }

  return {
    type: 'iching',
    hexagramNumber: hexagram.number,
    name: hexagram.name,
    symbol: hexagram.symbol,
    judgment: hexagram.judgment,
    changingLines,
    tags,
  };
}
