import type { DivinationType, QuestionType, SlotResult } from './types';
import type { TagSystem } from './TagSystem';
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
  private pool: DivinationType[] = [];
  private slots: (SlotResult | null)[] = [];

  constructor(
    private tagSystem: TagSystem,
    private bus: EventBus,
  ) {}

  generatePool(
    question: QuestionType,
    affinities: Record<string, number>,
  ): DivinationType[] {
    this.pool = [];
    this.slots = [];
    const weights = QUESTION_WEIGHTS[question];

    // Build weighted list
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

    while (this.pool.length < POOL_SIZE) {
      const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
      let roll = Math.random() * totalWeight;
      for (const entry of entries) {
        roll -= entry.weight;
        if (roll <= 0) {
          this.pool.push(entry.type);
          break;
        }
      }
    }

    this.bus.emit('pool-generated', {
      question,
      pool: [...this.pool],
    });

    return [...this.pool];
  }

  drawSlot(index: number, affinities: Record<string, number>): SlotResult {
    if (index >= this.pool.length) {
      throw new Error(`Slot ${index} out of bounds (pool size ${this.pool.length})`);
    }
    const type = this.pool[index];
    let result: SlotResult;

    switch (type) {
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
        // Happenings are drawn during the happenings phase, not during draw phase
        // Return null-like placeholder that gets resolved later
        result = {
          type: 'happening',
          id: 'pending',
          scene: '',
          choices: [],
          tags: ['event', 'pending', 'happening', 'choice', 'affinity-shift'],
        } as SlotResult; // Will be replaced during happening phase
        break;
      default:
        throw new Error(`Unknown divination type: ${type}`);
    }

    this.slots[index] = result;
    this.bus.emit('slot-drawn', { index, type: result.type });

    return result;
  }

  revealSlot(index: number): SlotResult {
    const result = this.slots[index];
    if (!result) {
      throw new Error(`Slot ${index} not yet drawn`);
    }
    this.bus.emit('slot-revealed', {
      index,
      type: result.type,
      tags: (result as { tags?: string[] }).tags ?? [],
      result,
    });
    return result;
  }

  getSlots(): (SlotResult | null)[] {
    return [...this.slots];
  }

  getPool(): DivinationType[] {
    return [...this.pool];
  }
}
