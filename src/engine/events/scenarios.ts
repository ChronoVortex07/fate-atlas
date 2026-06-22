import type { AffinityId, SlotResult } from '../types';
import { defaultAffinityState } from '../../data/affinities';
import { consolidateSpread, buildFace, DECK_BY_ID } from '../../data/tarot';
import { consolidateCast } from '../../data/astromancy';

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
const set = (s: ScenarioStage, a: Partial<Record<AffinityId, number>>) => Object.assign(s.affinities, a);

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
  { id: 'chaos-happening-interrupt', label: 'Chaos interrupts with a happening', group: 'Affinity', forced: ['chaos-happening-interrupt'], isolate: true,
    setup: (s) => { atDice(s); set(s, { chaos: 75 }); } },
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
];

export function findScenario(id: string): DebugScenario | undefined {
  return DEBUG_SCENARIOS.find((s) => s.id === id);
}

export function freshStage(): ScenarioStage {
  return { affinities: defaultAffinityState(), screen: 'title', selectedMethod: null, slots: [] };
}
