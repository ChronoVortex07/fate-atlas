// Pure mapping from affinities to 3D physics tuning for the astral cast.
// Centering is deliberately gentle so dice spread across slices (the vortex fix).

export interface CastTuning {
  centering: number;       // radial pull toward board center (world units/s², small)
  restitution: number;     // bounciness of dice
  scatter: number;         // spread of the initial throw velocity
  linearDamping: number;   // cannon-es body linearDamping
  angularDamping: number;  // cannon-es body angularDamping
  lateralBias: number;     // x-axis gravity nudge from light vs shadow
  turbulence: number;      // magnitude of in-flight random impulses
}

const norm = (v: number | undefined) => (v ?? 50) / 100; // 0..1, default neutral 0.5

export function castTuning(affinities: Record<string, number>): CastTuning {
  const order = norm(affinities.order);
  const chaos = norm(affinities.chaos);
  const light = norm(affinities.light);
  const shadow = norm(affinities.shadow);

  return {
    // Gentle: 0.3..0.9 — far weaker than the old constant per-tick pull.
    centering: 0.3 + order * 0.6,
    restitution: 0.25 + chaos * 0.4,        // 0.25..0.65
    scatter: 0.6 + chaos * 1.6,             // 0.6..2.2 (throw velocity spread)
    linearDamping: 0.18 + order * 0.22,     // 0.18..0.40 (order = calmer)
    angularDamping: 0.32 - chaos * 0.18,    // 0.32..0.14 (chaos = spins longer)
    lateralBias: (light - shadow) * 1.2,    // ±0.6 gravity nudge on x
    turbulence: chaos * 1.5,                 // 0..1.5
  };
}
