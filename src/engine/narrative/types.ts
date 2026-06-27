import type { ThemeTag, ModifierRole, QuestionType } from '../types';

export type FavBand = 'high' | 'neutral' | 'low';

export interface DrawVoice {
  subject: string; // e.g. "The Tower, reversed"
  clause: string;  // e.g. "unsettles the very ground you stand on"
}

export interface Pole { label: string; value: number }

/**
 * A typed unit of reading content. The composer emits an ordered Beat[]; the
 * prose builder realizes each into clauses and stitches them with connectives.
 */
export type Beat =
  | { kind: 'theme'; theme: ThemeTag; secondary: ThemeTag | null; favBand: FavBand }
  | { kind: 'fortune'; favBand: FavBand; strongestFavor: Pole | null; strongestAdverse: Pole | null }
  | { kind: 'temper'; axis: 'certainty' | 'volatility'; band: 'high' | 'low' }
  | { kind: 'force'; role: ModifierRole; draws: DrawVoice[] }
  | { kind: 'positions'; entries: { position: string; lean: 'favor' | 'steady' | 'adverse' }[] }
  | { kind: 'opposition'; favPole: Pole; advPole: Pole }
  | { kind: 'tensionPair'; pair: [ThemeTag, ThemeTag] }
  | { kind: 'close'; question: QuestionType; theme: ThemeTag; carryForce: string | null };
