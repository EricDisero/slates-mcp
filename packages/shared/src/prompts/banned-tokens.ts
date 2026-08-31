// ============================================================
// BANNED PROMPT TOKENS — the "load the guide" rule, made structural.
//
// THE PROBLEM: "before prompting any model, load the matching guide" is a
// sentence in a system prompt with nothing checking it. Measured 2026-08-30 in
// a real Studio Agent session: slates_get_prompting_guide was called ZERO
// times, and the prompt that shipped tripped the skill's own never-use list
// twice (`photorealistic`, `cinematic`). A rule with no check is a suggestion,
// and an LLM is the least reliable enforcer you could pick.
//
// THE FIX, in two halves, neither of which the model can skip:
//   (a) the never-use list is INLINED into the generate ops' descriptions.
//       Op descriptions are always in context on BOTH surfaces — there is no
//       call to omit and no discretion to exercise.
//   (b) the submitted prompt is MATCHED against the list and a warning comes
//       back in the op result. Non-blocking: the generation proceeds
//       (PRODUCT_PHILOSOPHY.md → make state visible, never block).
//
// 🚨 THE LIST IS NEVER HAND-TYPED HERE. It is extracted from the skill files
// themselves, between `<!-- @banned:start -->` / `<!-- @banned:end -->`
// markers. That is this workspace's LLM-docs doctrine — never hand-type a fact
// an LLM will read — and it is the only way the op description and the skill
// cannot drift apart. Change the skill; the description follows on the next
// build. scripts/agent-surface-lockstep-check.mjs fails the build if a token
// in a description no longer appears in its source skill.
//
// Deterministic by construction (document order, no sorting, no dedupe
// reshuffle) because these strings land in the desktop's prompt-cached tool
// prefix, whose byte-stability IS the cache mechanism.
// ============================================================

import { SKILLS } from '../skills/content.js'

/** Which generate op a list applies to. */
export type BannedTokenScope = 'image' | 'video'

export interface BannedToken {
  /** The literal phrase, verbatim from the skill. */
  token: string
  /** Skill file it was read from — cited in every warning. */
  skill: string
  scope: BannedTokenScope
}

/**
 * Where each scope's list lives.
 *
 * One skill per scope on purpose: these are the two lists that are GENERIC to
 * their modality (Stable-Diffusion-era tag soup for images, quality
 * incantations for video), not model-specific quirks. A per-model list would
 * mean the op description changed with the `model` argument, which it cannot —
 * a description is one static string for every call.
 */
const BANNED_TOKEN_SOURCES: ReadonlyArray<{ skill: string; scope: BannedTokenScope }> = [
  { skill: 'slates-prompting-nano-banana-2', scope: 'image' },
  { skill: 'slates-prompting-seedance', scope: 'video' },
]

const FENCE_RE = /<!--\s*@banned:start\s*-->([\s\S]*?)<!--\s*@banned:end\s*-->/g
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g
const BACKTICKED_RE = /`([^`\n]+)`/g

/**
 * Pull every backticked phrase out of a skill's fenced block(s).
 *
 * HTML comments are stripped FIRST: the fence carries a "MACHINE-READ" note to
 * whoever edits the skill next, and that note itself contains backticks.
 */
function extractFromSkill(skill: string): string[] {
  const content = SKILLS[skill]
  if (content === undefined) {
    throw new Error(
      `[banned-tokens] no such skill: ${skill}. BANNED_TOKEN_SOURCES must name files in packages/shared/skills/.`
    )
  }
  const out: string[] = []
  let fence: RegExpExecArray | null
  FENCE_RE.lastIndex = 0
  let fences = 0
  while ((fence = FENCE_RE.exec(content)) !== null) {
    fences += 1
    const body = fence[1].replace(HTML_COMMENT_RE, '')
    let m: RegExpExecArray | null
    BACKTICKED_RE.lastIndex = 0
    while ((m = BACKTICKED_RE.exec(body)) !== null) {
      const token = m[1].trim()
      if (token && !out.includes(token)) out.push(token)
    }
  }
  if (fences === 0) {
    throw new Error(
      `[banned-tokens] ${skill}.md has no <!-- @banned:start --> / <!-- @banned:end --> block. ` +
        `The op description and the prompt warnings are GENERATED from it — restore the markers, ` +
        `or drop the skill from BANNED_TOKEN_SOURCES.`
    )
  }
  if (out.length === 0) {
    throw new Error(
      `[banned-tokens] ${skill}.md has a @banned block with no backticked tokens in it. ` +
        `An empty list would silently disable the check instead of failing it.`
    )
  }
  return out
}

/** Every banned token, in skill-document order. Integrity asserted at load. */
export const BANNED_PROMPT_TOKENS: readonly BannedToken[] = BANNED_TOKEN_SOURCES.flatMap(
  ({ skill, scope }) => extractFromSkill(skill).map((token) => ({ token, skill, scope }))
)

const byScope = new Map<BannedTokenScope, BannedToken[]>()
for (const entry of BANNED_PROMPT_TOKENS) {
  const list = byScope.get(entry.scope) ?? []
  list.push(entry)
  byScope.set(entry.scope, list)
}

export function bannedTokensFor(scope: BannedTokenScope): readonly BannedToken[] {
  return byScope.get(scope) ?? []
}

/** Regex cache — one word-boundary matcher per token, built once. */
const matchers = new Map<string, RegExp>()
function matcherFor(token: string): RegExp {
  let re = matchers.get(token)
  if (!re) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // \b at both ends so `4k` does not fire inside "84king" and `flawless`
    // does not fire inside "flawlessly". Every token starts and ends with a
    // word character today; if one ever starts with punctuation, \b would
    // anchor wrong — the load-time check below is what would catch it.
    re = new RegExp(`\\b${escaped}\\b`, 'i')
    matchers.set(token, re)
  }
  return re
}

for (const { token, skill } of BANNED_PROMPT_TOKENS) {
  if (!/^\w/.test(token) || !/\w$/.test(token)) {
    throw new Error(
      `[banned-tokens] ${skill}: token ${JSON.stringify(token)} does not start and end with a word ` +
        `character, so the \\b word-boundary match would never fire. Rewrite the entry or teach ` +
        `matcherFor() the new shape.`
    )
  }
}

/** The tokens a submitted prompt actually contains. */
export function findBannedTokens(prompt: string, scope: BannedTokenScope): BannedToken[] {
  return bannedTokensFor(scope).filter((b) => matcherFor(b.token).test(prompt))
}

/**
 * The list as it appears INSIDE an op description — always in context, on both
 * surfaces, with no call required to see it. Generated, never hand-typed.
 */
export function describeBannedTokens(scope: BannedTokenScope): string {
  const list = bannedTokensFor(scope)
  if (list.length === 0) return ''
  const skills = [...new Set(list.map((b) => b.skill))].join(' / ')
  return (
    `NEVER put these in a prompt (they measurably degrade output — full rationale in ${skills}): ` +
    list.map((b) => `"${b.token}"`).join(', ') +
    `. Describe specifically instead.`
  )
}

/**
 * Non-blocking warning for a submitted prompt. Empty string when clean.
 *
 * Returned in the op RESULT — the one place the agent cannot avoid reading —
 * rather than raised as an error. The generation proceeds either way: the
 * sandbox doctrine says make state visible, never block.
 */
export function bannedTokenWarning(prompt: string, scope: BannedTokenScope): string {
  const hits = findBannedTokens(prompt, scope)
  if (hits.length === 0) return ''
  const skills = [...new Set(hits.map((b) => b.skill))].join(', ')
  return (
    `⚠️ PROMPT WARNING: your prompt contains ${hits.map((b) => `"${b.token}"`).join(', ')} — ` +
    `on the never-use list in ${skills}. Not blocked, and this generation ran as submitted. ` +
    `Load that guide with slates_get_prompting_guide and rewrite with specific description ` +
    `(named lens, light direction, stock, composition) before the next generation.`
  )
}
