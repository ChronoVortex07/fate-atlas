import { describe, it, expect } from 'vitest';
import { TurnOrchestrator } from '../TurnOrchestrator';
import { TagSystem } from '../TagSystem';
import { EventBus } from '../EventBus';

describe('TurnOrchestrator', () => {
  const tagSystem = new TagSystem();
  const bus = new EventBus();
  const affinities = { chaos: 0.5, order: 0.5 };

  it('generates a pool of 3+ divination types', () => {
    const orchestrator = new TurnOrchestrator(tagSystem, bus);
    const pool = orchestrator.generatePool('decision', affinities);
    expect(pool.length).toBeGreaterThanOrEqual(3);
    expect(pool.every((t) => ['tarot', 'd20', 'iching', 'happening'].includes(t))).toBe(true);
  });

  it('decision question favors d20', () => {
    let d20Count = 0;
    for (let i = 0; i < 100; i++) {
      const orchestrator = new TurnOrchestrator(tagSystem, bus);
      const pool = orchestrator.generatePool('decision', affinities);
      if (pool.includes('d20')) d20Count++;
    }
    expect(d20Count).toBeGreaterThan(50); // d20 should appear most of the time
  });

  it('draws 3 slots from the pool', () => {
    const orchestrator = new TurnOrchestrator(tagSystem, bus);
    orchestrator.generatePool('self', affinities);
    for (let i = 0; i < 3; i++) {
      orchestrator.drawSlot(i, affinities);
    }
    const slots = orchestrator.getSlots();
    expect(slots).toHaveLength(3);
    expect(slots.every((s) => s !== null)).toBe(true);
  });

  it('revealSlot marks a slot as revealed', () => {
    const orchestrator = new TurnOrchestrator(tagSystem, bus);
    orchestrator.generatePool('self', affinities);
    orchestrator.drawSlot(0, affinities);
    orchestrator.revealSlot(0);
    // Reveal should have emitted a slot-revealed event
    const history = bus.getHistory();
    const revealEvents = history.filter((e) => e.type === 'slot-revealed');
    expect(revealEvents.length).toBe(1);
  });

  it('throws if drawing beyond pool size', () => {
    const orchestrator = new TurnOrchestrator(tagSystem, bus);
    orchestrator.generatePool('self', affinities);
    expect(() => orchestrator.drawSlot(5, affinities)).toThrow();
  });
});
