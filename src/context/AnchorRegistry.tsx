import { createContext, useContext, useRef, useCallback, type ReactNode } from 'react';

// Stable keys for the targets effects can anchor onto.
export const outcomeKey = 'outcome';
export const constellationKey = (i: number) => `constellation:${i}`;

interface AnchorApi {
  register: (key: string) => (el: HTMLElement | null) => void;
  resolve: (key: string) => DOMRect | null;
}

const Ctx = createContext<AnchorApi | null>(null);

/**
 * Lets any screen register its affectable cards by a stable key, so the
 * InteractionSequencer can resolve a live viewport rect for the card an effect
 * targets and play the animation ON it (instead of in screen-center). This is
 * the generalization of FateForceOverlay's hand-measured `getBoundingClientRect`
 * into shared infrastructure. An unregistered/unmounted key resolves to `null`,
 * which the sequencer treats as "play centered" — never a crash or blank.
 */
export function AnchorProvider({ children }: { children: ReactNode }) {
  const map = useRef(new Map<string, HTMLElement>());
  // One stable ref callback per key, memoised so attaching a ref never churns.
  const cbs = useRef(new Map<string, (el: HTMLElement | null) => void>());

  const register = useCallback((key: string) => {
    let cb = cbs.current.get(key);
    if (!cb) {
      cb = (el: HTMLElement | null) => {
        if (el) map.current.set(key, el);
        else map.current.delete(key);
      };
      cbs.current.set(key, cb);
    }
    return cb;
  }, []);

  const resolve = useCallback(
    (key: string): DOMRect | null => map.current.get(key)?.getBoundingClientRect() ?? null,
    [],
  );

  return <Ctx.Provider value={{ register, resolve }}>{children}</Ctx.Provider>;
}

const NOOP_API: AnchorApi = { register: () => () => {}, resolve: () => null };

/** Returns a ref callback the target node attaches to register `key`. */
export function useAnchorRegister(key: string): (el: HTMLElement | null) => void {
  const api = useContext(Ctx);
  return (api ?? NOOP_API).register(key);
}

/** Returns `{ resolve }` for measuring a registered anchor's live rect. */
export function useAnchorResolver(): AnchorApi {
  return useContext(Ctx) ?? NOOP_API;
}
