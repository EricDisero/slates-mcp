/**
 * SHOT GRAMMAR — the buckets that COUNT framing, and the measured speech rate.
 *
 * 🚨 KEEP THIS A DEPENDENCY-FREE LEAF, exported from its own subpath
 * (`@slatesvideo/shared/shot-grammar`). The desktop imports it from
 * `slate/src/shared/` for the variety counter and the fit check, and the same
 * two reasons that made `model-capabilities.ts` a leaf apply verbatim: the root
 * barrel re-exports `auth.js` → `node:fs` (breaks renderer bundling) and
 * `/prompts` drags the 5,000-word tips corpus in with no `require` condition.
 *
 * 🚨 BUCKETS EXIST TO COUNT, NEVER TO CONSTRAIN. `rules/ads/cinematic-storyboard.md`
 * §4e, reconciled against ByteDance's own ModelArk docs: *"Camera vocabulary is
 * open standard language and includes shot size (close-up / medium / wide) —
 * not a closed list of eight moves."* Authoring `shotSize` and `camera` is FREE
 * TEXT. A value matching no bucket counts as `other` and is never rejected,
 * rewritten, or warned about. This module is the ONE home for these names —
 * a second bucket list anywhere downstream is the drift `MODEL_CAPABILITIES`
 * was created to end.
 */

// ── Shot size ──────────────────────────────────────────────────────

export const SHOT_SIZE_BUCKETS = [
  'wide',
  'medium',
  'close',
  'extreme-close',
  'other',
] as const
export type ShotSizeBucket = (typeof SHOT_SIZE_BUCKETS)[number]

// ── Camera move ────────────────────────────────────────────────────

export const CAMERA_MOVE_BUCKETS = [
  'static',
  'push',
  'pull',
  'handheld',
  'orbit',
  'crane',
  'other',
] as const
export type CameraMoveBucket = (typeof CAMERA_MOVE_BUCKETS)[number]

/**
 * The vocabulary each bucket answers to, as whole-word patterns.
 *
 * 🚨 NO TWO-LETTER ABBREVIATIONS — no `CU`, `ECU`, `MS`, `WS`, `LS`. They
 * collide with ordinary words, they collide with EACH OTHER across shooting
 * conventions (`MS` is a medium shot to one crew and a master to another), and
 * a value bucketed WRONG is worse than one bucketed `other`: the whole claim of
 * the variety check is that it is arithmetic anyone can verify by eye. `other`
 * says "I did not recognise this"; a wrong bucket says something false.
 * `cinematic-storyboard.md` §1's own example — `long-lens CU, other head
 * blurred` — is deliberately `other`, and that is the correct answer.
 *
 * `satisfies Record<Exclude<Bucket, 'other'>, string[]>` on both records is
 * what makes a SEVENTH bucket a compile error here rather than a name nothing
 * ever matches. `other` is excluded because it is the fallback, by definition
 * the bucket with no vocabulary.
 */
const SHOT_SIZE_VOCABULARY = {
  // Longest/most specific first — `extreme close` must win over `close`.
  'extreme-close': ['extreme close', 'extreme-close', 'macro', 'insert'],
  close: ['close up', 'close-up', 'closeup', 'close on', 'close', 'tight'],
  medium: ['medium', 'mid shot', 'mid-shot', 'waist', 'cowboy', 'two shot', 'two-shot'],
  wide: ['wide', 'establishing', 'long shot', 'long-shot', 'full shot', 'full-shot', 'master'],
} satisfies Record<Exclude<ShotSizeBucket, 'other'>, string[]>

const CAMERA_MOVE_VOCABULARY = {
  // `pull` before `push` so "dolly out" is never eaten by a looser "dolly".
  // The bare bucket name is in every list: `push` alone matched while `pull`
  // alone did not, which is the kind of asymmetry nobody notices until a count
  // is quietly wrong.
  pull: ['pull back', 'pull-back', 'pull out', 'pull away', 'dolly out', 'track out', 'zoom out', 'pull'],
  push: ['push in', 'push-in', 'push', 'dolly in', 'track in', 'punch in', 'creep in', 'zoom in'],
  // No trailing space on `arc` — matching is word-boundary based, so a space in
  // the needle is both redundant and a trap for the next editor.
  orbit: ['orbit', 'arc', 'circle', 'revolve', 'around the'],
  crane: ['crane', 'jib', 'boom', 'drone', 'aerial', 'overhead descend'],
  handheld: ['handheld', 'hand-held', 'shaky', 'shoulder', 'verite', 'vérité'],
  static: ['static', 'locked off', 'locked-off', 'lock off', 'tripod', 'still', 'no movement'],
} satisfies Record<Exclude<CameraMoveBucket, 'other'>, string[]>

/** Case- and punctuation-insensitive containment, on word boundaries so
 *  `wide` does not match `widescreen` and `close` does not match `closer`. */
function matches(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack)
}

function bucketBy<B extends string>(
  raw: string | null | undefined,
  vocabulary: Partial<Record<B, string[]>>,
  fallback: B
): B {
  if (!raw || !raw.trim()) return fallback
  const text = ` ${raw.toLowerCase().trim()} `
  for (const [bucket, words] of Object.entries(vocabulary) as Array<[B, string[]]>) {
    for (const word of words) if (matches(text, word)) return bucket
  }
  return fallback
}

/** Which shot-size bucket a free-text value counts in. Never rejects. */
export function bucketShotSize(raw: string | null | undefined): ShotSizeBucket {
  return bucketBy<ShotSizeBucket>(raw, SHOT_SIZE_VOCABULARY, 'other')
}

/** Which camera-move bucket a free-text value counts in. Never rejects. */
export function bucketCameraMove(raw: string | null | undefined): CameraMoveBucket {
  return bucketBy<CameraMoveBucket>(raw, CAMERA_MOVE_VOCABULARY, 'other')
}

/** Human label for a bucket, for a header strip or an op result. Derived from
 *  the bucket name so a seventh bucket cannot ship without a label. */
export function bucketLabel(bucket: ShotSizeBucket | CameraMoveBucket): string {
  return bucket.replace(/-/g, ' ')
}

// ── Speech rate ────────────────────────────────────────────────────

/**
 * 🚨 MEASURED, NOT CITED — and the corpus is ours.
 *
 * An earlier draft of the plan that introduced this said no source existed and
 * deferred the fit check. That was a claim about the world made without looking:
 * `second-brain/business/projects/slates/content-strategy/examples/ad-research.db`
 * carries `transcript` and `duration_seconds` on every row and always did.
 *
 * ⚠️ IT IS A CORPUS STATISTIC, SO IT DECAYS AND MUST STAY RE-DERIVABLE.
 * `SPEECH_RATE_QUERY` below is the exact derivation. Re-run it when the corpus
 * grows meaningfully; a constant whose query no longer reproduces it is STALE,
 * not wrong — update the number and the `n` together. Same discipline as the
 * pSEO `verifiedOn` dates. What it must never become is a hand-typed figure
 * nobody can reproduce.
 */
export interface SpeechRate {
  /** Words per minute. */
  readonly wpm: number
  /** How many ads in the corpus this segment covers. */
  readonly n: number
  /** Which rows `SPEECH_RATE_QUERY` was segmented to. */
  readonly segment: string
}

/**
 * The derivation, verbatim, so gate 13a can re-run it.
 *
 * Word count is a WHITESPACE SPLIT of the trimmed transcript (`/\s+/`), not a
 * space count — transcripts carry newlines, and counting only ' ' undercounts
 * every multi-line row and drags the median down about ten wpm.
 */
export const SPEECH_RATE_QUERY = `
-- words-per-minute per ad, from second-brain/business/projects/slates/
--   content-strategy/examples/ad-research.db
-- words = transcript.trim().split(/\\s+/).length   (applied to each row)
-- wpm   = words / (duration_seconds / 60)
SELECT creator, has_voiceover, duration_seconds, transcript
  FROM ads
 WHERE transcript IS NOT NULL AND TRIM(transcript) <> ''
   AND duration_seconds IS NOT NULL AND duration_seconds > 0;
-- segments: ALL rows · has_voiceover · creator LIKE '%Heinrich%' (performed)
--           · creator LIKE '%AI Video Bootcamp%' (direct response)
-- statistic: median per segment; ceiling = max over ALL rows
`.trim()

/** When the numbers below were last derived from the query above. */
export const SPEECH_RATE_MEASURED_ON = '2026-08-31'

/**
 * 🔑 THE REGISTER SPLIT IS REAL AND MEASURED, which is why there is no single
 * number. Heinrich's performed, genre-acted reads run a median of 133 wpm;
 * AI Video Bootcamp's hard-sell direct response runs 167 — thirty-four words a
 * minute apart on the same runtime. A single point value would have been worse
 * than none.
 */
export const SPEECH_RATE = {
  performed: { wpm: 133, n: 4, segment: "creator LIKE '%Heinrich%'" },
  conversational: { wpm: 157, n: 71, segment: 'all rows with a transcript and a duration' },
  direct_response: { wpm: 167, n: 21, segment: "creator LIKE '%AI Video Bootcamp%'" },
  /**
   * The fastest read in the whole corpus. **The fit check flags only ABOVE
   * this** — that is what "cannot fit at any plausible delivery" means. Not
   * 250, not p90: those are rates real ads actually hit, and flagging an
   * achievable read is exactly how a check gets ignored.
   */
  ceiling: { wpm: 283, n: 71, segment: 'max over all rows' },
} as const satisfies Record<string, SpeechRate>

export type SpeechRegister = Exclude<keyof typeof SPEECH_RATE, 'ceiling'>

/**
 * The default register, and there is deliberately no picker for it.
 *
 * It is the corpus median and the safest of the three. A control would be a
 * preference widget in a feature whose whole argument is that fewer required
 * choices is better. If a project's own measured rate ever justifies one, that
 * is a later change with its own evidence.
 */
export const DEFAULT_SPEECH_REGISTER: SpeechRegister = 'conversational'

/** How many words fit in `seconds` at a register's pace. `null` when there is
 *  no duration — a cut with no model has none, and inventing one would lie. */
export function wordsForDuration(
  seconds: number | null | undefined,
  register: SpeechRegister = DEFAULT_SPEECH_REGISTER
): number | null {
  if (seconds == null || !(seconds > 0)) return null
  return Math.round((SPEECH_RATE[register].wpm * seconds) / 60)
}

/** Words in a spoken line. One definition, shared by the header and the flag. */
export function countWords(line: string | null | undefined): number {
  if (!line) return 0
  return line.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Does this line fit this cut? `false` ONLY when it cannot fit at ANY plausible
 * delivery — above the fastest read in 69+ real ads.
 *
 * 🚨 THE CLAIM IS DELIBERATELY WEAK SO THE CITATION CAN BE WEAK. Never flag "a
 * bit long"; a check that nags gets ignored, and then it is worse than absent.
 * Returns `null` when it cannot be decided (no line, or no duration).
 */
export function lineFitsCut(
  line: string | null | undefined,
  seconds: number | null | undefined
): { fits: boolean; words: number; requiredWpm: number } | null {
  const words = countWords(line)
  if (words === 0 || seconds == null || !(seconds > 0)) return null
  const requiredWpm = Math.round(words / (seconds / 60))
  return { fits: requiredWpm <= SPEECH_RATE.ceiling.wpm, words, requiredWpm }
}
