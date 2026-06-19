import type { GameEvent, EventType } from './types';

type EventHandler = (event: GameEvent) => void;

export class EventBus {
  private handlers = new Map<EventType, Set<EventHandler>>();
  private history: GameEvent[] = [];

  emit(type: EventType, data: Record<string, unknown>): void {
    const event: GameEvent = {
      type,
      timestamp: Date.now(),
      data,
    };
    this.history.push(event);
    const subs = this.handlers.get(type);
    if (subs) {
      subs.forEach((fn) => fn(event));
    }
  }

  on(type: EventType, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  getHistory(): GameEvent[] {
    return [...this.history];
  }

  clear(): void {
    this.history = [];
  }
}
