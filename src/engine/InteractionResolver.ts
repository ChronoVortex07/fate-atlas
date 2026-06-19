import type { InteractionRule, InteractionEvent, SlotResult } from './types';
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
  ): InteractionEvent[] {
    if (chainDepth >= MAX_CHAIN_DEPTH) return [];

    const sourceResult = slots[revealedIndex];
    if (!sourceResult) return [];

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

      // Find targets
      for (let ti = 0; ti < slots.length; ti++) {
        if (ti === revealedIndex) continue; // don't target self (except mirror)
        if (rule.target.action === 'mirror' && ti === revealedIndex) continue;

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

        // Check for chain reactions from the target
        const chainEvents = this.checkAndResolve(
          slots, ti, affinities, rules, chainDepth + 1,
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
}
