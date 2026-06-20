---
name: interaction-effects-unimplemented
description: All five interaction rule actions are currently flavor-only with no mechanical effect
metadata:
  type: project
---

All five interaction action types defined in `src/data/interactions.ts` — `reroll`, `flip`, `mirror`, `add-choice`, and `second-result` — are detected by `InteractionResolver` and displayed in `InteractionOverlay`, but **none** are actually applied to modify slot data. The `InteractionEvent.effect` field names the action, but no code in `GameEngine`, `TurnOrchestrator`, or any component reads it to transform the underlying `SlotResult`.

**Why:** The interaction system was built as a tag-matching engine first; the effect-application layer was deferred. This means all meta-events are currently narrative glue — they show up in the interaction overlay and LLM prompt but don't change the reading.

**How to apply:** When implementing interaction mechanics (post [[game-loop-overhaul-before-mechanics]]), each action needs an applier in the engine:
- `reroll` → re-roll the target d20
- `flip` → swap a tarot card's orientation
- `mirror` → both reversible cards exchange orientations
- `add-choice` → add a branch to the happening
- `second-result` → grant a second interpretation/outcome for the target slot
