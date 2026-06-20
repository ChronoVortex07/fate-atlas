import type { NarrativeTemplates } from '../engine/types';

export const NARRATIVE_TEMPLATES: NarrativeTemplates = {
  // ── Openings: key = theme name ──
  openings: {
    upheaval: [
      'The currents of upheaval swirl around {subject}. What once stood firm now trembles, and in the breaking there is revelation.',
      'Upheaval marks the hour. {subject} stands at the epicenter — disruption is not the enemy, but the messenger.',
    ],
    renewal: [
      'A breath of renewal stirs across {subject}. The old season passes; something green breaks through the frost.',
      'Renewal dawns at the edge of the horizon. {subject} feels the first warmth of a sun that has not yet fully risen.',
    ],
    stagnation: [
      'Stillness grips {subject}. Nothing moves, yet everything waits — the pause is not empty, but heavy with unspoken outcome.',
      'The air hangs motionless around {subject}. Patience is asked for, but the cost of waiting must also be counted.',
    ],
    illumination: [
      'Clarity breaks through the veil around {subject}. What was hidden now stands in sharp relief — the truth has arrived.',
      'A light finds {subject} at the crossroads. Not the gentle glow of hope, but the piercing beam of understanding.',
    ],
    harmony: [
      'Balance holds sway over {subject}. The disparate threads align, and for this moment the weave is whole.',
      'Harmony settles around {subject} like a held breath. Alignment is here — fragile, but present.',
    ],
    conflict: [
      'Opposing forces gather around {subject}. The tension is not a flaw in the pattern — it IS the pattern.',
      'Conflict sharpens the air near {subject}. Two truths cannot occupy the same space without friction.',
    ],
    transformation: [
      'Change is underway for {subject}. Not the sudden crack of upheaval, but the slow, certain turning of the wheel.',
      'Transformation moves through {subject} like a season changing. The shape of things is softening, preparing to become something new.',
    ],
    mystery: [
      'The unknown gathers close to {subject}. The stars do not speak plainly — they offer riddles, and the riddles are the gift.',
      'Mystery shrouds {subject} in its veil. What cannot be seen is not absent — it is waiting to be approached differently.',
    ],
    authority: [
      'Structures of power frame {subject}. Order has spoken, and its voice carries the weight of immutable law.',
      'Authority stands watch over {subject}. Not the tyranny of force, but the gravity of established truth.',
    ],
    surrender: [
      'Release beckons {subject}. Not defeat, but the quiet wisdom of letting go what cannot be carried further.',
      'The moment asks {subject} to yield. The river does not fight the stone — it flows around, and in flowing, shapes it.',
    ],
  },

  // ── Dimension bands: key = "axis_band" ──
  dimensionBands: {
    favorability_high: [
      'The signs lean favorably. Fortune inclines toward you, and the way ahead carries promise.',
      'The stars smile on what unfolds. This is a moment of alignment, where effort meets opportunity.',
    ],
    favorability_neutral: [
      'Fortune stands neither with nor against you. The balance is true, and the choice remains genuinely yours.',
      'Neither blessing nor curse claims this moment. The scales are level — your hand will tip them.',
    ],
    favorability_low: [
      'The signs counsel caution. Headwinds gather, and the path asks for careful, deliberate steps.',
      'Fortune withholds its favor for now. This is not refusal, but a test — what will you do when the wind does not carry you?',
    ],
    certainty_high: [
      'The shape of things is clear. What is foreseen carries a rare weight of certainty.',
      'The stars speak with unusual clarity. The pattern is settled — little remains in doubt.',
    ],
    certainty_low: [
      'The shape of things remains elusive. Ambiguity is not refusal — it is the honest shape of this moment.',
      'The stars hold their counsel close. What they show is real, but it is not the whole picture.',
    ],
    volatility_high: [
      'Nothing here is fixed — change is imminent. The ground beneath this reading is alive and shifting.',
      'The currents are restless. What is true now may not be true soon — readiness is your ally.',
    ],
    volatility_low: [
      'The pattern is stable, set deep. What is shown here will not easily be rewritten.',
      'Stillness holds. The forces at work are slow-moving and deliberate — what they shape will endure.',
    ],
  },

  // ── Modifier frames: key = "role_questionType" ──
  modifierFrames: {
    subject_decision: [
      'The choice itself stands at the center: {results}.',
    ],
    subject_relationship: [
      'The bond itself lies at the heart of the reading: {results}.',
    ],
    subject_future: [
      'The horizon ahead beckons: {results}.',
    ],
    subject_self: [
      'Your inner nature is reflected in the signs: {results}.',
    ],
    action_decision: [
      'As for what you should do: {results}.',
    ],
    action_relationship: [
      'The forces acting on this bond: {results}.',
    ],
    action_future: [
      'The influences shaping what is to come: {results}.',
    ],
    action_self: [
      'The inner forces driving you: {results}.',
    ],
    effect_decision: [
      'The outcome of your choice: {results}.',
    ],
    effect_relationship: [
      'Where this bond leads: {results}.',
    ],
    effect_future: [
      'What will manifest from these currents: {results}.',
    ],
    effect_self: [
      'The growth that awaits you: {results}.',
    ],
  },

  // ── Closings: key = question type ──
  closings: {
    decision: [
      'As you stand at the crossroads, {dominantTheme} marks the way. Choose with eyes open.',
      'The choice is yours to make. Let {dominantTheme} be your compass, not your chain.',
    ],
    relationship: [
      'In the weave of connection, {dominantTheme} is the thread that runs through all the rest.',
      'What binds you to another is never simple. {dominantTheme} names this chapter — the next one is unwritten.',
    ],
    future: [
      'The horizon shifts with every step you take. {dominantTheme} is the weather, not the destination.',
      'What the stars show is never certain — only true. {dominantTheme} lights the way ahead.',
    ],
    self: [
      'You are not a fixed constellation but a sky that changes. {dominantTheme} names this moment of your becoming.',
      'The mirror of divination reflects you back to yourself. {dominantTheme} is what stares back.',
    ],
  },

  // ── Tension patterns: key = "themeA_themeB" or "high_variance" ──
  tensionPatterns: {
    upheaval_harmony: [
      'These forces do not speak with one voice. Upheaval pulls against harmony — the path is not simple, and the contradiction itself is the message.',
    ],
    renewal_stagnation: [
      'A paradox sits at the center: renewal and stagnation cannot coexist, yet both are present. The tension between them is where the truth lives.',
    ],
    illumination_mystery: [
      'Clarity and mystery stand opposed. What is illuminated casts a shadow, and what is hidden shapes what is seen.',
    ],
    conflict_surrender: [
      'The urge to fight and the call to yield pull in opposite directions. Neither is wrong — the wisdom lies in knowing when each is needed.',
    ],
    authority_surrender: [
      'The weight of authority meets the release of surrender. Structure and letting-go cannot both hold the center — yet here they are.',
    ],
    high_variance: [
      'The signs swing wildly between favor and caution. The extremes themselves are the message — this is a moment of unusual instability.',
      'Fortune blows both hot and cold across this reading. Consistency is absent, and that inconsistency must be reckoned with.',
    ],
  },

  // ── Headlines: key = "theme_favorabilityBand" ──
  headlines: {
    upheaval_high: ['Upheaval Bears Unexpected Fruit'],
    upheaval_neutral: ['Upheaval Looms — the Stars Counsel Caution'],
    upheaval_low: ['Upheaval Strikes at the Foundation'],
    renewal_high: ['A Dawn of Renewal Awaits'],
    renewal_neutral: ['Renewal Beckons on the Horizon'],
    renewal_low: ['Renewal Comes, But Through the Storm'],
    stagnation_high: ['Stillness Before the Leap'],
    stagnation_neutral: ['The Pause That Asks for Patience'],
    stagnation_low: ['Stagnation Holds the Wheel'],
    illumination_high: ['Illumination Lights the Way Forward'],
    illumination_neutral: ['A Truth Revealed, a Choice Remains'],
    illumination_low: ['Illumination Pierces the Shadow'],
    harmony_high: ['Harmony Reigns Over the Pattern'],
    harmony_neutral: ['Balance Holds the Threads Together'],
    harmony_low: ['Harmony, Fragile But Present'],
    conflict_high: ['Conflict Forges the Strongest Path'],
    conflict_neutral: ['Conflict at the Crossroads'],
    conflict_low: ['Conflict Clouds the Stars'],
    transformation_high: ['Transformation Bears Its Fruit'],
    transformation_neutral: ['The Wheel Turns — Transformation Is Underway'],
    transformation_low: ['Transformation Through the Fire'],
    mystery_high: ['Mystery Opens Unexpected Doors'],
    mystery_neutral: ['The Unknown Holds the Key'],
    mystery_low: ['Mystery Veils the Path Ahead'],
    authority_high: ['Authority Speaks With Clarity'],
    authority_neutral: ['The Weight of Order Shapes the Reading'],
    authority_low: ['Authority Sets the Boundaries'],
    surrender_high: ['Surrender Brings Unexpected Strength'],
    surrender_neutral: ['Release Is the Way Through'],
    surrender_low: ['Surrender at the Threshold'],
  },

  // ── Fallbacks ──
  fallbacks: {
    noDominantTheme: [
      'The forces revealed are scattered — no single current dominates. The reading itself speaks of diffusion and multiplicity.',
      'No theme rises above the rest. The stars offer not a clear voice, but a chorus — each sign singing its own note.',
    ],
    missingModifier: {
      subject: [
        'What lies at the center remains veiled. The reading cannot speak directly to what grounds it.',
      ],
      action: [
        'The path forward is not yet clear. What you should do — if anything — is held in shadow for now.',
      ],
      effect: [
        'What lies ahead remains veiled. The outcome cannot yet be seen, and perhaps that is the most honest answer of all.',
      ],
    },
    singleResult: [
      'A single sign stands alone — its voice is clear, but its solitude is also part of the message. The pattern is simple, and simplicity has its own power.',
    ],
  },
};
