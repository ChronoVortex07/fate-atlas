import type { DivinationType, QuestionType, SlotResult } from './types';
import type { EventBus } from './EventBus';
import { drawTarotCard } from '../data/tarot';
import { rollD20 } from '../data/dice';
import { castHexagram } from '../data/iching';

const POOL_SIZE = 3;

const QUESTION_WEIGHTS: Record<QuestionType, Partial<Record<DivinationType, number>>> = {
  decision: { d20: 3, tarot: 1, iching: 1 },
  relationship: { tarot: 3, d20: 1, iching: 1 },
  future: { iching: 3, tarot: 1, d20: 1 },
  self: { tarot: 2, iching: 2, d20: 1 },
};

export class TurnOrchestrator {
  private availableMethods: DivinationType[] = [];

  constructor(
    private bus: EventBus,
  ) {}

  generatePool(
    question: QuestionType,
    _affinities: Record<string, number>,
  ): DivinationType[] {
    this.availableMethods = [];
    this.usedThisTurn = [];
    const weights = QUESTION_WEIGHTS[question];

    const entries: { type: DivinationType; weight: number }[] = [
      { type: 'tarot', weight: weights.tarot ?? 1 },
      { type: 'd20', weight: weights.d20 ?? 1 },
      { type: 'iching', weight: weights.iching ?? 1 },
    ];

    while (this.availableMethods.length < POOL_SIZE) {
      const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
      let roll = Math.random() * totalWeight;
      for (const entry of entries) {
        roll -= entry.weight;
        if (roll <= 0) {
          // Avoid duplicate methods in the pool
          if (!this.availableMethods.includes(entry.type)) {
            this.availableMethods.push(entry.type);
          }
          break;
        }
      }
    }

    this.bus.emit('pool-generated', {
      question,
      pool: [...this.availableMethods],
    });

    return [...this.availableMethods];
  }

  drawSingleResult(
    method: DivinationType,
    affinities: Record<string, number>,
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

  removeUsedMethod(method: 'tarot' | 'd20' | 'iching'): void {
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
  ): DivinationType[] {
    // Keep remaining methods, draw new ones to fill back to POOL_SIZE
    const baseWeights = QUESTION_WEIGHTS[question];

    const entries: { type: DivinationType; weight: number }[] = [
      { type: 'tarot', weight: (baseWeights.tarot ?? 1) + (bias.tarot ?? 0) },
      { type: 'd20', weight: (baseWeights.d20 ?? 1) + (bias.d20 ?? 0) },
      { type: 'iching', weight: (baseWeights.iching ?? 1) + (bias.iching ?? 0) },
    ];

    // Clamp individual weights to minimum 0 (never negative probability)
    for (const entry of entries) {
      entry.weight = Math.max(0, entry.weight);
    }

    while (this.availableMethods.length < POOL_SIZE) {
      const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
      // If all weights are 0 (shouldn't happen with clamping), fall back to uniform
      if (totalWeight <= 0) {
        const remaining = ['tarot', 'd20', 'iching'].filter(
          (t) => !this.availableMethods.includes(t as DivinationType),
        );
        if (remaining.length > 0) {
          this.availableMethods.push(remaining[0] as DivinationType);
        }
        continue;
      }
      let roll = Math.random() * totalWeight;
      for (const entry of entries) {
        roll -= entry.weight;
        if (roll <= 0) {
          if (!this.availableMethods.includes(entry.type)) {
            this.availableMethods.push(entry.type);
          }
          break;
        }
      }
    }

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
