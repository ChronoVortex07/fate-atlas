// Pure, framework-free fan-out geometry for the tarot table spread.
// Coordinates are in the table container's local px space.

export interface FanLayoutParams {
  count: number;          // number of visible cards
  containerWidth: number; // table width in px
  cardWidth: number;      // single card face width in px
  restStep: number;       // center-to-center spacing at rest (overlapped, < cardWidth)
  radius: number;         // Gaussian proximity falloff in px
}

/** Rest layout: `count` cards spaced by `restStep`, centered in the container. */
export function restCenters(
  { count, containerWidth, restStep }: { count: number; containerWidth: number; restStep: number },
): number[] {
  const mid = (count - 1) / 2;
  const c = containerWidth / 2;
  return Array.from({ length: count }, (_, k) => c + (k - mid) * restStep);
}

/**
 * Gap-expansion fan-out: gaps near the cursor widen toward `cardWidth` (max
 * expansion), while gaps far from the cursor stay at `restStep` — faraway cards
 * are not compressed and extremal cards remain unperturbed. The card nearest
 * the cursor keeps its rest center (R1). No global envelope clamping so the
 * cluster never chases the cursor.
 */
export function computeFanLayout(cursorX: number, active: boolean, p: FanLayoutParams): number[] {
  const { count, containerWidth, cardWidth, restStep, radius } = p;
  const rest = restCenters({ count, containerWidth, restStep });
  if (!active || count <= 1) return rest;

  // Per-gap step: near cursor → cardWidth (fan open); far → restStep (at rest).
  const step: number[] = [];
  for (let i = 0; i < count - 1; i++) {
    const mid = (rest[i] + rest[i + 1]) / 2;
    const u = (mid - cursorX) / radius;
    const w = Math.exp(-3 * u * u);                   // 1 at cursor, → 0 far away
    step.push(restStep + (cardWidth - restStep) * w); // near → cardWidth, far → restStep
  }

  // Anchor the card nearest the cursor at its rest center.
  let a = 0;
  let best = Infinity;
  for (let k = 0; k < count; k++) {
    const d = Math.abs(rest[k] - cursorX);
    if (d < best) { best = d; a = k; }
  }
  const pos = new Array<number>(count);
  pos[a] = rest[a];
  for (let k = a + 1; k < count; k++) pos[k] = pos[k - 1] + step[k - 1];
  for (let k = a - 1; k >= 0; k--) pos[k] = pos[k + 1] - step[k];

  return pos;
}
