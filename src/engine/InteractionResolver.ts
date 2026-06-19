import type { InteractionRule, InteractionEvent, PendingEffect, SlotResult } from './types';
import type { TagSystem } from './TagSystem';
import type { EventBus } from './EventBus';

const MAX_CHAIN_DEPTH = 3;

export class InteractionResolver {
  constructor(
    private tagSystem: TagSystem,
    private bus: EventBus,
  ) {}

  checkAndResolve(
    slots: (SlotResult | null)[],
    revealedIndex: number,
    affinities: Record<string, number>,
    rules: InteractionRule[],
    chainDepth: number = 0,
    fired?: Set<string>,
  ): InteractionEvent[] {
    if (chainDepth >= MAX_CHAIN_DEPTH) return [];

    const sourceResult = slots[revealedIndex];
    if (!sourceResult) return [];

    // Track fired pairs to prevent duplicates across chain levels
    const seen = fired ?? new Set<string>();
    const events: InteractionEvent[] = [];

    for (const rule of rules) {
      // Check if trigger matches the revealed entity
      if (!this.tagSystem.hasAllTags(sourceResult, rule.trigger.sourceTags)) {
        // Also check if the source itself carries the affinity-dominant tag
        const sourceTags = [...rule.trigger.sourceTags];
        if (sourceTags.includes('chaos-dominant') && affinities.chaos >= 0.5) {
          // Matched via affinity injection — continue
        } else {
          continue;
        }
      }

      const isMirror = rule.target.action === 'mirror';

      // Mirror only fires when exactly 2 reversible items exist in the spread —
      // thematically a clear two-way reflection, not a tangled web.
      if (isMirror) {
        const reversibleCount = slots.filter(
          (s): s is SlotResult => s !== null && this.tagSystem.hasAllTags(s, ['reversible']),
        ).length;
        if (reversibleCount !== 2) continue;
      }

      // Find targets
      for (let ti = 0; ti < slots.length; ti++) {
        if (ti === revealedIndex) continue; // never target self

        // Deduplicate: skip if this pair already fired for this rule.
        // Mirror uses a symmetric (undirected) key because the reflection
        // is mutual — A↔B is the same interaction regardless of which
        // side was revealed first.
        const pairKey = isMirror
          ? `${rule.id}:${Math.min(revealedIndex, ti)}<->${Math.max(revealedIndex, ti)}`
          : `${rule.id}:${revealedIndex}->${ti}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        const targetResult = slots[ti];
        if (!targetResult) continue;

        if (!this.tagSystem.hasAllTags(targetResult, rule.target.tags)) continue;

        // Apply chance-based filtering
        if (rule.id === 'chaos-second-result' && Math.random() > 0.15) continue;

        // Build the interaction event
        const effectDescription = this.describeEffect(rule, sourceResult, targetResult);

        const event: InteractionEvent = {
          ruleId: rule.id,
          sourceSlotIndex: revealedIndex,
          targetSlotIndex: ti,
          effect: rule.target.action,
          description: rule.display.description,
        };

        events.push(event);
        this.bus.emit('interaction-triggered', {
          ruleId: rule.id,
          sourceIndex: revealedIndex,
          targetIndex: ti,
          action: rule.target.action,
          description: effectDescription,
        });

        // Mirror is a self-contained mutual reflection — no chain needed.
        if (!isMirror) {
          // Check for chain reactions from the target
          const chainEvents = this.checkAndResolve(
            slots, ti, affinities, rules, chainDepth + 1, seen,
          );
          events.push(...chainEvents);

          if (chainEvents.length > 0) {
            this.bus.emit('interaction-chain-complete', {
              depth: chainDepth + 1,
              totalEvents: chainEvents.length,
            });
          }
        }
      }
    }

    return events;
  }

  private describeEffect(
    rule: InteractionRule,
    source: SlotResult,
    target: SlotResult,
  ): string {
    const sourceName = 'name' in source ? (source as { name: string }).name : source.type;
    const targetName = 'name' in target ? (target as { name: string }).name : target.type;
    return `${sourceName} → ${rule.target.action} → ${targetName}`;
  }

  checkPendingEffects(
    pendingEffects: PendingEffect[],
    currentResult: SlotResult,
  ): { matched: PendingEffect[]; remaining: PendingEffect[] } {
    const matched: PendingEffect[] = [];
    const remaining: PendingEffect[] = [];

    for (const effect of pendingEffects) {
      if (this.tagSystem.hasAllTags(currentResult, effect.triggerTags)) {
        matched.push(effect);
      } else {
        remaining.push(effect);
      }
    }

    return { matched, remaining };
  }

  createPendingEffects(
    result: SlotResult,
    runId: string,
    rules: InteractionRule[],
  ): PendingEffect[] {
    const effects: PendingEffect[] = [];

    for (const rule of rules) {
      if (this.tagSystem.hasAllTags(result, rule.trigger.sourceTags)) {
        effects.push({
          id: `${rule.id}-${runId}-${Date.now()}`,
          sourceRunId: runId,
          sourceCard: 'name' in result ? (result as { name: string }).name : result.type,
          sourceSlotIndex: 0,
          triggerTags: [...rule.target.tags],
          action: rule.target.action,
          description: rule.display.description,
          expiresAfter: 3,
          turnsRemaining: 3,
        });
      }
    }

    return effects;
  }
}
