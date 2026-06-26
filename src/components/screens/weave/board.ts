import type { WeaveGraph, WovenNode } from '../../../engine/types';

// Fraction of the board reserved as a rim around the node field so that nodes on
// the outer band — and the mood/name labels hanging off them — stay inside the
// board instead of clipping at the edge.
const NODE_MARGIN = 0.13;

// Max radius (px) a node may sit from the board centre.
export function fieldRadius(px: number): number {
  return px * (0.5 - NODE_MARGIN);
}

// Normalized node coords (x,y in ~[-1,1], origin at 0,0) → pixel positions on a
// square board, origin at centre (radial bloom), inset by the rim margin.
export function nodePixel(n: WovenNode, px: number): { left: number; top: number } {
  const r = fieldRadius(px);
  return { left: px / 2 + n.x * r, top: px / 2 + n.y * r };
}

export function nodeById(graph: WeaveGraph): Map<string, WovenNode> {
  return new Map(graph.nodes.map((n) => [n.id, n]));
}
