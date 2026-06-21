import type { AffinityId, SlotResult } from '../types';
import { defaultAffinityState } from '../../data/affinities';

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
const set = (s: ScenarioStage, a: Partial<Record<AffinityId, number>>) => Object.assign(s.affinities, a);

const FOOL: SlotResult = {
  type: 'tarot', id: 'fool', name: 'The Fool', number: 0, orientation: 'upright',
  symbol: '0', meaningUpright: '', meaningReversed: '',
  tags: ['major-arcana', 'fool-archetype', 'reversible'],
  themes: [], dimensions: { favorability: 0, certainty: 0, volatility: 0 }, modifierRoles: [],
} as SlotResult;

export const DEBUG_SCENARIOS: DebugScenario[] = [
  { id: 'will-widen-pool', label: 'Will widens the pool', group: 'Affinity', forced: ['will-widen-pool'], isolate: true,
    setup: (s) => { atMethodSelect(s); set(s, { will: 75 }); } },
  { id: 'shadow-shroud', label: 'Shadow shrouds an option', group: 'Affinity', forced: ['shadow-shroud'], isolate: true,
    setup: (s) => { atMethodSelect(s); set(s, { shadow: 75 }); } },
  { id: 'fate-override-pick', label: 'Fate overrides the pick', group: 'Affinity', forced: ['fate-override-pick'], isolate: true,
    setup: (s) => { atTarot(s); set(s, { fate: 75 }); } },
  { id: 'chaos-second-result', label: 'Chaos second result', group: 'Affinity', forced: ['chaos-second-result'], isolate: true,
    setup: (s) => { atDice(s); set(s, { chaos: 90 }); } },
  { id: 'fool-reroll', label: "Fool's Reroll", group: 'Interaction', forced: ['fool-reroll'], isolate: true,
    setup: (s) => { atDice(s); s.slots = [FOOL]; } },
  { id: 'combo-widen-shroud', label: 'Combo: widen + shroud', group: 'Combination', forced: ['will-widen-pool', 'shadow-shroud'], isolate: true,
    setup: (s) => { atMethodSelect(s); set(s, { will: 75, shadow: 75 }); } },
];

export function findScenario(id: string): DebugScenario | undefined {
  return DEBUG_SCENARIOS.find((s) => s.id === id);
}

export function freshStage(): ScenarioStage {
  return { affinities: defaultAffinityState(), screen: 'title', selectedMethod: null, slots: [] };
}
