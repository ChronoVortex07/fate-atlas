// Pure shrink/cap arithmetic behind the ShareCard auto-fit. The component measures
// the rendered heights (px) and feeds them in; this decides how much to scale the
// list and how many rows to show before spilling the rest into a "+N more" line.

export interface FitOptions {
  /** List viewport height available to the rows (px, measured). */
  available: number;
  /** Natural height of all rows at scale 1 (px, measured). */
  contentHeight: number;
  /** Per-row height including the inter-row gap (px, measured). */
  rowStride: number;
  /** Total rows the reading wants to show. */
  totalRows: number;
  /** Smallest uniform scale before we cap instead of shrinking further. */
  minScale?: number;
  /** Height the "+N more" line needs when capping (px). Defaults to rowStride. */
  moreStride?: number;
}

export interface FitResult {
  /** Uniform transform scale to apply to the list. */
  scale: number;
  /** Rows to render. */
  visibleRows: number;
  /** Rows folded into the "+N more readings" line. */
  hiddenRows: number;
}

export function fitList(opts: FitOptions): FitResult {
  const { available, contentHeight, rowStride, totalRows } = opts;
  const minScale = opts.minScale ?? 0.72;
  const moreStride = opts.moreStride ?? rowStride;

  if (totalRows <= 0) return { scale: 1, visibleRows: 0, hiddenRows: 0 };
  if (contentHeight <= available) return { scale: 1, visibleRows: totalRows, hiddenRows: 0 };

  const scale = available / contentHeight;
  if (scale >= minScale) return { scale, visibleRows: totalRows, hiddenRows: 0 };

  // Even at the floor it won't all fit — cap and reserve a slot for "+N more".
  const usable = available / minScale; // content-space that maps into `available` at minScale
  const fits = Math.floor((usable - moreStride) / rowStride);
  const visibleRows = Math.min(totalRows - 1, Math.max(1, fits));
  return { scale: minScale, visibleRows, hiddenRows: totalRows - visibleRows };
}
