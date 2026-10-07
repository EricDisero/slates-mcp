/** Model-specific prompt advice, extracted from each skill's @banned blocks.
 * The op layer only warns: it never rewrites or blocks a prompt, on any surface.
 * The desktop Studio Agent's loop refuses an agent-written generation prompt
 * BEFORE the spend when it carries a word code can check from the call alone
 * (`refusableBannedTokens`; slate `src/main/studio-agent/guards.ts`,
 * 2026-10-07): a word the user typed passes, and the identical call sent again
 * after the refusal runs. No model's list is universal.
 *
 * WHAT A BLOCK MAY CONTAIN. Every `backticked` string is a never-use token,
 * except the right way written beside it, which is never a token: `(say \`x\`)`,
 * `than \`x\``, `as in: \`x\`` and `(\`x\`) passed`. A heading that limits the
 * block to a call shape ("with a reference video", "in an EDIT prompt") limits
 * the refusal to calls of that shape. A line whose rule depends on context the
 * call cannot show ("after the first introduction") stays a warning only.
 */
import { SKILLS } from '../skills/content.js'

export type BannedTokenScope = 'image' | 'video'
/** The call shape a block's heading limits its tokens to. */
export type BannedTokenCondition = 'reference-video' | 'edit'
export interface BannedToken {
  token: string
  skill: string
  scope: BannedTokenScope
  /** The never-use line the token came from, as the skill words it. */
  note: string
  /** False when the rule needs context the call cannot show; such a token only warns. */
  checkable: boolean
  /** Set when the block's heading limits it to a call shape. */
  when?: BannedTokenCondition
}

/** The right way, written next to the wrong one: never a token. */
const POSITIVE_BEFORE = [/\(\s*say\s*$/i, /\bthan\s*$/i, /\bas in:?\s*$/i]
const POSITIVE_AFTER = /^\)\s*passed\b/i
/** A rule the call alone cannot settle. */
const CONTEXTUAL = /after the first introduction/i

function conditionOf(heading: string): BannedTokenCondition | undefined {
  if (/with a reference video/i.test(heading)) return 'reference-video'
  if (/in an EDIT prompt/i.test(heading)) return 'edit'
  return undefined
}

/** One fence → its tokens, positives dropped, each with its line and its limits. */
function parseBannedBlock(body: string, skill: string, scope: BannedTokenScope): BannedToken[] {
  const lines = body.replace(/<!--[\s\S]*?-->/g, '').split('\n').map((l) => l.trim()).filter(Boolean)
  const heading = lines.find((l) => /never use|avoid/i.test(l)) ?? ''
  const when = conditionOf(heading.replace(/`[^`\n]*`/g, ''))
  const out: BannedToken[] = []
  for (const line of lines) {
    const note = line.replace(/^-\s*/, '').replace(/`([^`\n]+)`/g, '"$1"')
    for (const m of line.matchAll(/`([^`\n]+)`/g)) {
      const before = line.slice(0, m.index)
      const after = line.slice((m.index ?? 0) + m[0].length)
      if (POSITIVE_BEFORE.some((re) => re.test(before)) || POSITIVE_AFTER.test(after)) continue
      const token = m[1].trim()
      if (out.some((t) => t.token === token)) continue
      out.push({ token, skill, scope, note, checkable: !CONTEXTUAL.test(line), ...(when ? { when } : {}) })
    }
  }
  return out
}

const bySkill = new Map<string, readonly BannedToken[]>()
for (const [skill, content] of Object.entries(SKILLS)) {
  const fences = [...content.matchAll(/<!--\s*@banned:start\s*-->([\s\S]*?)<!--\s*@banned:end\s*-->/g)]
  if (!fences.length) continue
  const scope: BannedTokenScope = /nano-banana|gpt-image|flux|seedream/.test(skill) ? 'image' : 'video'
  const tokens = fences.flatMap((f) => parseBannedBlock(f[1], skill, scope))
    .filter((t, i, all) => all.findIndex((o) => o.token === t.token) === i)
  if (!tokens.length) throw new Error(`${skill}: @banned block contains no tokens`)
  bySkill.set(skill, tokens)
}

/** Compatibility exports: there is no cross-model blacklist. */
export const BANNED_PROMPT_TOKENS: readonly BannedToken[] = Object.freeze([])
export function bannedTokensFor(_scope: BannedTokenScope): readonly BannedToken[] { return BANNED_PROMPT_TOKENS }
export function describeBannedTokens(_scope: BannedTokenScope): string { return '' }
export function bannedTokensForSkill(skill: string): readonly BannedToken[] { return bySkill.get(skill) ?? [] }

const matchers = new Map<string, RegExp>()
function matcherFor(token: string): RegExp {
  let matcher = matchers.get(token)
  if (!matcher) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    matcher = new RegExp(`(?<!\\w)${escaped}(?!\\w)`, 'i')
    matchers.set(token, matcher)
  }
  return matcher
}

export function findBannedTokens(prompt: string, _scope: BannedTokenScope, skill?: string): BannedToken[] {
  return skill ? bannedTokensForSkill(skill).filter((b) => matcherFor(b.token).test(prompt)) : []
}

/**
 * The never-use words this CALL breaks, as far as the call can show: checkable
 * tokens, and a heading-limited token only when the call has that shape (a
 * Seedance 2.5 "edit" reclassifies a fresh generation only with a reference
 * video attached). The desktop loop refuses these before the spend.
 */
export function refusableBannedTokens(
  prompt: string,
  scope: BannedTokenScope,
  skill: string | undefined,
  call: { referenceVideo?: boolean; edit?: boolean } = {}
): BannedToken[] {
  return findBannedTokens(prompt, scope, skill).filter((b) =>
    b.checkable && (b.when === undefined || (b.when === 'reference-video' ? !!call.referenceVideo : !!call.edit)))
}

export function describeBannedTokensForSkill(skill: string): string {
  const list = bannedTokensForSkill(skill)
  return list.length ? `Avoid these phrases for ${skill}: ${list.map((b) => `"${b.token}"`).join(', ')}. Describe the intended result specifically.` : ''
}

export function bannedTokenWarning(prompt: string, scope: BannedTokenScope, skill?: string): string {
  const hits = findBannedTokens(prompt, scope, skill)
  if (!hits.length) return ''
  return `⚠️ PROMPT WARNING: ${hits.map((b) => `"${b.token}"`).join(', ')} appear in ${skill}'s avoid list. This warning does not change or block your prompt. Describe the intended result specifically; query that guide for details.`
}
