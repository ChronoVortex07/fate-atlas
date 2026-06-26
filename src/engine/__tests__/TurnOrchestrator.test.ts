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
    expect(pool.every((t) => ['tarot', 'd20', 'iching', 'astral', 'rune'].includes(t))).toBe(true);
  });

  it('generatePool returns `count` methods when fewer are requested (Fate methodCount)', () => {
    const orchestrator = new TurnOrchestrator(bus);
    const pool = orchestrator.generatePool('self', affinities, 2);
    expect(pool.length).toBe(2);
  });

  it('generatePool widens up to the number of available methods (Will-widen)', () => {
    const orchestrator = new TurnOrchestrator(bus);
    const pool = orchestrator.generatePool('self', affinities, 5);
    expect(pool.length).toBe(5);
    expect(new Set(pool).size).toBe(5); // all distinct
  });

  it('generatePool clamps a request above the available methods to that many', () => {
    const orchestrator = new TurnOrchestrator(bus);
    const pool = orchestrator.generatePool('self', affinities, 99);
    expect(pool.length).toBe(5); // never more than POOL_TYPES.length
  });

  it('generatePool clamps below 1 up to a single method', () => {
    const orchestrator = new TurnOrchestrator(bus);
    expect(orchestrator.generatePool('self', affinities, 1).length).toBe(1);
    expect(orchestrator.generatePool('self', affinities, 0).length).toBe(1);
    expect(orchestrator.generatePool('self', affinities, -3).length).toBe(1);
  });

  it('generatePool terminates under a constant Math.random (no infinite loop)', () => {
    const orig = Math.random;
    Math.random = () => 0.5;
    try {
      const orchestrator = new TurnOrchestrator(bus);
      const pool = orchestrator.generatePool('self', affinities);
      expect(pool.length).toBe(3);
      expect(new Set(pool).size).toBe(3); // distinct
    } finally {
      Math.random = orig;
    }
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

  it('refillPool with bias does not throw and returns valid pool', () => {
    const orchestrator = new TurnOrchestrator(bus);
    orchestrator.generatePool('decision', affinities);
    // refillPool with strong bias
    const pool = orchestrator.refillPool('decision', affinities, {
      tarot: 3,
      d20: -1,
      iching: 0,
    });
    expect(pool.length).toBeGreaterThanOrEqual(3);
    expect(pool.every((t) => ['tarot', 'd20', 'iching', 'astral', 'rune'].includes(t))).toBe(true);
  });

  it('refillPool with no bias uses base weights', () => {
    const orchestrator = new TurnOrchestrator(bus);
    orchestrator.generatePool('decision', affinities);
    orchestrator.removeUsedMethod('tarot');
    const pool = orchestrator.refillPool('decision', affinities);
    expect(pool.length).toBe(3);
  });

  it('throws for happening method in drawSingleResult', () => {
    const orchestrator = new TurnOrchestrator(bus);
    expect(() => orchestrator.drawSingleResult('happening', affinities)).toThrow(
      'Happening has no drawSingleResult',
    );
  });
});
