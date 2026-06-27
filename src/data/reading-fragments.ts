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

  connectives: {
    additive: ['and so ', ', and ', ' — and ', '; ', ', where '],
    contrast: ['— yet ', ', and still ', ' — but beneath this, ', ', though ', '. Even so, '],
  },
};
