import type { CorruptionBand, SynthesisResult, GlitchSegment, GlitchStyle, CorruptedSynthesis } from './types';

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

// Tone drift: a word quietly swapped for its darker twin (legible, just *wrong*).
const DRIFT: Record<string, string> = {
  promise: 'warning', fortune: 'debt', guidance: 'warning',
  hope: 'dread', clarity: 'static', light: 'dark', good: 'ill',
};
const COMBINING = ['̴', '̶', '̗', '̖', '҉'];
// Entity whispers — intrusions woven between words, rendered as ghost spans.
// Parenthetical lines read as asides; the bare ones as flat declarations.
const WHISPERS = [
  '(the way ahead does not exist)',
  'The card you did not draw speaks the loudest.',
  '(this reading was never yours)',
  'Expect us.',
];

// The entity speaking in its own voice — replaces the affinity note at Virulent+.
const ENTITY_VOICE = [
  'It watches. It is pleased.',
  'Expect us.',
  'The card you did not draw speaks the loudest.',
  'This reading was never yours.',
];

export function entityVoiceNote(rng: () => number): string {
  return ENTITY_VOICE[Math.floor(rng() * ENTITY_VOICE.length)];
}

// Swap two adjacent interior letters; first + last preserved so the eye skips it.
export function interiorTypo(word: string, rng: () => number): string {
  if (word.length < 4) return word;
  const i = 1 + Math.floor(rng() * (word.length - 2));
  const j = i + 1 <= word.length - 2 ? i + 1 : i - 1;
  const a = [...word];
  [a[i], a[j]] = [a[j], a[i]];
  return a.join('');
}

// Light zalgo accents — only ever on already-hot words near the pinnacle.
function garble(word: string, rng: () => number): string {
  return [...word].map((ch) =>
    /\w/.test(ch) && rng() < 0.4 ? ch + COMBINING[Math.floor(rng() * COMBINING.length)] : ch,
  ).join('');
}

// Strip trailing punctuation so word-matching/replacement keeps it.
function splitWord(token: string): [string, string] {
  const m = token.match(/^([\p{L}']+)([^\p{L}']*)$/u);
  return m ? [m[1], m[2]] : [token, ''];
}

// Pull `n` distinct entries from `pool` using `rng` (deterministic given the seed).
function pickIndices(pool: number[], n: number, rng: () => number): number[] {
  const arr = pool.slice();
  const out: number[] = [];
  for (let k = 0; k < n && arr.length > 0; k++) {
    out.push(arr.splice(Math.floor(rng() * arr.length), 1)[0]);
  }
  return out;
}

// Pick an index proportional to `weights` (deterministic given the seed).
function weightedPick(weights: number[], rng: () => number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

type Tok = { ws: boolean; word: string; tail: string };

// ── The core: falsify text into legible, styled segments ──
// Legibility first. Spreading (level 1) only mutates the words (typos, tone drift)
// with no styling. Virulent (level 2→3) keeps those errors underneath and layers
// on visual treatments that leave the word readable — chromatic pulse, red, flicker,
// hot glow, stutter — plus a *budgeted* number of redactions and whispers that ramps
// from one each at the threshold toward the pinnacle. Redaction is the only treatment
// that hides text, so it stays rare; the horror is that you can read the lie.
export function corruptSegments(
  text: string,
  level: number,
  rng: () => number,
  opts?: { redactBudget?: number; whisperBudget?: number },
): GlitchSegment[] {
  if (level <= 0 || !text) return [{ text }];

  const heavy = level >= 2;
  const t = Math.min(1, Math.max(0, level - 2)); // virulent ramp: 0 at threshold → 1 at pinnacle
  // Budgets default per-blob (used by the single-string LLM path); the synthesis path
  // passes explicit counts so the whole reading shares one budget instead of one per field.
  const redactBudget = opts?.redactBudget ?? (heavy ? 1 + Math.round(t * 3) : 0);
  const whisperBudget = opts?.whisperBudget ?? (heavy ? 1 + Math.round(t) : 0);

  const toks: Tok[] = text.split(/(\s+)/).map((tok) => {
    if (!tok || /^\s*$/.test(tok)) return { ws: true, word: tok, tail: '' };
    const [word, tail] = splitWord(tok);
    return { ws: false, word, tail };
  });

  // Pass 1 — textual mutation (every corrupted level; the Spreading errors underneath).
  for (const tk of toks) {
    if (tk.ws) continue;
    const lower = tk.word.toLowerCase();
    if (DRIFT[lower] && rng() < 0.25) {
      const rep = DRIFT[lower];
      tk.word = tk.word[0] === tk.word[0].toUpperCase() ? rep[0].toUpperCase() + rep.slice(1) : rep;
      continue; // a drifted word is its own tell; don't also typo it
    }
    if (rng() < 0.25) tk.word = interiorTypo(tk.word, rng);
  }

  const wordIdx = toks.map((tk, i) => (tk.ws ? -1 : i)).filter((i) => i >= 0);

  // Pass 2 — styling (virulent only). Redaction is budgeted and rare; the rest are
  // legibility-preserving span styles whose odds ramp toward the pinnacle.
  const redactSet = new Set<number>();
  const styleOf = new Map<number, GlitchStyle>();
  if (heavy) {
    const eligible = wordIdx.filter((i) => toks[i].word.length >= 3);
    for (const i of pickIndices(eligible, Math.min(redactBudget, eligible.length), rng)) {
      redactSet.add(i);
    }
    for (const i of wordIdx) {
      if (redactSet.has(i)) continue;
      const r = rng();
      const caP = 0.10 + t * 0.18;
      const redP = caP + 0.06 + t * 0.08;
      const flickP = redP + 0.04 + t * 0.05;
      const hotP = flickP + t * 0.10;        // hot only ramps in near the pinnacle
      const stutP = hotP + 0.03 + t * 0.04;
      if (r < caP) styleOf.set(i, t > 0.6 ? 'ca-fast' : 'ca');
      else if (r < redP) styleOf.set(i, 'red');
      else if (r < flickP) styleOf.set(i, 'flick');
      else if (r < hotP) styleOf.set(i, 'hot');
      else if (r < stutP) styleOf.set(i, 'stut');
    }
  }

  // Build segments (word + optional tail, whitespace preserved).
  const segs: GlitchSegment[] = [];
  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i];
    if (tk.ws) { segs.push({ text: tk.word }); continue; }
    if (redactSet.has(i)) {
      segs.push({ text: tk.word, style: 'redact' });
      if (tk.tail) segs.push({ text: tk.tail });
      continue;
    }
    const style = styleOf.get(i);
    let w = tk.word;
    if (style === 'stut') w = `${w} — ${w}`;
    else if ((style === 'hot' || style === 'ca-fast') && t > 0.5) w = garble(w, rng);
    segs.push({ text: w, style });
    if (tk.tail) segs.push({ text: tk.tail });
  }

  // Pass 3 — whispers: budgeted ghost intrusions spliced between words.
  if (whisperBudget > 0) {
    const candidates = segs
      .map((s, i) => (i > 0 && s.style !== 'redact' && /\S/.test(s.text) ? i : -1))
      .filter((i) => i >= 0);
    const at = pickIndices(candidates, Math.min(whisperBudget, candidates.length), rng)
      .sort((a, b) => b - a); // splice high→low so earlier indices stay valid
    for (const i of at) {
      const whisper = WHISPERS[Math.floor(rng() * WHISPERS.length)];
      segs.splice(i + 1, 0, { text: ' ' }, { text: whisper, style: 'ghost' });
    }
  }

  return segs;
}

// Flatten segments to plain text (LLM transcript / share): redactions become █ bars,
// every other treatment (whispers, stutters, zalgo) already lives in the text.
export function segmentsToText(segs: GlitchSegment[]): string {
  return segs
    .map((s) => (s.style === 'redact' ? '█'.repeat(Math.min(6, Math.max(2, s.text.length))) : s.text))
    .join('');
}

// Plain-text falsification for the copy-paste LLM prompt (no styling to carry).
export function corruptText(text: string, level: number, rng: () => number): string {
  if (level <= 0 || !text) return text;
  return segmentsToText(corruptSegments(text, level, rng));
}

// Falsify a synthesis for display: each field becomes styled segments.
// Spreading (level 1) is per-field subtle textual mutation. Virulent+ budgets the
// redactions and whispers across the WHOLE reading (so early virulent shows ~one of
// each, not one per field) and distributes them toward the longer fields.
export function corruptSynthesisSegments(s: SynthesisResult, level: number, rng: () => number): CorruptedSynthesis {
  if (level < 2) {
    return {
      headline: corruptSegments(s.headline, level, rng),
      paragraphs: s.paragraphs.map((p) => corruptSegments(p, level, rng)),
      tensionNote: s.tensionNote ? corruptSegments(s.tensionNote, level, rng) : undefined,
      affinityNote: s.affinityNote ? corruptSegments(s.affinityNote, level, rng) : undefined,
    };
  }

  const t = Math.min(1, Math.max(0, level - 2));
  const fields: string[] = [s.headline, ...s.paragraphs];
  if (s.tensionNote) fields.push(s.tensionNote);
  if (s.affinityNote) fields.push(s.affinityNote);

  const weights = fields.map((f) => f.split(/\s+/).length);
  const redactTotal = 1 + Math.round(t * 4);  // ~1 across the reading → ~5 near pinnacle
  const whisperTotal = 1 + Math.round(t * 2); // ~1 across the reading → ~3 near pinnacle
  const redactBudget = new Array(fields.length).fill(0);
  const whisperBudget = new Array(fields.length).fill(0);
  for (let k = 0; k < redactTotal; k++) redactBudget[weightedPick(weights, rng)]++;
  for (let k = 0; k < whisperTotal; k++) whisperBudget[weightedPick(weights, rng)]++;

  const out = fields.map((f, i) =>
    corruptSegments(f, level, rng, { redactBudget: redactBudget[i], whisperBudget: whisperBudget[i] }),
  );

  let idx = 0;
  const headline = out[idx++];
  const paragraphs = s.paragraphs.map(() => out[idx++]);
  const tensionNote = s.tensionNote ? out[idx++] : undefined;
  const affinityNote = s.affinityNote ? out[idx++] : undefined;
  return { headline, paragraphs, tensionNote, affinityNote };
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
