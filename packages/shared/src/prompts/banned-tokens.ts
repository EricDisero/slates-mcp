/** Model-specific prompt advice, extracted from each skill's @banned blocks.
 * Warnings never rewrite or block a prompt. No model's list is universal.
 */
import { SKILLS } from '../skills/content.js'

export type BannedTokenScope = 'image' | 'video'
export interface BannedToken { token: string; skill: string; scope: BannedTokenScope }

const bySkill = new Map<string, readonly BannedToken[]>()
for (const [skill, content] of Object.entries(SKILLS)) {
  const fences = [...content.matchAll(/<!--\s*@banned:start\s*-->([\s\S]*?)<!--\s*@banned:end\s*-->/g)]
  if (!fences.length) continue
  const tokens = [...new Set(fences.flatMap((f) => [...f[1].replace(/<!--[\s\S]*?-->/g, '').matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim())))]
  if (!tokens.length) throw new Error(`${skill}: @banned block contains no tokens`)
  const scope: BannedTokenScope = /nano-banana|gpt-image|flux|seedream/.test(skill) ? 'image' : 'video'
  bySkill.set(skill, tokens.map((token) => ({ token, skill, scope })))
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

export function describeBannedTokensForSkill(skill: string): string {
  const list = bannedTokensForSkill(skill)
  return list.length ? `Avoid these phrases for ${skill}: ${list.map((b) => `"${b.token}"`).join(', ')}. Describe the intended result specifically.` : ''
}

export function bannedTokenWarning(prompt: string, scope: BannedTokenScope, skill?: string): string {
  const hits = findBannedTokens(prompt, scope, skill)
  if (!hits.length) return ''
  return `⚠️ PROMPT WARNING: ${hits.map((b) => `"${b.token}"`).join(', ')} appear in ${skill}'s avoid list. This warning does not change or block your prompt. Describe the intended result specifically; query that guide for details.`
}
