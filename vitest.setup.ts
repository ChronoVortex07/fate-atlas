const storage = new Map<string, string>();

(globalThis as Record<string, unknown>).localStorage = {
  getItem: (key: string): string | null => storage.get(key) ?? null,
  setItem: (key: string, value: string): void => {
    storage.set(key, value);
  },
  removeItem: (key: string): void => {
    storage.delete(key);
  },
  clear: (): void => {
    storage.clear();
  },
  get length(): number {
    return storage.size;
  },
  key: (index: number): string | null => {
    const keys = Array.from(storage.keys());
    return keys[index] ?? null;
  },
};
