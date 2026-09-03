// ============================================================
// ASSET LABELS — what a generated thing is CALLED in a list.
//
// 🚨 THE FIRST 40 CHARACTERS OF A PROMPT IS NOT A LABEL, and on
// reference-driven work it is actively misleading: every one of those prompts
// opens with the same composed preamble, so a whole gallery reads
// "Reference image 1 is a character ide" — the same string on every row, which
// is worse than no label because it looks like information.
//
// One rule, two consumers: the op surface's `compactAsset` (what an agent reads
// back from `slates_list_assets`) and the desktop gallery caption. A second
// copy of this would drift the way every other hand-mirrored rule in this
// workspace has.
//
// Dependency-free LEAF, same as `shot-grammar`: the desktop RENDERER imports it
// directly, so it may never reach for `node:` anything.
// ============================================================

/**
 * A composed prompt's reference preamble.
 *
 * The composer writes "Reference image 1 is a character identity sheet." — so
 * the optional leading "Reference" has to be matched SEPARATELY from the noun,
 * or the pattern only catches the bare "Image 1 is …" form and every real
 * composed prompt walks straight past it. (It did, until the labels were
 * exercised on actual prompts.)
 */
const REFERENCE_PREAMBLE_RE =
  /^\s*(?:reference\s*)?(?:image|video|audio|clip)?\s*\d*\s*is\b[^.;]*[.;]\s*/i

/** A sentence boundary always ends the label. */
const SENTENCE_BOUNDARY_RE = /(?<=[.;:])\s/
/**
 * An em-dash ends it too — but only once there is enough label to be worth
 * keeping. Composed prompts join a subject to its treatment with one, and the
 * subject alone is the label; a hand-written "wide shot — the barn at dawn"
 * would otherwise be cut down to "wide shot", which names nothing.
 */
const DASH_BOUNDARY_RE = /\s—\s/
const MIN_BEFORE_DASH = 25

const MAX = 60

/**
 * A readable label for a generated asset, from its prompt.
 *
 * Strips a reference preamble, then takes the first CLAUSE rather than a fixed
 * character slice — so the label ends on a word instead of mid-syllable.
 * Returns null for a prompt with nothing usable in it; the caller decides what
 * to show instead (a Shot name, "Untitled").
 */
export function labelFromPrompt(prompt: string | null | undefined): string | null {
  if (!prompt) return null
  const body = (prompt.replace(REFERENCE_PREAMBLE_RE, '').trim() || prompt).trim()
  let clause = body.split(SENTENCE_BOUNDARY_RE)[0].trim()
  const dash = clause.split(DASH_BOUNDARY_RE)[0].trim()
  if (dash.length >= MIN_BEFORE_DASH) clause = dash
  if (!clause) return null
  return clause.length > MAX ? `${clause.slice(0, MAX - 1).trimEnd()}…` : clause
}

/**
 * The caption for one asset row, in priority order: the label it was given, the
 * Shot it came from, then the prompt reduced to a clause.
 *
 * The Shot name sits second because an author who named a Shot chose that word
 * on purpose, and it is the word on the row in the storyboard — so the gallery
 * and the document call the same thing the same thing.
 */
export function assetCaption(a: {
  label?: string | null
  shotName?: string | null
  prompt?: string | null
}): string {
  return a.label?.trim() || a.shotName?.trim() || labelFromPrompt(a.prompt) || 'Untitled'
}
