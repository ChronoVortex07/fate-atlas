import { describe, it, expect, beforeEach } from 'vitest';
import { TurnOrchestrator } from '../TurnOrchestrator';
import { EventBus } from '../EventBus';

describe('TurnOrchestrator', () => {
  let bus: EventBus;
  const affinities = { chaos: 0.5, order: 0.5 };

  beforeEach(() => {
    bus = new EventBus();
  });

  it('generates a pool of 3+ divination types', () => {
    const orchestrator = new TurnOrchestrator(bus);
    const pool = orchestrator.generatePool('decision', affinities);
    expect(pool.length).toBeGreaterThanOrEqual(3);
    expect(pool.every((t) => ['tarot', 'd20', 'iching', 'happening'].includes(t))).toBe(true);
  });

  it('decision question favors d20', () => {
    let d20Count = 0;
    for (let i = 0; i < 100; i++) {
      const orchestrator = new TurnOrchestrator(bus);
      const pool = orchestrator.generatePool('decision', affinities);
      if (pool.includes('d20')) d20Count++;
    }
    expect(d20Count).toBeGreaterThan(50); // d20 should appear most of the time
  });

  it('draws a result for each available method', () => {
    const orchestrator = new TurnOrchestrator(bus);
    orchestrator.generatePool('self', affinities);
    const methods = orchestrator.getAvailableMethods().filter((m) => m !== 'happening');
    expect(methods.length).toBeGreaterThanOrEqual(1);
    for (const method of methods) {
      const result = orchestrator.drawSingleResult(method, affinities);
      expect(result).not.toBeNull();
      expect(result.type).toBe(method);
    }
  });

  it('drawSingleResult emits slot-drawn event', () => {
    const orchestrator = new TurnOrchestrator(bus);
    orchestrator.generatePool('self', affinities);
    const method = orchestrator.getAvailableMethods().find((m) => m !== 'happening')!;
    orchestrator.drawSingleResult(method, affinities);
    const history = bus.getHistory();
    const drawnEvents = history.filter((e) => e.type === 'slot-drawn');
    expect(drawnEvents.length).toBe(1);
  });

  it('throws for happening method in drawSingleResult', () => {
    const orchestrator = new TurnOrchestrator(bus);
    expect(() => orchestrator.drawSingleResult('happening', affinities)).toThrow(
      'Happening has no drawSingleResult',
    );
  });
});
