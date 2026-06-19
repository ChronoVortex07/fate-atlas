import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../EventBus';

describe('EventBus', () => {
  it('emits an event and calls subscribed handler', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('turn-started', handler);
    bus.emit('turn-started', { question: 'decision' });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0];
    expect(event.type).toBe('turn-started');
    expect(event.data).toEqual({ question: 'decision' });
    expect(event.timestamp).toBeTypeOf('number');
  });

  it('records events in history', () => {
    const bus = new EventBus();
    bus.emit('slot-drawn', { index: 0 });
    bus.emit('slot-drawn', { index: 1 });

    const history = bus.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].data.index).toBe(0);
    expect(history[1].data.index).toBe(1);
  });

  it('returns unsubscribe function that stops handler', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    const unsubscribe = bus.on('affinity-changed', handler);
    bus.emit('affinity-changed', { chaos: 0.1 });
    unsubscribe();
    bus.emit('affinity-changed', { chaos: 0.2 });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not throw when emitting event with no subscribers', () => {
    const bus = new EventBus();
    expect(() => bus.emit('turn-complete', {})).not.toThrow();
  });

  it('clear() empties history', () => {
    const bus = new EventBus();
    bus.emit('turn-started', {});
    expect(bus.getHistory()).toHaveLength(1);
    bus.clear();
    expect(bus.getHistory()).toHaveLength(0);
  });
});
