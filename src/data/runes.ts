import type {
  RuneId, RuneAett, RuneRing, RuneOrientation, RuneOmenTag,
  LandedRune, RuneScatter, RuneResult,
  DimensionValues, ThemeTag, ModifierRole, Tag,
} from '../engine/types';

export interface RuneDef {
  id: RuneId; glyph: string; name: string; aett: RuneAett;
  reversible: boolean;            // false → symmetric stave; never falls merkstave
  theme: ThemeTag; modifierRole: ModifierRole;
  dimensions: DimensionValues;    // upright dimensions
  meaningUpright: string; meaningReversed: string;
}

const D = (favorability: number, certainty: number, volatility: number): DimensionValues =>
  ({ favorability, certainty, volatility });

// Elder Futhark, three aettir of eight. reversible=false → symmetric stave.
const ROWS: [RuneId, string, string, RuneAett, boolean, ThemeTag, ModifierRole, DimensionValues, string, string][] = [
  ['fehu', 'ᚠ', 'Fehu', 'freyr', true, 'renewal', 'effect', D(1, 0.5, 0), 'Wealth earned, abundance, new energy.', 'Loss, greed, what slips through the fingers.'],
  ['uruz', 'ᚢ', 'Uruz', 'freyr', true, 'transformation', 'subject', D(0.5, 0, 1), 'Raw vitality, untamed strength, will.', 'Weakness, misused force, sickness.'],
  ['thurisaz', 'ᚦ', 'Thurisaz', 'freyr', true, 'conflict', 'action', D(-0.5, 0, 1.5), 'Reactive force, a defended threshold.', 'Danger, compulsion, a thorn turned inward.'],
  ['ansuz', 'ᚨ', 'Ansuz', 'freyr', true, 'illumination', 'subject', D(1, 0.5, 0), 'Insight, the divine word, a true message.', 'Deception, misheard counsel, vanity.'],
  ['raidho', 'ᚱ', 'Raidho', 'freyr', true, 'authority', 'action', D(0.5, 0.5, 0), 'Right action, the journey, rhythm kept.', 'Crisis, a wrong road, dislocation.'],
  ['kenaz', 'ᚲ', 'Kenaz', 'freyr', true, 'illumination', 'effect', D(1, 0.5, 0.5), 'The torch, craft, controlled fire.', 'Loss of vision, exposure, a guttering flame.'],
  ['gebo', 'ᚷ', 'Gebo', 'freyr', false, 'harmony', 'subject', D(1.5, 0.5, 0), 'Gift, partnership, balanced exchange.', 'Gift, partnership, balanced exchange.'],
  ['wunjo', 'ᚹ', 'Wunjo', 'freyr', true, 'harmony', 'effect', D(1.5, 0.5, 0), 'Joy, harmony, belonging.', 'Sorrow, discord, alienation.'],
  ['hagalaz', 'ᚺ', 'Hagalaz', 'heimdall', false, 'upheaval', 'effect', D(-1, 0.5, 1.5), 'Hail — the storm that breaks and resets.', 'Hail — the storm that breaks and resets.'],
  ['nauthiz', 'ᚾ', 'Nauthiz', 'heimdall', true, 'stagnation', 'effect', D(-1, 0.5, 0), 'Need, constraint, the lesson of limits.', 'Deprivation, despair, want unmet.'],
  ['isa', 'ᛁ', 'Isa', 'heimdall', false, 'stagnation', 'effect', D(-0.5, 1, -1.5), 'Ice — standstill, stasis, the held breath.', 'Ice — standstill, stasis, the held breath.'],
  ['jera', 'ᛃ', 'Jera', 'heimdall', false, 'renewal', 'effect', D(1, 1, 0), 'Harvest, the turning year, reward in time.', 'Harvest, the turning year, reward in time.'],
  ['eihwaz', 'ᛇ', 'Eihwaz', 'heimdall', false, 'transformation', 'subject', D(0.5, 1, -0.5), 'The world-axis, endurance, death and return.', 'The world-axis, endurance, death and return.'],
  ['perthro', 'ᛈ', 'Perthro', 'heimdall', true, 'mystery', 'subject', D(0, -1, 1), 'The lot-cup — fate, chance, the cast itself.', 'Secrets withheld, luck stalled, a closed hand.'],
  ['algiz', 'ᛉ', 'Algiz', 'heimdall', true, 'authority', 'effect', D(1, 0.5, 0), 'Protection, the warding elk, a raised hand.', 'Vulnerability, a guard let down, hidden danger.'],
  ['sowilo', 'ᛋ', 'Sowilo', 'heimdall', false, 'illumination', 'subject', D(1.5, 1, 0), 'The sun — victory, wholeness, guiding light.', 'The sun — victory, wholeness, guiding light.'],
  ['tiwaz', 'ᛏ', 'Tiwaz', 'tyr', true, 'authority', 'action', D(1, 1, 0), 'Victory, justice, honor, the just sacrifice.', 'Injustice, defeat, lost faith.'],
  ['berkano', 'ᛒ', 'Berkano', 'tyr', true, 'renewal', 'subject', D(1, 0, 0.5), 'Growth, fertility, a new beginning.', 'Stagnation, a stalled bloom, family trouble.'],
  ['ehwaz', 'ᛖ', 'Ehwaz', 'tyr', true, 'harmony', 'action', D(1, 0.5, 0.5), 'Trust, partnership, steady movement.', 'Disharmony, mistrust, a faithless step.'],
  ['mannaz', 'ᛗ', 'Mannaz', 'tyr', true, 'authority', 'subject', D(0.5, 0.5, 0), 'The self, humanity, the measured mind.', 'Isolation, self-deception, the crowd misjudged.'],
  ['laguz', 'ᛚ', 'Laguz', 'tyr', true, 'mystery', 'effect', D(0.5, -1, 0.5), 'Flow, intuition, the deep water.', 'Confusion, fear, what drowns the unwary.'],
  ['ingwaz', 'ᛜ', 'Ingwaz', 'tyr', false, 'renewal', 'effect', D(1, 0.5, -0.5), 'Gestation, stored potential, the sealed seed.', 'Gestation, stored potential, the sealed seed.'],
  ['othala', 'ᛟ', 'Othala', 'tyr', true, 'authority', 'subject', D(1, 1, 0), 'Heritage, home, lasting ground.', 'Rootlessness, loss of legacy, a broken hearth.'],
  ['dagaz', 'ᛞ', 'Dagaz', 'tyr', false, 'transformation', 'effect', D(1.5, 0.5, 0.5), 'Breakthrough, dawn, the turning point.', 'Breakthrough, dawn, the turning point.'],
];

export const RUNES: Record<RuneId, RuneDef> = Object.fromEntries(
  ROWS.map(([id, glyph, name, aett, reversible, theme, modifierRole, dimensions, meaningUpright, meaningReversed]) =>
    [id, { id, glyph, name, aett, reversible, theme, modifierRole, dimensions, meaningUpright, meaningReversed }]),
) as Record<RuneId, RuneDef>;

export const AETTIR: Record<RuneAett, RuneId[]> = {
  freyr: ROWS.filter((r) => r[3] === 'freyr').map((r) => r[0]),
  heimdall: ROWS.filter((r) => r[3] === 'heimdall').map((r) => r[0]),
  tyr: ROWS.filter((r) => r[3] === 'tyr').map((r) => r[0]),
};

export const NON_REVERSIBLE: RuneId[] = ROWS.filter((r) => !r[4]).map((r) => r[0]);

// ── Cloth ring geometry ──
export const RING_BOUNDS = { heartMax: 0.33, fieldMax: 0.75, clothMax: 1.1 };
export function ringOf(r: number): RuneRing {
  if (r < RING_BOUNDS.heartMax) return 'heart';
  if (r < RING_BOUNDS.fieldMax) return 'field';
  return 'margin';
}

// ── Consolidation ──

const AXES: (keyof DimensionValues)[] = ['favorability', 'certainty', 'volatility'];
const clampDim = (v: number) => Math.max(-2, Math.min(2, Math.round(v * 2) / 2));
const addDims = (t: DimensionValues, s: Partial<DimensionValues>) => { for (const a of AXES) t[a] += s[a] ?? 0; };

// Brightness for favored/clouded selection: favorability with a merkstave penalty.
export function stoneBrightness(stone: LandedRune): number {
  const base = RUNES[stone.rune].dimensions.favorability;
  return stone.orientation === 'merkstave' ? base - 2 : base;
}

export function consolidateScatter(scatter: RuneScatter): RuneResult {
  const gov = scatter.stones[scatter.governingIndex];
  const def = RUNES[gov.rune];
  const dims: DimensionValues = { favorability: 0, certainty: 0, volatility: 0 };

  // Governing (full), with the merkstave shadow transform (always more adverse/volatile).
  addDims(dims, def.dimensions);
  if (gov.orientation === 'merkstave') addDims(dims, { favorability: -1, volatility: 0.5, certainty: -0.5 });

  // Supporting (face-up upright, non-governing, heart/field): half dims + theme.
  // Crossing (face-up merkstave, or any stone in the margin): tax.
  const themes: ThemeTag[] = [def.theme];
  const seen = new Set<ThemeTag>(themes);
  scatter.stones.forEach((s, i) => {
    if (i === scatter.governingIndex || !s.faceUp) return;
    const crossing = s.orientation === 'merkstave' || s.ring === 'margin';
    if (crossing) {
      addDims(dims, { favorability: -0.5, volatility: 0.5 });
    } else {
      const sd = RUNES[s.rune].dimensions;
      addDims(dims, { favorability: sd.favorability / 2, certainty: sd.certainty / 2, volatility: sd.volatility / 2 });
      const t = RUNES[s.rune].theme;
      if (!seen.has(t)) { themes.push(t); seen.add(t); }
    }
  });
  for (const a of AXES) dims[a] = clampDim(dims[a] / 2);
  themes.splice(2);

  const tags: Tag[] = [
    'draw', 'rune', 'random',
    `rune-${gov.rune}`, `aett-${def.aett}`, `ring-${gov.ring}`,
    `orientation-${gov.orientation}`,
    gov.orientation === 'upright' ? 'upright' : 'reversed',
    def.reversible ? 'reversible' : 'non-reversible',
    ...scatter.omens,
  ];

  const meaning = gov.orientation === 'upright' ? def.meaningUpright : def.meaningReversed;
  const ringName = gov.ring[0].toUpperCase() + gov.ring.slice(1);
  return {
    type: 'rune',
    id: `rune:${gov.rune}-${gov.orientation}-${gov.ring}`,
    name: `${def.name}${gov.orientation === 'merkstave' ? ' — Merkstave' : ''}`,
    symbol: def.glyph,
    rune: gov.rune, orientation: gov.orientation, ring: gov.ring,
    interpretation: `${def.name} in the ${ringName} — ${meaning}`,
    themes, dimensions: dims, modifierRoles: [def.modifierRole],
    tags, scatter,
  };
}

// ── Scatter fall ──

const ALL_RUNE_IDS = Object.keys(RUNES) as RuneId[];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface ScatterInput {
  affinities: Record<string, number>;
  aim?: { angle: number; power: number }; // angle radians, power 0..1
  drift?: number;                          // 0..1 Fate drift toward the Heart
  reveal?: boolean;                        // Light favored — force silent stones face-up
  rng?: () => number;
}

export function resolveScatter(input: ScatterInput): RuneScatter {
  const rng = input.rng ?? Math.random;
  const chaos = (input.affinities.chaos ?? 0) / 100;
  const order = (input.affinities.order ?? 0) / 100;
  const light = (input.affinities.light ?? 0) / 100;
  const shadow = (input.affinities.shadow ?? 0) / 100;
  const drift = Math.max(0, Math.min(1, input.drift ?? 0));

  // cluster centroid from aim (power → distance), else origin
  const aimDist = input.aim ? input.aim.power * 0.5 : 0;
  const cx = input.aim ? Math.cos(input.aim.angle) * aimDist : 0;
  const cy = input.aim ? Math.sin(input.aim.angle) * aimDist : 0;
  const spreadBase = 0.45 * (1 + chaos - order); // wider with chaos, tighter with order

  const ids = [...ALL_RUNE_IDS];
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const drawn = ids.slice(0, 6);

  const stones: LandedRune[] = drawn.map((rune) => {
    const ang = rng() * Math.PI * 2;
    const rad = spreadBase * (0.3 + rng());
    let x = cx + Math.cos(ang) * rad;
    let y = cy + Math.sin(ang) * rad;
    x = lerp(x, 0, drift); y = lerp(y, 0, drift);
    const r = Math.hypot(x, y);
    const faceUp = input.reveal ? true : rng() < 0.6 + light * 0.4 - shadow * 0.4;
    const canMerk = RUNES[rune].reversible && faceUp;
    const orientation: RuneOrientation = canMerk && rng() < 0.35 + chaos * 0.4 - order * 0.3 ? 'merkstave' : 'upright';
    return { rune, faceUp, orientation, ring: ringOf(r), x, y };
  });

  // guarantee a face-up governing stone — the cast insists on speaking
  if (!stones.some((s) => s.faceUp)) {
    let nearest = 0;
    for (let i = 1; i < stones.length; i++) {
      if (Math.hypot(stones[i].x, stones[i].y) < Math.hypot(stones[nearest].x, stones[nearest].y)) nearest = i;
    }
    stones[nearest].faceUp = true;
  }
  let governingIndex = -1;
  stones.forEach((s, i) => {
    if (!s.faceUp) return;
    if (governingIndex < 0 || Math.hypot(s.x, s.y) < Math.hypot(stones[governingIndex].x, stones[governingIndex].y)) governingIndex = i;
  });

  return { stones, governingIndex, omens: detectOmens(stones, governingIndex) };
}

function detectOmens(stones: LandedRune[], governingIndex: number): RuneOmenTag[] {
  const omens: RuneOmenTag[] = [];
  const faceUp = stones.filter((s) => s.faceUp);
  const supporters = stones.filter((s, i) => i !== governingIndex && s.faceUp && s.orientation === 'upright');
  const aettCount = supporters.reduce((m, s) => {
    const a = RUNES[s.rune].aett;
    m[a] = (m[a] ?? 0) + 1;
    return m;
  }, {} as Record<string, number>);
  if (Object.values(aettCount).some((n) => n >= 2)) omens.push('bindrune');
  if (faceUp.length >= 2 && faceUp.every((s) => s.orientation === 'merkstave')) omens.push('merkstave-cascade');
  const gov = stones[governingIndex];
  if (gov && gov.orientation === 'upright' && gov.ring === 'heart') omens.push('true-cast');
  if (stones.filter((s) => !s.faceUp).length >= Math.ceil(stones.length / 2)) omens.push('silent-field');
  if (stones.some((s) => Math.hypot(s.x, s.y) > RING_BOUNDS.clothMax)) omens.push('errant-rune');
  return omens;
}

// Pure engine-side generator (no aim/physics) — used for spawn-second / reroll.
export function drawRuneScatter(affinities: Record<string, number>, rng: () => number = Math.random): RuneScatter {
  return resolveScatter({ affinities, rng });
}
