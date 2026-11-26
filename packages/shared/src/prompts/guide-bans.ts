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

export function parseGuideBans(skill: string, content: string): BannedToken[] {
  const scope = /nano-banana|gpt-image|flux|seedream/.test(skill) ? 'image' : 'video'
  const tokens: BannedToken[] = []
  for (const fence of content.matchAll(/<!--\s*@banned:start\s*-->([\s\S]*?)<!--\s*@banned:end\s*-->/g)) {
    const block = parseBannedBlock(fence[1], skill, scope)
    if (!block.length) throw new Error(`${skill}: @banned block contains no tokens`)
    for (const token of block) if (!tokens.some(other => other.token === token.token)) tokens.push(token)
  }
  return tokens
}
