import type { DivinationType, QuestionType, SlotResult } from './types';
import type { EventBus } from './EventBus';
import { drawTarotCard } from '../data/tarot';
import { rollD20 } from '../data/dice';
import { castHexagram } from '../data/iching';

const POOL_SIZE = 3;

const QUESTION_WEIGHTS: Record<QuestionType, Partial<Record<DivinationType, number>>> = {
  decision: { d20: 3, tarot: 1, iching: 1, happening: 1 },
  relationship: { tarot: 3, d20: 1, iching: 1, happening: 1 },
  future: { iching: 3, tarot: 1, d20: 1, happening: 1 },
  self: { tarot: 2, iching: 2, d20: 1, happening: 1 },
};

export class TurnOrchestrator {
  private availableMethods: DivinationType[] = [];

  constructor(
    private bus: EventBus,
  ) {}

  generatePool(
    question: QuestionType,
    affinities: Record<string, number>,
  ): DivinationType[] {
    this.availableMethods = [];
    const weights = QUESTION_WEIGHTS[question];

    const entries: { type: DivinationType; weight: number }[] = [
      { type: 'tarot', weight: weights.tarot ?? 1 },
      { type: 'd20', weight: weights.d20 ?? 1 },
      { type: 'iching', weight: weights.iching ?? 1 },
      { type: 'happening', weight: weights.happening ?? 1 },
    ];

    // High chaos can add extra happening to pool
    if ((affinities.chaos ?? 0) >= 0.5 && Math.random() < 0.3) {
      entries.find((e) => e.type === 'happening')!.weight += 2;
    }

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
}
