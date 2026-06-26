import type {
  ConceptBandKind, ConceptFamily, DimensionValues, ModifierRole,
  ThemeTag, QuestionType, Tag, WovenNode, StringsResult,
} from '../engine/types';

export interface ConceptDef {
  id: string;
  name: string;
  glyph: string;              // short unicode symbol rendered inside the Sigil-Gem
  bands: ConceptBandKind[];
  family: ConceptFamily;
  themes: ThemeTag[];         // 1–2
  dimensions: DimensionValues;
  modifierRole: ModifierRole;
  mood: string;               // one-word surface hint
  meaning: string;            // full interpretation on arrival
  questionTypes?: QuestionType[]; // destinations only
}

const D = (favorability: number, certainty: number, volatility: number): DimensionValues =>
  ({ favorability, certainty, volatility });

// id, name, glyph, bands, family, themes, dims, role, mood, meaning, questionTypes?
type Row = [
  string, string, string, ConceptBandKind[], ConceptFamily, ThemeTag[],
  DimensionValues, ModifierRole, string, string, QuestionType[]?,
];

const ROWS: Row[] = [
  // ── Origins (role subject) ──
  ['the-self', 'The Self', '✦', ['origin'], 'neutral', ['mystery'], D(0, 0, 0), 'subject', 'here', "Where you stand now — the thread's first knot."],
  ['the-threshold', 'The Threshold', '⟡', ['origin'], 'neutral', ['transformation'], D(0, -0.5, 0.5), 'subject', 'edge', 'You stand at a verge; the weave begins to move.'],
  ['the-hearth', 'The Hearth', '⌂', ['origin'], 'neutral', ['harmony'], D(0.5, 0.5, -0.5), 'subject', 'home', 'From what is familiar, the thread sets out.'],
  ['the-question', 'The Question', '❖', ['origin'], 'neutral', ['mystery'], D(0, -0.5, 0), 'subject', 'why', 'The asking itself, around which fate coils.'],

  // ── Crossings (role action) ──
  ['a-rising-tide', 'A Rising Tide', '〜', ['crossing'], 'benevolent', ['renewal'], D(1, 0, 0.5), 'action', 'flow', 'A force gathers in your favor.'],
  ['the-severance', 'The Severance', '✂', ['crossing'], 'challenging', ['conflict', 'transformation'], D(-1, 0.5, 1), 'action', 'cut', 'Something is cut away.'],
  ['the-witness', 'The Witness', '◉', ['crossing'], 'neutral', ['mystery'], D(0, -0.5, 0), 'action', 'seen', 'You are observed; a presence marks your path.'],
  ['the-ember', 'The Ember', '✶', ['crossing'], 'benevolent', ['illumination'], D(0.5, 0, 0.5), 'action', 'spark', 'A small light insists on burning.'],
  ['the-undertow', 'The Undertow', '≈', ['crossing'], 'challenging', ['surrender'], D(-1, -0.5, 0.5), 'action', 'pull', 'A quiet pull drags beneath the surface.'],
  ['the-keystone', 'The Keystone', '⬢', ['crossing'], 'neutral', ['authority'], D(0.5, 1, -0.5), 'action', 'hold', 'A thing that holds the rest in place.'],
  ['the-reckoning', 'The Reckoning', '⚖', ['crossing'], 'challenging', ['conflict', 'authority'], D(-0.5, 0.5, 0.5), 'action', 'weigh', 'Accounts are called due.'],
  ['the-blossom', 'The Blossom', '❀', ['crossing'], 'benevolent', ['renewal', 'harmony'], D(1.5, 0, 0), 'action', 'bloom', 'What was tended comes to flower.'],
  ['the-fracture', 'The Fracture', '⟁', ['crossing'], 'challenging', ['upheaval'], D(-1, -0.5, 1.5), 'action', 'break', 'A break runs through the foundation.'],
  ['the-current', 'The Current', '➶', ['crossing'], 'neutral', ['transformation'], D(0, 0, 1), 'action', 'drift', 'Motion takes you somewhere not yet named.'],
  ['the-lantern-bearer', 'The Lantern-Bearer', '☼', ['crossing'], 'benevolent', ['illumination', 'authority'], D(1, 0.5, 0), 'action', 'guide', 'One who lights the way ahead.'],
  ['the-shroud', 'The Shroud', '☁', ['crossing'], 'challenging', ['mystery'], D(-0.5, -1, 0.5), 'action', 'veil', 'What is hidden presses close.'],

  // ── Destinations (role effect) — three per question ──
  ['the-chosen-road', 'The Chosen Road', '➤', ['destination'], 'benevolent', ['authority'], D(1, 1, 0), 'effect', 'choose', 'The path you take proves true.', ['decision']],
  ['the-closed-gate', 'The Closed Gate', '⛌', ['destination'], 'challenging', ['stagnation'], D(-1, 0.5, -0.5), 'effect', 'halt', 'This way is shut; turn elsewhere.', ['decision']],
  ['the-double-edge', 'The Double Edge', '⚔', ['destination'], 'neutral', ['conflict'], D(0, 0, 1), 'effect', 'both', 'Either choice cuts; weigh what you can bear to lose.', ['decision']],

  ['the-other', 'The Other', '❤', ['destination'], 'benevolent', ['harmony'], D(1.5, 0.5, 0), 'effect', 'bond', 'Another is bound to you by the thread of fate.', ['relationship']],
  ['the-parting', 'The Parting', '⤞', ['destination'], 'challenging', ['surrender'], D(-1, 0, 0.5), 'effect', 'apart', 'The strings loosen; a way diverges.', ['relationship']],
  ['the-mirror-soul', 'The Mirror-Soul', '☯', ['destination'], 'neutral', ['mystery', 'harmony'], D(0.5, -0.5, 0), 'effect', 'echo', 'You meet yourself in another.', ['relationship']],

  ['the-dawn', 'The Dawn', '☀', ['destination'], 'benevolent', ['renewal'], D(1.5, 0.5, 0), 'effect', 'rise', 'What comes brightens.', ['future']],
  ['the-long-night', 'The Long Night', '☾', ['destination'], 'challenging', ['stagnation', 'mystery'], D(-1, -0.5, 0), 'effect', 'wait', 'A dim stretch lies ahead; endure it.', ['future']],
  ['the-turning', 'The Turning', '☋', ['destination'], 'neutral', ['transformation'], D(0, 0, 1.5), 'effect', 'turn', 'All of it is about to change.', ['future']],

  ['the-true-name', 'The True Name', '✷', ['destination'], 'benevolent', ['illumination'], D(1, 1, 0), 'effect', 'know', 'You recognize what you are.', ['self']],
  ['the-hollow', 'The Hollow', '◍', ['destination'], 'challenging', ['stagnation'], D(-1, -0.5, 0), 'effect', 'empty', 'A lack you have circled for years.', ['self']],
  ['the-becoming', 'The Becoming', '⟰', ['destination'], 'neutral', ['transformation'], D(0.5, 0, 1), 'effect', 'grow', 'You are not finished; you are forming.', ['self']],
];

export const CONCEPTS: Record<string, ConceptDef> = Object.fromEntries(
  ROWS.map(([id, name, glyph, bands, family, themes, dimensions, modifierRole, mood, meaning, questionTypes]) =>
    [id, { id, name, glyph, bands, family, themes, dimensions, modifierRole, mood, meaning, questionTypes }]),
) as Record<string, ConceptDef>;

export const ORIGIN_IDS: string[] = ROWS.filter((r) => r[3].includes('origin')).map((r) => r[0]);
export const CROSSING_IDS: string[] = ROWS.filter((r) => r[3].includes('crossing')).map((r) => r[0]);

export function destinationsFor(q: QuestionType): string[] {
  return ROWS.filter((r) => r[3].includes('destination') && (r[10] ?? []).includes(q)).map((r) => r[0]);
}

/** The tag set a concept contributes to a consolidated path. */
export function conceptTags(c: ConceptDef): Tag[] {
  return [`concept-${c.id}`, `family-${c.family}`, ...c.themes];
}

// ── Consolidation ──
const AXES: (keyof DimensionValues)[] = ['favorability', 'certainty', 'volatility'];
const clampDim = (v: number) => Math.max(-2, Math.min(2, Math.round(v * 2) / 2));

// Theme opposition pairs (mirrors ReadingPlanner's THEME_OPPOSITIONS).
const THEME_OPPOSED: [ThemeTag, ThemeTag][] = [
  ['upheaval', 'harmony'], ['renewal', 'stagnation'],
  ['illumination', 'mystery'], ['conflict', 'surrender'], ['authority', 'surrender'],
];

/** Destination-governed: destination weight 2, origin & crossings weight 1. */
export function consolidatePath(path: WovenNode[]): StringsResult {
  const defs = path.map((n) => CONCEPTS[n.conceptId]);
  const destIdx = path.length - 1;
  const weightOf = (i: number) => (i === destIdx ? 2 : 1);
  const totalW = defs.reduce((s, _d, i) => s + weightOf(i), 0);

  const dims: DimensionValues = { favorability: 0, certainty: 0, volatility: 0 };
  for (let i = 0; i < defs.length; i++) {
    for (const a of AXES) dims[a] += defs[i].dimensions[a] * weightOf(i);
  }
  for (const a of AXES) dims[a] = clampDim(dims[a] / totalW);

  // Themes: weighted frequency, destination themes forced in, cap 2.
  const freq = new Map<ThemeTag, number>();
  defs.forEach((d, i) => d.themes.forEach((t) => freq.set(t, (freq.get(t) ?? 0) + weightOf(i))));
  const destThemes = defs[destIdx].themes;
  const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const themes: ThemeTag[] = [...new Set<ThemeTag>([...destThemes, ...ranked])].slice(0, 2);

  const roles = [...new Set<ModifierRole>(defs.map((d) => d.modifierRole))];
  const tags: Tag[] = [
    'draw', 'random', 'strings', 'weave',
    ...new Set(defs.flatMap((d) => conceptTags(d))),
  ];

  const dest = defs[destIdx];
  return {
    type: 'strings',
    id: `strings:${dest.id}`,
    name: defs.map((d) => d.name).join(' · '),
    symbol: dest.glyph,
    interpretation: `${dest.name} — ${dest.meaning}`,
    path,
    destinationId: dest.id,
    themes,
    dimensions: dims,
    modifierRoles: roles,
    tags,
  };
}

/** A path is `tangled` if it spans an opposed theme pair; else `coherent` if its
 *  themes cluster and favorability is steady; else null. */
export function pathCoherence(path: WovenNode[]): 'coherent' | 'tangled' | null {
  const defs = path.map((n) => CONCEPTS[n.conceptId]);
  const themes = new Set<ThemeTag>(defs.flatMap((d) => d.themes));
  for (const [a, b] of THEME_OPPOSED) if (themes.has(a) && themes.has(b)) return 'tangled';

  const favs = defs.map((d) => d.dimensions.favorability);
  const mean = favs.reduce((s, v) => s + v, 0) / favs.length;
  const variance = favs.reduce((s, v) => s + (v - mean) ** 2, 0) / favs.length;
  const sharedTheme = defs.every((d) => d.themes.some((t) => defs[0].themes.includes(t)));
  if (sharedTheme || Math.sqrt(variance) < 0.6) return 'coherent';
  return null;
}
