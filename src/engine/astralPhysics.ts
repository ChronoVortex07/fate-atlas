// Pure mapping from affinities to 3D physics tuning for the astral cast.
// The dice are contained by real collision walls (see the scene), so tuning is
// purely about how they *throw and settle* — no artificial centering, turbulence,
// or drift. Order calms the settle; Chaos makes them livelier and longer-spinning.

export interface CastTuning {
  restitution: number;     // bounciness of dice (and against the walls)
  scatter: number;         // spread of the initial throw velocity
  linearDamping: number;   // cannon-es body linearDamping
  angularDamping: number;  // cannon-es body angularDamping
}

const norm = (v: number | undefined) => (v ?? 50) / 100; // 0..1, default neutral 0.5

export function castTuning(affinities: Record<string, number>): CastTuning {
  const order = norm(affinities.order);
  const chaos = norm(affinities.chaos);

  return {
    restitution: 0.2 + chaos * 0.45,        // 0.20..0.65 (chaos = bouncier)
    scatter: 0.6 + chaos * 1.6,             // 0.6..2.2  (chaos = wider throw)
    linearDamping: 0.16 + order * 0.24,     // 0.16..0.40 (order = calmer)
    angularDamping: 0.30 - chaos * 0.20,    // 0.30..0.10 (chaos = spins longer)
  };
}
