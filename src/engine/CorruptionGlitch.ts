import type { CorruptionBand, SynthesisResult } from './types';

// Band+value → corruption intensity for the reading text.
// 0 = clean (gestation), 1 = subtle (Spreading), 2..3 = heavy ramp (Virulent).
export function corruptionTextLevel(band: CorruptionBand, value: number): number {
  if (band === 'spreading') return 1;
  if (band === 'virulent' || band === 'pinnacle') {
    // 67 → 2, ramping to 3 near the pinnacle.
    return 2 + Math.min(1, Math.max(0, (value - 67) / (99 - 67)));
  }
  return 0;
}

const DRIFT: Record<string, string> = {
  promise: 'warning', fortune: 'debt', guidance: 'warning',
  hope: 'dread', clarity: 'static', light: 'dark', good: 'ill',
};
const COMBINING = ['̴', '̶', '̗', '̖', '҉'];
const CONTRADICTIONS = [
  'the way ahead does not exist.',
  'The card you did not draw speaks the loudest.',
  'this reading was never yours.',
];

// Swap two adjacent interior letters; first + last preserved so the eye skips it.
export function interiorTypo(word: string, rng: () => number): string {
  if (word.length < 4) return word;
  const i = 1 + Math.floor(rng() * (word.length - 2));
  const j = i + 1 <= word.length - 2 ? i + 1 : i - 1;
  const a = [...word];
  [a[i], a[j]] = [a[j], a[i]];
  return a.join('');
}

function garble(word: string, rng: () => number): string {
  return [...word].map((ch) =>
    /\w/.test(ch) && rng() < 0.4 ? ch + COMBINING[Math.floor(rng() * COMBINING.length)] : ch,
  ).join('');
}

function redact(word: string): string {
  return '█'.repeat(Math.min(6, Math.max(2, word.length)));
}

// Strip trailing punctuation so word-matching/replacement keeps it.
function splitWord(token: string): [string, string] {
  const m = token.match(/^([\p{L}']+)([^\p{L}']*)$/u);
  return m ? [m[1], m[2]] : [token, ''];
}

export function corruptText(text: string, level: number, rng: () => number): string {
  if (level <= 0 || !text) return text;
  const tokens = text.split(/(\s+)/); // keep whitespace tokens
  const out = tokens.map((tok) => {
    if (/^\s+$/.test(tok) || !tok) return tok;
    const [word, tail] = splitWord(tok);
    let w = word;
    const heavy = level >= 2;
    const p = heavy ? 0.28 : 0.25;
    // tone drift (both levels)
    const lower = w.toLowerCase();
    if (DRIFT[lower] && rng() < p) {
      const rep = DRIFT[lower];
      w = w[0] === w[0].toUpperCase() ? rep[0].toUpperCase() + rep.slice(1) : rep;
      return w + tail;
    }
    if (rng() < p) w = interiorTypo(w, rng);          // typo (both)
    if (heavy && rng() < 0.18) return redact(w) + tail; // redaction (virulent)
    if (heavy && rng() < 0.30) w = garble(w, rng);      // glyph garble (virulent)
    if (heavy && rng() < 0.10) return `${w} — ${w}` + tail; // stutter (virulent)
    return w + tail;
  });
  let result = out.join('');
  if (level >= 2) {
    const n = level >= 3 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      result += ' ' + CONTRADICTIONS[Math.floor(rng() * CONTRADICTIONS.length)];
    }
  }
  return result;
}

export function corruptSynthesis(s: SynthesisResult, level: number, rng: () => number): SynthesisResult {
  if (level <= 0) return s;
  return {
    headline: corruptText(s.headline, level, rng),
    paragraphs: s.paragraphs.map((p) => corruptText(p, level, rng)),
    tensionNote: s.tensionNote ? corruptText(s.tensionNote, level, rng) : s.tensionNote,
    affinityNote: s.affinityNote ? corruptText(s.affinityNote, level, rng) : s.affinityNote,
  };
}

// ── The seed omen ──
// The ONLY tell at the otherwise-silent `seeded` band. Clean prose — never the
// glitch system. Innocuous flavor to a newcomer; a recurring theme (a seventh,
// uncounted presence) that veterans recognize as the planted seed.
export const SEED_OMENS = [
  'Something uncounted leans in to listen.',
  'A seventh shadow settles at the table you set for six.',
  'The reading holds its breath, as if it were read in turn.',
];

export function seedOmen(rng: () => number): string {
  return SEED_OMENS[Math.floor(rng() * SEED_OMENS.length)];
}

// Append the omen as a closing paragraph. Pure — returns a new SynthesisResult.
export function appendSeedOmen(s: SynthesisResult, rng: () => number): SynthesisResult {
  return { ...s, paragraphs: [...s.paragraphs, seedOmen(rng)] };
}
