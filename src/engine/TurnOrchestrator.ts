import type { DivinationType, QuestionType, SlotResult } from './types';
import type { EventBus } from './EventBus';
import { drawTarotCard } from '../data/tarot';
import { rollD20 } from '../data/dice';
import { castHexagram } from '../data/iching';
import { consolidateCast, drawAstralCast } from '../data/astromancy';
import { consolidateScatter, drawRuneScatter } from '../data/runes';
import { drawWeave } from './strings';

// Every divination type that has a playable minigame — the single source of
// truth for what can be dealt. Adding a new minigame here (and its GameTable
// route) automatically raises the pool ceiling.
const POOL_TYPES: DivinationType[] = ['tarot', 'd20', 'iching', 'astral', 'rune', 'strings'];

// Default pool size. Draw-phase effects widen/thin from here: Will can widen up
// to the number of available minigames (POOL_TYPES.length), Fate can thin down
// to POOL_MIN. POOL_DEFAULT is the baseline, NOT the ceiling — those are
// separate so a widen above the default is honoured rather than clamped away.
const POOL_DEFAULT = 3;
const POOL_MIN = 1;
const poolMax = () => POOL_TYPES.length;

const QUESTION_WEIGHTS: Record<QuestionType, Partial<Record<DivinationType, number>>> = {
  decision: { d20: 3, tarot: 1, iching: 1, astral: 2, rune: 1, strings: 1 },
  relationship: { tarot: 3, d20: 1, iching: 1, astral: 1, rune: 1, strings: 3 },
  future: { iching: 3, tarot: 1, d20: 1, astral: 2, rune: 2, strings: 2 },
  self: { tarot: 2, iching: 2, d20: 1, astral: 1, rune: 2, strings: 2 },
};

export class TurnOrchestrator {
  private availableMethods: DivinationType[] = [];

  constructor(
    private bus: EventBus,
  ) {}

  // Weighted pick among the types NOT already in the pool, so every iteration
  // adds exactly one. This guarantees termination (≤3 passes) even when
  // Math.random is stubbed to a constant — the old "pick-then-dedupe" loop could
  // spin forever under deterministic RNG when the pick was always a duplicate.
  private fillPool(target: number, weightOf: (t: DivinationType) => number): void {
    while (this.availableMethods.length < target) {
      const remaining = POOL_TYPES.filter((t) => !this.availableMethods.includes(t));
      if (remaining.length === 0) break;
      const weights = remaining.map((t) => Math.max(0, weightOf(t)));
      const total = weights.reduce((s, w) => s + w, 0);
      if (total <= 0) {
        this.availableMethods.push(remaining[0]);
        continue;
      }
      let roll = Math.random() * total;
      let picked = remaining[remaining.length - 1];
      for (let i = 0; i < remaining.length; i++) {
        roll -= weights[i];
        if (roll <= 0) { picked = remaining[i]; break; }
      }
      this.availableMethods.push(picked);
    }
  }

  generatePool(
    question: QuestionType,
    _affinities: Record<string, number>,
    count: number = POOL_DEFAULT,
  ): DivinationType[] {
    this.availableMethods = [];
    this.usedThisTurn = [];
    const target = Math.max(POOL_MIN, Math.min(poolMax(), count));
    const weights = QUESTION_WEIGHTS[question];

    this.fillPool(target, (t) => weights[t] ?? 1);

    this.bus.emit('pool-generated', {
      question,
      pool: [...this.availableMethods],
    });

    return [...this.availableMethods];
  }

  drawSingleResult(
    method: DivinationType,
    affinities: Record<string, number>,
    question?: QuestionType,
  ): SlotResult {
    let result: SlotResult;

    switch (method) {
      case 'tarot':
        result = drawTarotCard(affinities);
        break;
      case 'd20':
        result = rollD20(affinities);
        break;
      case 'iching':
        result = castHexagram(affinities);
        break;
      case 'astral':
        result = consolidateCast(drawAstralCast(affinities));
        break;
      case 'rune':
        result = consolidateScatter(drawRuneScatter(affinities));
        break;
      case 'strings':
        result = drawWeave(affinities, Math.random, question);
        break;
      case 'happening':
        throw new Error('Happening has no drawSingleResult — use triggerHappening instead');
      default:
        throw new Error(`Unknown divination type: ${method}`);
    }

    this.bus.emit('slot-drawn', { type: method, result });
    return result;
  }

  getAvailableMethods(): DivinationType[] {
    return [...this.availableMethods];
  }

  private usedThisTurn: DivinationType[] = [];

  removeUsedMethod(method: 'tarot' | 'd20' | 'iching' | 'astral' | 'rune' | 'strings'): void {
    this.usedThisTurn.push(method);
    // Remove the used method from availableMethods (it'll be refilled)
    const idx = this.availableMethods.indexOf(method);
    if (idx !== -1) {
      this.availableMethods.splice(idx, 1);
    }
  }

  refillPool(
    question: QuestionType,
    _affinities: Record<string, number>,
    bias: Partial<Record<DivinationType, number>> = {},
    count: number = POOL_DEFAULT,
  ): DivinationType[] {
    // Keep remaining methods, draw new ones to fill back up to `target`.
    const baseWeights = QUESTION_WEIGHTS[question];
    const target = Math.max(POOL_MIN, Math.min(poolMax(), count));

    this.fillPool(target, (t) => (baseWeights[t] ?? 1) + (bias[t] ?? 0));

    this.bus.emit('pool-refilled', {
      question,
      pool: [...this.availableMethods],
    });

    return [...this.availableMethods];
  }

  resetTurn(): void {
    this.usedThisTurn = [];
    this.availableMethods = [];
  }
}
