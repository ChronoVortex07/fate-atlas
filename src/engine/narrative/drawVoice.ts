import type { SlotResult, ModifierRole } from '../types';
import type { DrawVoice } from './types';
import { favBandOf } from './voices/shared';
import { voiceFor } from './voices/index';

export { favBandOf };

/**
 * Back-compat wrapper: a single draw narrated as the first (and only) occurrence.
 * The per-type logic now lives in voices/index.ts; the composer calls voices
 * directly with real occurrence/grouping context.
 */
export function describeDraw(slot: SlotResult, role: ModifierRole): DrawVoice {
  return voiceFor(slot.type).describeOne(slot, role, { index: 0, total: 1 });
}
