import type { AffinityId, Taggable } from './types';
import type { AffinityDefinition } from '../data/affinities';

const DEFAULT_VALUE = 0.5;
const CHANGE_PER_MATCH = 0.05;

export class AffinityEngine {
  private state: Record<string, number> = {};
  private definitions: AffinityDefinition[];

  constructor(definitions: AffinityDefinition[]) {
    this.definitions = definitions;
    for (const def of definitions) {
      this.state[def.id] = DEFAULT_VALUE;
    }
  }

  apply(results: Taggable[]): void {
    for (const def of this.definitions) {
      let delta = 0;
      for (const result of results) {
        const matches = def.accumulateFrom.filter((tag) => result.tags.includes(tag)).length;
        delta += matches * CHANGE_PER_MATCH;
      }
      this.state[def.id] = this.clamp(this.state[def.id] + delta);
    }
  }

  isDominant(id: AffinityId): boolean {
    const def = this.definitions.find((d) => d.id === id);
    if (!def) return false;
    return this.state[id] >= def.dominantThreshold;
  }

  getHint(id: AffinityId): string | null {
    if (!this.isDominant(id)) return null;
    const def = this.definitions.find((d) => d.id === id);
    if (!def || !def.dominantHints.length) return null;
    return def.dominantHints[Math.floor(Math.random() * def.dominantHints.length)];
  }

  getState(): Record<AffinityId, number> {
    return { ...this.state } as Record<AffinityId, number>;
  }

  setState(values: Record<AffinityId, number>): void {
    for (const [id, val] of Object.entries(values)) {
      this.state[id] = this.clamp(val);
    }
  }

  serialize(): string {
    return JSON.stringify(this.state);
  }

  loadFrom(json: string): void {
    const parsed = JSON.parse(json);
    for (const [id, val] of Object.entries(parsed)) {
      if (typeof val === 'number') {
        this.state[id] = this.clamp(val);
      }
    }
  }

  private clamp(value: number): number {
    return Math.max(0.0, Math.min(1.0, Math.round(value * 100) / 100));
  }
}
