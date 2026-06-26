import type { WeaveGraph, WovenNode } from '../../../engine/types';

// Normalized node coords (x,y in ~[-1,1], origin at 0,0) → pixel positions on a
// square board, origin at centre (radial bloom).
export function nodePixel(n: WovenNode, px: number): { left: number; top: number } {
  return { left: px / 2 + n.x * 0.46 * px, top: px / 2 + n.y * 0.46 * px };
}

export function nodeById(graph: WeaveGraph): Map<string, WovenNode> {
  return new Map(graph.nodes.map((n) => [n.id, n]));
}
