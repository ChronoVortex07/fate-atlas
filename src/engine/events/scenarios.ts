import type { AffinityId, SlotResult } from '../types';
import { defaultAffinityState } from '../../data/affinities';
import { consolidateSpread, buildFace, DECK_BY_ID } from '../../data/tarot';
import { consolidateCast } from '../../data/astromancy';
import { consolidateScatter } from '../../data/runes';
import { consolidatePath, CONCEPTS as STRINGS_CONCEPTS } from '../../data/strings';
import type { RuneId, RuneOmenTag, LandedRune, WovenNode } from '../types';

export interface ScenarioStage {
  affinities: Record<AffinityId, number>;
  screen: string;
  selectedMethod: string | null;
  slots: SlotResult[];
}

export interface DebugScenario {
  id: string;
  label: string;
  group: string;
  forced: string[];
  isolate: boolean;
  setup(s: ScenarioStage): void;
}

const atMethodSelect = (s: ScenarioStage) => { s.screen = 'method-select'; };
const atDice = (s: ScenarioStage) => { s.screen = 'minigame'; s.selectedMethod = 'd20'; };
const atTarot = (s: ScenarioStage) => { s.screen = 'minigame'; s.selectedMethod = 'tarot'; };
const atAstral = (s: ScenarioStage) => { s.screen = 'minigame'; s.selectedMethod = 'astral'; };
const atRune = (s: ScenarioStage) => { s.screen = 'minigame'; s.selectedMethod = 'rune'; };
const set = (s: ScenarioStage, a: Partial<Record<AffinityId, number>>) => Object.assign(s.affinities, a);

const runeStone = (rune: RuneId, faceUp = true, orientation: LandedRune['orientation'] = 'upright', ring: LandedRune['ring'] = 'heart'): LandedRune =>
  ({ rune, faceUp, orientation, ring, x: 0, y: 0 });
const runeSlot = (governing: RuneId, omens: RuneOmenTag[] = [], extra: LandedRune[] = []): SlotResult =>
  consolidateScatter({ stones: [runeStone(governing), ...extra], governingIndex: 0, omens }) as SlotResult;

const atStrings = (s: ScenarioStage) => { s.screen = 'minigame'; s.selectedMethod = 'strings'; };
const wovenNode = (conceptId: string, band: number): WovenNode =>
  ({ id: `b${band}`, conceptId, band, family: STRINGS_CONCEPTS[conceptId].family, x: 0, y: 0 });
const stringsSlot = (ids: string[]): SlotResult =>
  consolidatePath(ids.map((id, i) => wovenNode(id, i))) as SlotResult;

const criticalHighDie: SlotResult = {
  type: 'd20', result: 20, threshold: 'critical-high', interpretation: '',
  tags: ['critical-high'],
  themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
} as SlotResult;

const FOOL: SlotResult = {
  type: 'tarot', id: 'fool', name: 'The Fool', number: 0, orientation: 'upright',
  symbol: '0', meaningUpright: '', meaningReversed: '',
  tags: ['major-arcana', 'fool-archetype', 'reversible'],
  themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
} as SlotResult;

const reversibleCardA: SlotResult = {
  type: 'tarot', id: 'tower', name: 'The Tower', number: 16, orientation: 'upright',
  symbol: 'XVI', meaningUpright: '', meaningReversed: '',
  tags: ['major-arcana', 'reversible'],
  themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
} as SlotResult;

const reversibleCardB: SlotResult = {
  type: 'tarot', id: 'star', name: 'The Star', number: 17, orientation: 'upright',
  symbol: 'XVII', meaningUpright: '', meaningReversed: '',
  tags: ['major-arcana', 'reversible'],
  themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
} as SlotResult;

const criticalLowDie: SlotResult = {
  type: 'd20', result: 1, threshold: 'critical-low', interpretation: '',
  tags: ['critical-low'],
  themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
} as SlotResult;

const changingLinesHex: SlotResult = {
  type: 'iching', hexagramNumber: 1, name: 'Qian', symbol: '䷀', judgment: '',
  changingLines: [0, 2], tags: ['changing-lines'],
  themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
} as SlotResult;

export const DEBUG_SCENARIOS: DebugScenario[] = [
  { id: 'will-widen-pool', label: 'Will widens the pool', group: 'Affinity', forced: ['will-widen-pool'], isolate: true,
    setup: (s) => { atMethodSelect(s); set(s, { will: 75 }); } },
  { id: 'shadow-shroud', label: 'Shadow shrouds an option', group: 'Affinity', forced: ['shadow-shroud'], isolate: true,
    setup: (s) => { atMethodSelect(s); set(s, { shadow: 75 }); } },
  { id: 'fate-deal-swap', label: 'Fate swaps the deal', group: 'Affinity', forced: ['fate-deal-swap'], isolate: true,
    setup: (s) => { atTarot(s); set(s, { fate: 75 }); } },
  { id: 'chaos-second-result', label: 'Chaos second result', group: 'Affinity', forced: ['chaos-second-result'], isolate: true,
    setup: (s) => { atDice(s); set(s, { chaos: 90 }); } },
  { id: 'fool-reroll', label: "Fool's Reroll", group: 'Interaction', forced: ['fool-reroll'], isolate: true,
    setup: (s) => { atDice(s); s.slots = [FOOL]; } },
  { id: 'combo-widen-shroud', label: 'Combo: widen + shroud', group: 'Combination', forced: ['will-widen-pool', 'shadow-shroud'], isolate: true,
    setup: (s) => { atMethodSelect(s); set(s, { will: 75, shadow: 75 }); } },
  // ── Affinity ──
  { id: 'fate-thin-pool', label: 'Fate thins the pool', group: 'Affinity', forced: ['fate-thin-pool'], isolate: true,
    setup: (s) => { atMethodSelect(s); set(s, { fate: 75 }); } },
  { id: 'fate-auto-orient', label: 'Fate orients the card', group: 'Affinity', forced: ['fate-auto-orient'], isolate: true,
    setup: (s) => { atTarot(s); set(s, { fate: 75 }); } },
  { id: 'fate-hollow-reroll', label: 'Fate: hollow reroll', group: 'Affinity', forced: ['fate-hollow-reroll'], isolate: true,
    setup: (s) => { atDice(s); set(s, { fate: 90 }); } },
  { id: 'fate-force-method', label: 'Fate forces the method', group: 'Affinity', forced: ['fate-force-method'], isolate: true,
    setup: (s) => { atMethodSelect(s); set(s, { fate: 90 }); } },
  { id: 'light-advantage', label: 'Light grants advantage', group: 'Affinity', forced: ['light-advantage'], isolate: true,
    setup: (s) => { atDice(s); set(s, { light: 75 }); } },
  { id: 'shadow-disadvantage', label: 'Shadow imposes disadvantage', group: 'Affinity', forced: ['shadow-disadvantage'], isolate: true,
    setup: (s) => { atDice(s); set(s, { shadow: 75 }); } },
  { id: 'will-choice', label: 'Will: choose your roll', group: 'Affinity', forced: ['will-choice'], isolate: true,
    setup: (s) => { atDice(s); set(s, { will: 90 }); } },
  { id: 'will-offer-reroll', label: 'Will: offered a reroll', group: 'Affinity', forced: ['will-offer-reroll'], isolate: true,
    setup: (s) => { atDice(s); set(s, { will: 60 }); } },
  // ── Interaction ──
  { id: 'mirror', label: 'Mirror: two reversibles flip', group: 'Interaction', forced: ['mirror'], isolate: true,
    setup: (s) => { atTarot(s); s.slots = [reversibleCardA, reversibleCardB]; } },
  { id: 'critical-resonance', label: 'Critical resonance', group: 'Interaction', forced: ['critical-resonance'], isolate: true,
    setup: (s) => { atTarot(s); s.slots = [criticalLowDie]; } },
  { id: 'iching-happening-boost', label: 'I Ching boosts the happening', group: 'Interaction', forced: ['iching-happening-boost'], isolate: true,
    setup: (s) => { s.screen = 'happening'; s.slots = [changingLinesHex]; } },
  // ── Affinity (Task 13: new affinity responders) ──
  { id: 'chaos-wild-card', label: 'Chaos: wild card flips', group: 'Affinity', forced: ['chaos-wild-card'], isolate: true,
    setup: (s) => { atTarot(s); set(s, { chaos: 80 }); } },
  { id: 'order-anchor', label: 'Order: anchor the spread', group: 'Affinity', forced: ['order-anchor'], isolate: true,
    setup: (s) => { atTarot(s); set(s, { order: 80 }); } },
  { id: 'shadow-veil-position', label: 'Shadow: veil a card', group: 'Affinity', forced: ['shadow-veil-position'], isolate: true,
    setup: (s) => { atTarot(s); set(s, { shadow: 80 }); } },
  // ── Interaction (spread-internal) ──
  { id: 'suit-accord', label: 'Suit Accord', group: 'Interaction', forced: ['suit-accord'], isolate: true,
    setup: (s) => { atTarot(s); s.slots = [consolidateSpread([buildFace(DECK_BY_ID['cups-2'], 'upright'), buildFace(DECK_BY_ID['cups-5'], 'upright'), buildFace(DECK_BY_ID['cups-8'], 'upright')]) as SlotResult]; } },
  { id: 'elemental-clash', label: 'Elemental Clash', group: 'Interaction', forced: ['elemental-clash'], isolate: true,
    setup: (s) => { atTarot(s); s.slots = [consolidateSpread([buildFace(DECK_BY_ID['cups-2'], 'upright'), buildFace(DECK_BY_ID['swords-3'], 'upright'), buildFace(DECK_BY_ID['pentacles-4'], 'upright')]) as SlotResult]; } },
  { id: 'major-convergence', label: 'Major Convergence', group: 'Interaction', forced: ['major-convergence'], isolate: true,
    setup: (s) => { atTarot(s); s.slots = [consolidateSpread([buildFace(DECK_BY_ID['the-sun'], 'upright'), buildFace(DECK_BY_ID['the-star'], 'upright'), buildFace(DECK_BY_ID['cups-2'], 'upright')]) as SlotResult]; } },
  { id: 'spread-aligned', label: 'Spread Aligned (all upright)', group: 'Interaction', forced: ['spread-aligned'], isolate: true,
    setup: (s) => { atTarot(s); s.slots = [consolidateSpread([buildFace(DECK_BY_ID['the-sun'], 'upright'), buildFace(DECK_BY_ID['cups-2'], 'upright'), buildFace(DECK_BY_ID['pentacles-3'], 'upright')]) as SlotResult]; } },
  { id: 'spread-cascade', label: 'Spread Cascade (all reversed)', group: 'Interaction', forced: ['spread-cascade'], isolate: true,
    setup: (s) => { atTarot(s); s.slots = [consolidateSpread([buildFace(DECK_BY_ID['the-sun'], 'reversed'), buildFace(DECK_BY_ID['cups-2'], 'reversed'), buildFace(DECK_BY_ID['pentacles-3'], 'reversed')]) as SlotResult]; } },
  // ── Astral symbolic ──
  { id: 'astral-dignity', label: 'Astral: dignity (Mars in Aries)', group: 'Astral', forced: ['astral-dignity'], isolate: true,
    setup: (s) => { atAstral(s); s.slots = [consolidateCast({ planet: 'mars', sign: 'aries', planetHouse: 7, signHouse: 7, omens: [] }) as SlotResult]; } },
  { id: 'astral-debility', label: 'Astral: debility (Mars in Libra)', group: 'Astral', forced: ['astral-debility'], isolate: true,
    setup: (s) => { atAstral(s); s.slots = [consolidateCast({ planet: 'mars', sign: 'libra', planetHouse: 7, signHouse: 7, omens: [] }) as SlotResult]; } },
  { id: 'astral-great-trine', label: 'Astral: great trine (Venus, h1/h5)', group: 'Astral', forced: ['astral-great-trine'], isolate: true,
    setup: (s) => { atAstral(s); s.slots = [consolidateCast({ planet: 'venus', sign: 'taurus', planetHouse: 1, signHouse: 5, omens: [] }) as SlotResult]; } },
  { id: 'astral-duel', label: 'Astral: duel (Mars, h1/h7)', group: 'Astral', forced: ['astral-duel'], isolate: true,
    setup: (s) => { atAstral(s); s.slots = [consolidateCast({ planet: 'mars', sign: 'aries', planetHouse: 1, signHouse: 7, omens: [] }) as SlotResult]; } },
  { id: 'astral-saturns-gate', label: "Astral: Saturn's Gate (h10)", group: 'Astral', forced: ['astral-saturns-gate'], isolate: true,
    setup: (s) => { atAstral(s); s.slots = [consolidateCast({ planet: 'saturn', sign: 'capricorn', planetHouse: 10, signHouse: 10, omens: [] }) as SlotResult]; } },
  // ── Astral omens ──
  { id: 'astral-errant-star', label: 'Astral: errant star (spawns second)', group: 'Astral', forced: ['astral-errant-star'], isolate: true,
    setup: (s) => { atAstral(s); s.slots = [consolidateCast({ planet: 'mars', sign: 'aries', planetHouse: 5, signHouse: 5, omens: ['errant-star'] }) as SlotResult]; } },
  { id: 'astral-conjunction-crowned', label: 'Astral: conjunction crowned', group: 'Astral', forced: ['astral-conjunction-crowned'], isolate: true,
    setup: (s) => { atAstral(s); s.slots = [consolidateCast({ planet: 'sun', sign: 'leo', planetHouse: 5, signHouse: 5, omens: ['crowned-conjunction'] }) as SlotResult]; } },
  { id: 'astral-veiled-oracle', label: 'Astral: veiled oracle', group: 'Astral', forced: ['astral-veiled-oracle'], isolate: true,
    setup: (s) => { atAstral(s); s.slots = [consolidateCast({ planet: 'neptune', sign: 'pisces', planetHouse: 12, signHouse: 12, omens: ['veiled-oracle'] }) as SlotResult]; } },
  // ── I Ching affinity + interaction (Task 7) ──
  { id: 'chaos-line-cascade', label: 'Chaos: line cascade', group: 'Affinity', forced: ['chaos-line-cascade'], isolate: true,
    setup: (s) => { s.screen = 'minigame'; s.selectedMethod = 'iching'; set(s, { chaos: 90 }); } },
  { id: 'order-still-hexagram', label: 'Order: still hexagram', group: 'Affinity', forced: ['order-still-hexagram'], isolate: true,
    setup: (s) => { s.screen = 'minigame'; s.selectedMethod = 'iching'; set(s, { order: 90 }); } },
  { id: 'iching-resonant-change', label: 'I Ching: resonant change', group: 'Interaction', forced: ['iching-resonant-change'], isolate: true,
    setup: (s) => { s.screen = 'minigame'; s.selectedMethod = 'iching'; s.slots = [reversibleCardA]; } },
  // ── Rune scatter ──
  { id: 'rune-bindrune', label: 'Rune: bindrune', group: 'Rune', forced: ['rune-bindrune'], isolate: true,
    setup: (s) => { atRune(s); s.slots = [runeSlot('sowilo', ['bindrune'])]; } },
  { id: 'rune-merkstave-cascade', label: 'Rune: merkstave cascade', group: 'Rune', forced: ['rune-merkstave-cascade'], isolate: true,
    setup: (s) => { atRune(s); s.slots = [runeSlot('fehu', ['merkstave-cascade'])]; } },
  { id: 'rune-true-cast', label: 'Rune: true cast', group: 'Rune', forced: ['rune-true-cast'], isolate: true,
    setup: (s) => { atRune(s); s.slots = [runeSlot('tiwaz', ['true-cast'])]; } },
  { id: 'rune-silent-field', label: 'Rune: the silent field', group: 'Rune', forced: ['rune-silent-field'], isolate: true,
    setup: (s) => { atRune(s); s.slots = [runeSlot('mannaz', ['silent-field'])]; } },
  { id: 'rune-errant', label: 'Rune: the errant rune', group: 'Rune', forced: ['rune-errant'], isolate: true,
    setup: (s) => { atRune(s); s.slots = [runeSlot('fehu', ['errant-rune'])]; } },
  { id: 'rune-perthro', label: 'Rune: Perthro spills the cup', group: 'Rune', forced: ['rune-perthro'], isolate: true,
    setup: (s) => { atRune(s); s.slots = [runeSlot('perthro')]; } },
  { id: 'rune-hagalaz', label: 'Rune: Hagalaz the hailstone', group: 'Rune', forced: ['rune-hagalaz'], isolate: true,
    setup: (s) => { atRune(s); s.slots = [runeSlot('hagalaz', [], [runeStone('isa', true, 'upright', 'field')])]; } },
  { id: 'rune-isa', label: 'Rune: Isa the standstill', group: 'Rune', forced: ['rune-isa'], isolate: true,
    setup: (s) => { atRune(s); s.slots = [runeSlot('isa')]; } },
  { id: 'rune-tiwaz-victory', label: "Rune: Tiwaz's Victory", group: 'Rune', forced: ['rune-tiwaz-victory'], isolate: true,
    setup: (s) => { atRune(s); s.slots = [runeSlot('tiwaz'), criticalHighDie]; } },
  // ── Strings of Fate ──
  { id: 'chaos-stray-thread', label: 'Strings: Chaos strays the thread', group: 'Strings', forced: ['chaos-stray-thread'], isolate: true,
    setup: (s) => { atStrings(s); set(s, { chaos: 80 }); } },
  { id: 'fate-pull-thread', label: 'Strings: Fate pulls the thread', group: 'Strings', forced: ['fate-pull-thread'], isolate: true,
    setup: (s) => { atStrings(s); set(s, { fate: 90 }); } },
  { id: 'fate-foregone-step', label: 'Strings: Fate weaves a foregone step', group: 'Strings', forced: ['fate-foregone-step'], isolate: true,
    setup: (s) => { atStrings(s); set(s, { fate: 90 }); } },
  { id: 'order-true-weave', label: 'Strings: Order straightens the weave', group: 'Strings', forced: ['order-true-weave'], isolate: true,
    setup: (s) => { atStrings(s); set(s, { order: 80 }); s.slots = [stringsSlot(['the-self', 'the-fracture', 'the-turning'])]; } },
  { id: 'coherent-weave', label: 'Strings: Coherent Weave', group: 'Strings', forced: ['coherent-weave'], isolate: true,
    setup: (s) => { atStrings(s); s.slots = [stringsSlot(['a-rising-tide', 'the-blossom', 'the-dawn'])]; } },
  { id: 'tangled-weave', label: 'Strings: Tangled Weave', group: 'Strings', forced: ['tangled-weave'], isolate: true,
    setup: (s) => { atStrings(s); s.slots = [stringsSlot(['the-self', 'the-severance', 'the-parting'])]; } },
  { id: 'luminous-path', label: 'Strings: Luminous Path', group: 'Strings', forced: ['luminous-path'], isolate: true,
    setup: (s) => { atStrings(s); s.slots = [stringsSlot(['a-rising-tide', 'the-blossom', 'the-dawn'])]; } },
  { id: 'shrouded-path', label: 'Strings: Shrouded Path', group: 'Strings', forced: ['shrouded-path'], isolate: true,
    setup: (s) => { atStrings(s); s.slots = [stringsSlot(['the-undertow', 'the-fracture', 'the-long-night'])]; } },
  { id: 'woven-echo', label: 'Strings: Woven Echo', group: 'Strings', forced: ['woven-echo'], isolate: true,
    setup: (s) => { atStrings(s); s.slots = [stringsSlot(['the-self', 'a-rising-tide', 'the-dawn']), stringsSlot(['the-hearth', 'the-blossom', 'the-dawn'])]; } },
];

export function findScenario(id: string): DebugScenario | undefined {
  return DEBUG_SCENARIOS.find((s) => s.id === id);
}

export function freshStage(): ScenarioStage {
  return { affinities: defaultAffinityState(), screen: 'title', selectedMethod: null, slots: [] };
}
