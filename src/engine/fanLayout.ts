// Pure, framework-free fan-out geometry for the tarot table spread.
// Coordinates are in the table container's local px space.

export interface FanLayoutParams {
  count: number;          // number of visible cards
  containerWidth: number; // table width in px
  cardWidth: number;      // single card face width in px
  restStep: number;       // center-to-center spacing at rest (overlapped, < cardWidth)
  minStep: number;        // deepest compression center-to-center (< restStep)
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
 * Returns each card's center x. Near the cursor, gaps open toward `cardWidth`
 * (side-by-side = max repulsion, R2); far from it they compress toward `minStep`
 * (R4). The card nearest the cursor keeps its rest center (R1). The whole spread
 * is clamped so its ends never pass the fixed envelope `count * cardWidth`,
 * centered (R3).
 */
export function computeFanLayout(cursorX: number, active: boolean, p: FanLayoutParams): number[] {
  const { count, containerWidth, cardWidth, restStep, minStep, radius } = p;
  const rest = restCenters({ count, containerWidth, restStep });
  if (!active || count <= 1) return rest;

  // Per-gap step from the gap midpoint's proximity to the cursor.
  const step: number[] = [];
  for (let i = 0; i < count - 1; i++) {
    const mid = (rest[i] + rest[i + 1]) / 2;
    const u = (mid - cursorX) / radius;
    const w = Math.exp(-3 * u * u);                 // 1 at cursor, → 0 far away
    step.push(minStep + (cardWidth - minStep) * w); // near → cardWidth, far → minStep
  }

  // Anchor the card nearest the cursor at its rest center (R1).
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

  // Clamp the cluster so neither end passes the fixed envelope (R3).
  const half = (count * cardWidth) / 2;
  const envL = containerWidth / 2 - half;
  const envR = containerWidth / 2 + half;
  const leftEdge = pos[0] - cardWidth / 2;
  const rightEdge = pos[count - 1] + cardWidth / 2;
  let shift = 0;
  if (leftEdge < envL) shift = envL - leftEdge;
  else if (rightEdge > envR) shift = envR - rightEdge;
  if (shift !== 0) for (let k = 0; k < count; k++) pos[k] += shift;

  return pos;
}
