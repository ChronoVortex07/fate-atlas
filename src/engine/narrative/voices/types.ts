import type { SlotResult, ModifierRole, DivinationType } from '../../types';
import type { DrawVoice } from '../types';

/** Where a draw sits among same-type, force-eligible draws in one reading. */
export interface DrawOccurrence {
  index: number; // 0-based ordinal in narration order
  total: number; // total same-type force draws in this reading
}

/** A divination type's reading voice. One per type; a generic fallback covers the rest. */
export interface MinigameVoice {
  type: DivinationType;
  /** One draw. occ.total === 1 (or occ.index === 0) returns today's exact framing. */
  describeOne(slot: SlotResult, role: ModifierRole, occ: DrawOccurrence): DrawVoice;
  /** Collapse 2+ same-type, same-role draws into a single combined voice. */
  describeGroup(slots: SlotResult[], role: ModifierRole, occBase: number): DrawVoice;
}
