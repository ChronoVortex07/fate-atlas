import type { ModifierRole } from '../engine/types';
import type { FavBand } from '../engine/narrative/types';

/**
 * Fragment pools for the beat-composer reading generator.
 *
 * verbPhrases — predicate fragments keyed by modifier role × favorability band;
 *   describeDraw() picks one to follow a draw's subject.
 * drawLeadIns — optional role intros that introduce a force beat.
 * connectives — stitch adjacent clauses: `additive` when beats reinforce,
 *   `contrast` when valence flips.
 *
 * Theme/fortune/temper/close/opposition/positions/headline pools live further
 * below and are consumed by ProseBuilder.
 */
export const READING_FRAGMENTS = {
  verbPhrases: {
    subject: {
      high: [
        'stands bright at the center of all this',
        'anchors the reading in something hopeful',
        'holds the heart of the matter in good light',
      ],
      neutral: [
        'sits at the heart of the matter',
        'holds the center without tipping the scales',
        'names what this reading truly circles',
      ],
      low: [
        'shadows the heart of the matter',
        'sets an uneasy weight at the center',
        'darkens the ground the question rests on',
      ],
    },
    action: {
      high: [
        'urges you to move while the way lies open',
        'invites a bold and open hand',
        'counsels you to act before the moment closes',
      ],
      neutral: [
        'asks for a measured, deliberate step',
        'counsels patience over haste',
        'leaves the next move plainly to your judgment',
      ],
      low: [
        'counsels you to hold rather than strike',
        'warns against forcing the matter now',
        'urges caution before the cost outruns the gain',
      ],
    },
    effect: {
      high: [
        'promises the current will carry you',
        'points toward an opening just ahead',
        'lets the outcome ripen in your favor',
      ],
      neutral: [
        'leaves the outcome genuinely in your hands',
        'shapes an outcome still unwritten',
        'turns toward an end you have yet to settle',
      ],
      low: [
        'warns the cost will be felt before the gain',
        'points to friction on the road ahead',
        'foretells a harder passage than you would wish',
      ],
    },
  } satisfies Record<ModifierRole, Record<FavBand, string[]>>,

  drawLeadIns: {
    subject: [
      'At the center,',
      'Beneath the question itself,',
      'What grounds all of this:',
    ],
    action: [
      'As for the way forward,',
      'For what is yours to do,',
      'The hand the signs ask of you:',
    ],
    effect: [
      'As for where this leads,',
      'Toward what waits ahead,',
      'For the outcome taking shape,',
    ],
  } satisfies Record<ModifierRole, string[]>,

  // ── Repeated-minigame framing (consumed by voices/index.ts) ──
  // variantScaffolds: alternate single-draw subjects for the 2nd+ same-type draw.
  //   {n} = the draw's identifying value (d20 result, hexagram number).
  // group.lead: opener for an aggregated run of same-type, same-role draws.
  // group.seqLast / listLast / mid: list connectives (structural glue).
  drawFraming: {
    variantScaffolds: {
      d20: ['the cast that lands on {n}', 'a later throw reading {n}', 'the roll that shows {n}'],
      iching: ['Hexagram {n} answering in turn', 'a further cast, Hexagram {n}'],
    } as Record<string, string[]>,
    group: {
      lead: {
        d20: 'the dice fall in turn —',
        iching: 'the hexagrams answer in sequence —',
        tarot: 'the cards arrive together —',
        strings: 'the threads gather —',
        generic: 'together —',
      } as Record<string, string>,
      seqLast: ', then ',
      listLast: ', and ',
      mid: ', ',
    },
  },

  connectives: {
    additive: [' and so ', ', and ', ' — and ', '; ', ', where '],
    contrast: [' — yet ', ', and still ', ' — but beneath this, ', ', though '],
  },

  // ── Theme moods: key = theme. Each fragment names the theme noun. ──
  themeMoods: {
    upheaval: ['Upheaval swirls through everything here; what stood firm now trembles', 'This is an hour of upheaval, and the breaking is itself the message'],
    renewal: ['A breath of renewal stirs at the edges, the old season passing', 'Renewal dawns here, faint as a sun not yet fully risen'],
    stagnation: ['A heavy stillness — stagnation — grips the reading; nothing moves, yet everything waits', 'Stagnation holds the air motionless, and patience is the price asked'],
    illumination: ['Illumination breaks the veil; what was hidden stands suddenly in sharp relief', 'A piercing clarity — illumination — finds the heart of the matter'],
    harmony: ['Harmony settles over the whole of it, the disparate threads drawn into one weave', 'A fragile harmony holds for now, alignment present but unguaranteed'],
    conflict: ['Conflict sharpens the air; two truths press against the same narrow space', 'Opposing forces gather — this is a reading shaped by conflict, not calm'],
    transformation: ['Transformation turns slowly underneath, the shape of things softening toward something new', 'The wheel is turning; transformation moves here like a season changing'],
    mystery: ['Mystery shrouds the reading in its veil; the stars speak in riddle, not in plain word', 'The unknown gathers close, and what cannot be seen is only waiting to be approached differently'],
    authority: ['Authority frames the matter — established law, the weight of what is already decided', 'Structures of power stand watch here, and their gravity bends the reading'],
    surrender: ['Surrender beckons — not defeat, but the wisdom of releasing what cannot be carried further', 'The moment asks for yielding; the river does not fight the stone, it shapes it'],
  } as Record<string, string[]>,

  noDominantTheme: [
    'No single current dominates; the signs scatter, and the diffusion is itself the reading',
    'The stars offer a chorus rather than a voice, each sign singing its own separate note',
  ],

  // ── Fortune: key = favorability band ──
  fortune: {
    high: ['fortune inclines toward you, and the way ahead carries real promise', 'the signs lean favorably, effort meeting opportunity at the right hour'],
    neutral: ['fortune stands neither with you nor against you; the scales are level and yours to tip', 'neither blessing nor curse claims the moment — the choice remains genuinely your own'],
    low: ['the signs counsel caution; headwinds gather and the path asks for deliberate steps', 'fortune withholds its favor for now — not a refusal, but a test of your footing'],
  } as Record<string, string[]>,

  // ── Temper: key = "axis_band" ──
  temper: {
    certainty_high: ['the shape of things is unusually settled, little left in doubt', 'the pattern reads clear, carrying a rare weight of certainty'],
    certainty_low: ['the shape stays elusive — what is shown is real, but never the whole of it', 'the stars hold their counsel close, and ambiguity is the honest answer here'],
    volatility_high: ['nothing is fixed; the ground beneath the reading is alive and shifting', 'the currents run restless — what is true now may not hold for long'],
    volatility_low: ['the pattern is set deep and slow-moving; what it shapes will endure', 'a stillness holds the forces in place, unlikely to be soon rewritten'],
  } as Record<string, string[]>,

  // ── Opposition: names both poles. Includes "contest"/"balance". ──
  opposition: [
    '{favor} pulls toward fortune while {adverse} drags against it — the balance you feel is a contest, not a calm',
    'between {favor} and {adverse} the reading splits; the tension itself is the truth, a balance held under strain',
  ],

  // ── Tension pairs: key = sorted "a_b"; fallback uses {a}/{b}. ──
  tensionPairs: {
    harmony_upheaval: ['Upheaval pulls hard against harmony; the path is not simple, and the contradiction is the message'],
    renewal_stagnation: ['Renewal and stagnation cannot coexist, yet both are here — the strain between them is where the truth lives'],
    illumination_mystery: ['Illumination and mystery stand opposed; what is lit casts a shadow, and what is hidden shapes what is seen'],
    conflict_surrender: ['The urge to fight and the call to surrender pull opposite ways; the wisdom is in knowing which the hour needs'],
    authority_surrender: ['Authority meets surrender — structure and letting-go cannot both hold the center, yet here they are'],
  } as Record<string, string[]>,
  tensionVariance: [
    '{a} and {b} swing the signs between favor and caution; the extremes themselves are the message, a moment of unusual instability',
  ],

  // ── Positions: lean phrases for multi-card spreads ──
  positionLeans: { favor: 'leans toward fortune', steady: 'holds steady', adverse: 'turns adverse' } as Record<string, string>,

  // ── Positions: per-position framing + contradiction templates ──
  positionFraming: {
    past:    ['In what has passed,', 'Behind the moment lies', 'The past holds'],
    present: ['At the present turn,', 'Here and now,', 'The present shows'],
    future:  ['Ahead,', 'What comes bends toward', 'The future opens onto'],
  } as Record<string, string[]>,
  positionContradiction: [
    '{pos} divides against itself — {favor} set against {adverse}',
    '{pos} speaks in two voices: {favor}, and yet {adverse}',
  ],

  // ── Closes ──
  closes: {
    byQuestion: {
      decision: ['let {theme} be your compass at the crossroads, not your chain', 'as you choose, {theme} marks the way — go with open eyes'],
      relationship: ['in the weave of connection, {theme} is the thread running through all the rest', '{theme} names this chapter of the bond; the next one is still unwritten'],
      future: ['{theme} is the weather of the road ahead, not its destination', 'what the stars show is never certain, only true — and {theme} lights the way'],
      self: ['{theme} names this moment of your becoming; you are a sky that changes, not a fixed star', 'the mirror reflects {theme} back at you — that is what stares out'],
    } as Record<string, string[]>,
    carry: [
      'and it is {carry} you should carry out of this reading above all',
      'let {carry} be the sign you keep when the rest has faded',
    ],
    plain: [
      'hold what is true here lightly, and walk on',
      'the rest is yours to live into',
      'what comes next is written by the hand, not the stars',
    ],
  },

  // ── Headlines: key = "theme_favBand" ──
  headlines: {
    upheaval_high: ['Upheaval Bears Unexpected Fruit'], upheaval_neutral: ['Upheaval Looms — the Stars Counsel Caution'], upheaval_low: ['Upheaval Strikes at the Foundation'],
    renewal_high: ['A Dawn of Renewal Awaits'], renewal_neutral: ['Renewal Beckons on the Horizon'], renewal_low: ['Renewal Comes, But Through the Storm'],
    stagnation_high: ['Stillness Before the Leap'], stagnation_neutral: ['The Pause That Asks for Patience'], stagnation_low: ['Stagnation Holds the Wheel'],
    illumination_high: ['Illumination Lights the Way Forward'], illumination_neutral: ['A Truth Revealed, a Choice Remains'], illumination_low: ['Illumination Pierces the Shadow'],
    harmony_high: ['Harmony Reigns Over the Pattern'], harmony_neutral: ['Balance Holds the Threads Together'], harmony_low: ['Harmony, Fragile But Present'],
    conflict_high: ['Conflict Forges the Strongest Path'], conflict_neutral: ['Conflict at the Crossroads'], conflict_low: ['Conflict Clouds the Stars'],
    transformation_high: ['Transformation Bears Its Fruit'], transformation_neutral: ['The Wheel Turns — Transformation Is Underway'], transformation_low: ['Transformation Through the Fire'],
    mystery_high: ['Mystery Opens Unexpected Doors'], mystery_neutral: ['The Unknown Holds the Key'], mystery_low: ['Mystery Veils the Path Ahead'],
    authority_high: ['Authority Speaks With Clarity'], authority_neutral: ['The Weight of Order Shapes the Reading'], authority_low: ['Authority Sets the Boundaries'],
    surrender_high: ['Surrender Brings Unexpected Strength'], surrender_neutral: ['Release Is the Way Through'], surrender_low: ['Surrender at the Threshold'],
  } as Record<string, string[]>,
};
