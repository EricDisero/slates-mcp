/** Model-specific prompt advice, extracted from each skill's @banned blocks.
 * The op layer only warns: it never rewrites or blocks a prompt, on any surface.
 * The desktop Studio Agent's loop refuses an agent-written generation prompt
 * BEFORE the spend when it carries a word code can check from the call alone
 * (`refusableBannedTokens`; slate `src/main/studio-agent/guards.ts`,
 * 2026-10-07): a word the user typed passes, and the identical call sent again
 * after the refusal runs. No model's list is universal.
 *
 * Only explicit Ban and Warn rows declare literals. Conditions live on those rows.
 */
import { brainFiles, servedBrain, type ServedBrain } from '../skills/served.js'

import { matcherFor, parseGuideBans, type BannedToken, type BannedTokenScope } from './guide-bans.js'
export type { BannedToken, BannedTokenCondition, BannedTokenScope } from './guide-bans.js'

// Read from the brain this process holds (skills/served.ts) and rebuilt when it changes: the model guides that
// carry the @banned blocks are served by the account's tier.
let built: { brain: ServedBrain; bySkill: Map<string, readonly BannedToken[]> } | undefined
function bannedBySkill(): Map<string, readonly BannedToken[]> {
  const brain = servedBrain()
  if (built?.brain === brain) return built.bySkill
  const bySkill = new Map<string, readonly BannedToken[]>()
  for (const [skill, content] of Object.entries(brainFiles())) {
    const tokens = parseGuideBans(skill, content)
    if (tokens.length) bySkill.set(skill, tokens)
  }
  built = { brain, bySkill }
  return bySkill
}

/** Compatibility exports: there is no cross-model blacklist. */
export const BANNED_PROMPT_TOKENS: readonly BannedToken[] = Object.freeze([])
export function bannedTokensFor(_scope: BannedTokenScope): readonly BannedToken[] { return BANNED_PROMPT_TOKENS }
export function describeBannedTokens(_scope: BannedTokenScope): string { return '' }
export function bannedTokensForSkill(skill: string): readonly BannedToken[] { return bannedBySkill().get(skill) ?? [] }

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
