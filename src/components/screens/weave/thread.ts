type Pt = { left: number; top: number };

// Smooth crimson thread through the visited node pixels — a centripetal
// Catmull-Rom spline (alpha = 0.5) converted to cubic Béziers. The thread passes
// through every pin with rounded bends and, unlike uniform Catmull-Rom, the
// centripetal parameterization is provably free of cusps and self-intersecting
// loops, so even a hairpin turn opens into a clean rounded corner.
export function threadPath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0].left} ${pts[0].top}`;

  const alpha = 0.5;
  let d = `M${pts[0].left} ${pts[0].top}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;

    const d1 = Math.hypot(p1.left - p0.left, p1.top - p0.top) || 1e-6;
    const d2 = Math.hypot(p2.left - p1.left, p2.top - p1.top) || 1e-6;
    const d3 = Math.hypot(p3.left - p2.left, p3.top - p2.top) || 1e-6;
    const d1a = d1 ** alpha, d2a = d2 ** alpha, d3a = d3 ** alpha;
    const d1a2 = d1a * d1a, d2a2 = d2a * d2a, d3a2 = d3a * d3a;

    const c1x = (d1a2 * p2.left - d2a2 * p0.left + (2 * d1a2 + 3 * d1a * d2a + d2a2) * p1.left) / (3 * d1a * (d1a + d2a));
    const c1y = (d1a2 * p2.top - d2a2 * p0.top + (2 * d1a2 + 3 * d1a * d2a + d2a2) * p1.top) / (3 * d1a * (d1a + d2a));
    const c2x = (d3a2 * p1.left - d2a2 * p3.left + (2 * d3a2 + 3 * d3a * d2a + d2a2) * p2.left) / (3 * d3a * (d3a + d2a));
    const c2y = (d3a2 * p1.top - d2a2 * p3.top + (2 * d3a2 + 3 * d3a * d2a + d2a2) * p2.top) / (3 * d3a * (d3a + d2a));

    d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2.left} ${p2.top}`;
  }
  return d;
}

// Fraction of the thread (by chord length) already settled before the newest
// segment — the start value for the draw-on animation so only the last leg
// animates while the earlier path holds still.
export function threadDrawnFraction(pts: Pt[]): number {
  if (pts.length < 2) return 0;
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const s = Math.hypot(pts[i].left - pts[i - 1].left, pts[i].top - pts[i - 1].top);
    segs.push(s);
    total += s;
  }
  if (total === 0) return 0;
  return (total - segs[segs.length - 1]) / total;
}

// Dashed rose filament from the active node to a candidate (bowed slightly up).
export function filament(a: Pt, b: Pt): string {
  const mx = (a.left + b.left) / 2;
  const my = (a.top + b.top) / 2 - 14;
  return `M${a.left} ${a.top} Q${mx} ${my} ${b.left} ${b.top}`;
}
