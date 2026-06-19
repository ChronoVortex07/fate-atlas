import type { RunRecord } from '../engine/types';

export const STORAGE_KEYS = {
  affinities: 'fate-atlas:affinities',
  runHistory: 'fate-atlas:run-history',
  settings: 'fate-atlas:settings',
} as const;

export function saveAffinities(json: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.affinities, json);
  } catch {
    // localStorage may be full or unavailable
  }
}

export function loadAffinities(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.affinities);
  } catch {
    return null;
  }
}

export function saveRunHistory(runs: RunRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.runHistory, JSON.stringify(runs));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function loadRunHistory(): RunRecord[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.runHistory);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as RunRecord[];
  } catch {
    return null;
  }
}

export function saveSettings(settings: { debugMode: boolean; animationsEnabled: boolean }): void {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function loadSettings(): { debugMode: boolean; animationsEnabled: boolean } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (raw === null) return null;
    return JSON.parse(raw) as { debugMode: boolean; animationsEnabled: boolean };
  } catch {
    return null;
  }
}
