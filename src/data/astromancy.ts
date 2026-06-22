import type {
  PlanetId, SignId, AspectName, ThemeTag, DimensionValues, ModifierRole, AstralCast, AstralResult, Tag,
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

const ASPECT_BY_STEP: Record<number, AspectName> = {
  0: 'conjunction', 1: 'minor', 2: 'sextile', 3: 'square', 4: 'trine', 5: 'minor', 6: 'opposition',
};

export function aspectBetween(houseA: number, houseB: number): AspectName {
  const d = Math.abs(houseA - houseB);
  const step = Math.min(d, 12 - d); // 0..6
  return ASPECT_BY_STEP[step];
}

export const ASPECT_EFFECT: Record<AspectName, { dims: Partial<DimensionValues>; theme?: ThemeTag }> = {
  conjunction: { dims: { certainty: 1.5, volatility: 0.5 } },
  sextile:     { dims: { favorability: 1.0, certainty: 0.5 }, theme: 'harmony' },
  square:      { dims: { favorability: -0.5, volatility: 1.0 }, theme: 'conflict' },
  trine:       { dims: { favorability: 1.0, certainty: 0.5 }, theme: 'harmony' },
  opposition:  { dims: { certainty: 1.0, volatility: 1.0 }, theme: 'upheaval' },
  minor:       { dims: { volatility: 0.5, certainty: -0.5 }, theme: 'mystery' },
};

// Lean/theme helper tables
export const MODALITY_THEMES: Record<SignDef['modality'], ThemeTag> = {
  cardinal: 'authority',
  fixed: 'stagnation',
  mutable: 'illumination',
};

export const ELEMENT_THEMES: Record<SignDef['element'], ThemeTag> = {
  fire: 'transformation',
  earth: 'stagnation',
  air: 'illumination',
  water: 'harmony',
};

// ── Element and modality dimension leans ──

const ELEMENT_LEAN: Record<SignDef['element'], Partial<DimensionValues>> = {
  fire:  { volatility: 0.5, favorability: 0.5 },
  earth: { certainty: 0.5, volatility: -0.5 },
  air:   { certainty: 0.5 },
  water: { favorability: 0.5, certainty: -0.5 },
};
const MODALITY_LEAN: Record<SignDef['modality'], Partial<DimensionValues>> = {
  cardinal: { volatility: 0.5 },
  fixed:    { certainty: 0.5, volatility: -0.5 },
  mutable:  { volatility: 0.5, certainty: -0.5 },
};

// ── Dignity ──

export function dignityOf(planet: PlanetId, sign: SignId): 'dignified' | 'debilitated' | null {
  const d = DIGNITY[planet];
  if (d.dignified.includes(sign)) return 'dignified';
  if (d.debilitated.includes(sign)) return 'debilitated';
  return null;
}

// ── Consolidation ──

const AXES: (keyof DimensionValues)[] = ['favorability', 'certainty', 'volatility'];
const clampDim = (v: number) => Math.max(-2, Math.min(2, Math.round(v * 2) / 2));

function addDims(target: DimensionValues, src: Partial<DimensionValues>) {
  for (const a of AXES) target[a] += src[a] ?? 0;
}

export function consolidateCast(cast: AstralCast): AstralResult {
  const planet = PLANETS[cast.planet];
  const sign = SIGNS[cast.sign];
  const house = HOUSES[cast.planetHouse - 1];
  const aspect = aspectBetween(cast.planetHouse, cast.signHouse);
  const aspectEffect = ASPECT_EFFECT[aspect];
  const dignity = dignityOf(cast.planet, cast.sign);

  // Sum dimensions: planet + element lean + modality lean + aspect, then divide by 2
  const dims: DimensionValues = { favorability: 0, certainty: 0, volatility: 0 };
  addDims(dims, planet.dimensions);
  addDims(dims, ELEMENT_LEAN[sign.element]);
  addDims(dims, MODALITY_LEAN[sign.modality]);
  addDims(dims, aspectEffect.dims);
  for (const a of AXES) dims[a] = clampDim(dims[a] / 2);

  // Build themes: ranked by house → planet → aspect → sign(element), deduped, capped at 2
  const themes: ThemeTag[] = [];
  const seenThemes = new Set<ThemeTag>();

  const addTheme = (t: ThemeTag | undefined) => {
    if (t && !seenThemes.has(t)) { themes.push(t); seenThemes.add(t); }
  };
  addTheme(house.theme);
  addTheme(planet.theme);
  addTheme(aspectEffect.theme);
  addTheme(ELEMENT_THEMES[sign.element]);

  themes.splice(2);

  // Build tags
  const tags: Tag[] = [
    'draw', 'random', 'astral',
    `planet-${cast.planet}`,
    `sign-${cast.sign}`,
    `house-${cast.planetHouse}`,
    `element-${sign.element}`,
    `aspect-${aspect}`,
    ...(dignity ? [dignity] : []),
    ...cast.omens,
  ];

  return {
    type: 'astral',
    id: `astral:${cast.planet}-${cast.sign}-h${cast.planetHouse}`,
    name: `${planet.name} in ${sign.name}`,
    symbol: planet.glyph,
    interpretation: `${planet.name} in ${sign.name}, in the House of ${house.arena} — ${planet.theme} meets its arena.`,
    planet: cast.planet,
    sign: cast.sign,
    house: cast.planetHouse,
    aspect,
    themes,
    dimensions: dims,
    modifierRoles: [planet.modifierRole],
    tags,
    cast,
  };
}

const PLANET_IDS = Object.keys(PLANETS) as PlanetId[];
const SIGN_IDS = Object.keys(SIGNS) as SignId[];
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const house = () => Math.floor(Math.random() * 12) + 1;

// Engine-side generator (no physics). Order tightens the two houses (calmer aspects);
// chaos widens them (more extreme aspects). Faces are uniform.
export function drawAstralCast(affinities: Record<string, number>): AstralCast {
  const order = (affinities.order ?? 0) / 100;
  const chaos = (affinities.chaos ?? 0) / 100;
  const planetHouse = house();
  let signHouse = house();
  if (order > chaos && Math.random() < order - chaos) {
    // pull signHouse toward planetHouse (smaller separation)
    const toward = planetHouse + (Math.random() < 0.5 ? 1 : -1);
    signHouse = ((toward + 11) % 12) + 1;
  } else if (chaos > order && Math.random() < chaos - order) {
    // push toward opposition
    signHouse = ((planetHouse + 5) % 12) + 1;
  }
  return { planet: pick(PLANET_IDS), planetHouse, sign: pick(SIGN_IDS), signHouse, omens: [] };
}
