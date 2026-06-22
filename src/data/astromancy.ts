import type {
  PlanetId, SignId, ThemeTag, DimensionValues, ModifierRole,
} from '../engine/types';

export interface PlanetDef {
  id: PlanetId; glyph: string; name: string;
  theme: ThemeTag; modifierRole: ModifierRole; dimensions: DimensionValues;
}
export interface SignDef {
  id: SignId; glyph: string; name: string;
  element: 'fire' | 'earth' | 'air' | 'water';
  modality: 'cardinal' | 'fixed' | 'mutable';
}
export interface HouseDef { house: number; arena: string; theme: ThemeTag; }

const D = (favorability: number, certainty: number, volatility: number): DimensionValues =>
  ({ favorability, certainty, volatility });

export const PLANETS: Record<PlanetId, PlanetDef> = {
  sun:        { id: 'sun',        glyph: '☉', name: 'Sun',        theme: 'illumination',   modifierRole: 'subject', dimensions: D(1.0, 0.5, 0) },
  moon:       { id: 'moon',       glyph: '☽', name: 'Moon',       theme: 'mystery',        modifierRole: 'subject', dimensions: D(0.5, -1.0, 0.5) },
  mercury:    { id: 'mercury',    glyph: '☿', name: 'Mercury',    theme: 'illumination',   modifierRole: 'action',  dimensions: D(0, 0.5, 0.5) },
  venus:      { id: 'venus',      glyph: '♀', name: 'Venus',      theme: 'harmony',        modifierRole: 'subject', dimensions: D(1.5, 0, -0.5) },
  mars:       { id: 'mars',       glyph: '♂', name: 'Mars',       theme: 'conflict',       modifierRole: 'action',  dimensions: D(-1.0, 0.5, 1.5) },
  jupiter:    { id: 'jupiter',    glyph: '♃', name: 'Jupiter',    theme: 'renewal',        modifierRole: 'subject', dimensions: D(1.5, 0, 0.5) },
  saturn:     { id: 'saturn',     glyph: '♄', name: 'Saturn',     theme: 'authority',      modifierRole: 'effect',  dimensions: D(-0.5, 1.5, -0.5) },
  uranus:     { id: 'uranus',     glyph: '♅', name: 'Uranus',     theme: 'upheaval',       modifierRole: 'effect',  dimensions: D(0, -0.5, 1.5) },
  neptune:    { id: 'neptune',    glyph: '♆', name: 'Neptune',    theme: 'mystery',        modifierRole: 'effect',  dimensions: D(0, -1.0, 0.5) },
  pluto:      { id: 'pluto',      glyph: '♇', name: 'Pluto',      theme: 'transformation', modifierRole: 'effect',  dimensions: D(-0.5, 0, 1.5) },
  'north-node': { id: 'north-node', glyph: '☊', name: 'North Node', theme: 'renewal',     modifierRole: 'action',  dimensions: D(1.0, -0.5, 0.5) },
  'south-node': { id: 'south-node', glyph: '☋', name: 'South Node', theme: 'surrender',   modifierRole: 'effect',  dimensions: D(-1.0, 0, 0) },
};

const SIGN_ROWS: [SignId, string, string, SignDef['element'], SignDef['modality']][] = [
  ['aries', '♈', 'Aries', 'fire', 'cardinal'],
  ['taurus', '♉', 'Taurus', 'earth', 'fixed'],
  ['gemini', '♊', 'Gemini', 'air', 'mutable'],
  ['cancer', '♋', 'Cancer', 'water', 'cardinal'],
  ['leo', '♌', 'Leo', 'fire', 'fixed'],
  ['virgo', '♍', 'Virgo', 'earth', 'mutable'],
  ['libra', '♎', 'Libra', 'air', 'cardinal'],
  ['scorpio', '♏', 'Scorpio', 'water', 'fixed'],
  ['sagittarius', '♐', 'Sagittarius', 'fire', 'mutable'],
  ['capricorn', '♑', 'Capricorn', 'earth', 'cardinal'],
  ['aquarius', '♒', 'Aquarius', 'air', 'fixed'],
  ['pisces', '♓', 'Pisces', 'water', 'mutable'],
];
export const SIGNS: Record<SignId, SignDef> = Object.fromEntries(
  SIGN_ROWS.map(([id, glyph, name, element, modality]) => [id, { id, glyph, name, element, modality }]),
) as Record<SignId, SignDef>;

export const ELEMENT_BY_SIGN: Record<SignId, SignDef['element']> =
  Object.fromEntries(SIGN_ROWS.map(([id, , , element]) => [id, element])) as Record<SignId, SignDef['element']>;

export const HOUSES: HouseDef[] = [
  { house: 1,  arena: 'Self',          theme: 'authority' },
  { house: 2,  arena: 'Resources',     theme: 'stagnation' },
  { house: 3,  arena: 'Communication', theme: 'illumination' },
  { house: 4,  arena: 'Roots',         theme: 'harmony' },
  { house: 5,  arena: 'Creativity',    theme: 'renewal' },
  { house: 6,  arena: 'Work',          theme: 'stagnation' },
  { house: 7,  arena: 'Partnership',   theme: 'harmony' },
  { house: 8,  arena: 'Rebirth',       theme: 'transformation' },
  { house: 9,  arena: 'Journeys',      theme: 'illumination' },
  { house: 10, arena: 'Career',        theme: 'authority' },
  { house: 11, arena: 'Community',     theme: 'renewal' },
  { house: 12, arena: 'The Hidden',    theme: 'mystery' },
];

export const DIGNITY: Record<PlanetId, { dignified: SignId[]; debilitated: SignId[] }> = {
  sun:        { dignified: ['leo'],                debilitated: ['aquarius'] },
  moon:       { dignified: ['cancer'],             debilitated: ['capricorn'] },
  mercury:    { dignified: ['gemini', 'virgo'],    debilitated: ['sagittarius', 'pisces'] },
  venus:      { dignified: ['taurus', 'libra'],    debilitated: ['scorpio', 'aries'] },
  mars:       { dignified: ['aries', 'scorpio'],   debilitated: ['libra', 'taurus'] },
  jupiter:    { dignified: ['sagittarius', 'pisces'], debilitated: ['gemini', 'virgo'] },
  saturn:     { dignified: ['capricorn', 'aquarius'], debilitated: ['cancer', 'aries'] },
  uranus:     { dignified: ['aquarius'],           debilitated: ['leo'] },
  neptune:    { dignified: ['pisces'],             debilitated: ['virgo'] },
  pluto:      { dignified: ['scorpio'],            debilitated: ['taurus'] },
  'north-node': { dignified: [],                   debilitated: [] },
  'south-node': { dignified: [],                   debilitated: [] },
};
