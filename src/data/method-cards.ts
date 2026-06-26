import type { DivinationType } from '../engine/types';

export interface MethodFrontConfig {
  title: string;
  flavor: string;  // short italic line under the title
  color: string;   // family accent
  symbol: string;  // roman numeral / glyph used as a fallback / corner mark
}

// Single source of truth for the illustrated method-card fronts. `happening`
// never appears in the selectable pool but is included for type-completeness.
export const METHOD_FRONTS: Record<DivinationType, MethodFrontConfig> = {
  tarot:     { title: 'Tarot',        flavor: 'The arcana reveal hidden truths.',   color: '#9b6bb0', symbol: 'XXI' },
  d20:       { title: 'Dice',         flavor: 'Fate speaks through numbers.',        color: '#c75b4a', symbol: '⚅' },
  iching:    { title: 'I Ching',      flavor: 'The hexagram illuminates the path.',  color: '#5b8c5a', symbol: '䷀' },
  astral:    { title: 'Astral',       flavor: 'The heavens disclose their wisdom.',  color: '#5b7ec7', symbol: '★' },
  rune:      { title: 'Rune Casting', flavor: 'The staves speak as they fall.',      color: '#c8a86a', symbol: 'ᚠ' },
  strings:   { title: 'Strings of Fate', flavor: 'Follow the red thread through the dark.', color: '#c33b5e', symbol: '✶' },
  happening: { title: 'Happening',    flavor: 'Something stirs in the weave.',       color: '#d4a854', symbol: '✦' },
};
