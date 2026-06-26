type Pt = { left: number; top: number };

// Smooth crimson thread through the visited node pixels.
export function threadPath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  let d = `M${pts[0].left} ${pts[0].top}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const mx = (a.left + b.left) / 2, my = (a.top + b.top) / 2;
    d += ` Q${a.left} ${a.top} ${mx} ${my}`;
  }
  d += ` L${pts[pts.length - 1].left} ${pts[pts.length - 1].top}`;
  return d;
}

// Dashed rose filament from the active node to a candidate (bowed slightly up).
export function filament(a: Pt, b: Pt): string {
  const mx = (a.left + b.left) / 2;
  const my = (a.top + b.top) / 2 - 14;
  return `M${a.left} ${a.top} Q${mx} ${my} ${b.left} ${b.top}`;
}
