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

// A ban row lists only literals before the pipe. The note after it is free prose.
const ROW = /^- (Ban|Warn)(?: \((reference-video|edit)\))?: ((?:`[^`\n]+`)(?:, `[^`\n]+`)*)(?: \| (.+))?$/

export function parseGuideBans(skill: string, content: string, strict = false): BannedToken[] {
  const scope = /nano-banana|gpt-image|flux|seedream/.test(skill) ? 'image' : 'video'
  const tokens: BannedToken[] = []
  for (const fence of content.matchAll(/<!--\s*@banned:start\s*-->([\s\S]*?)<!--\s*@banned:end\s*-->/g)) {
    const lines = fence[1].replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    let count = 0
    for (const line of lines) {
      if (line.startsWith('**') || line.startsWith('- Guidance: ')) continue
      const row = ROW.exec(line)
      if (!row) {
        if (strict) throw new Error(`${skill}: expected a structured @banned row (- Ban: \`literal\` | explanation): ${line}`)
        continue // A cached older brain still serves its human-readable advice.
      }
      const [, action, condition, literals, explanation] = row
      for (const [, token] of literals.matchAll(/`([^`]+)`/g)) {
        count++
        tokens.push({ token, skill, scope, note: explanation || literals, checkable: action === 'Ban',
          ...(condition ? { when: condition as BannedTokenCondition } : {}) })
      }
    }
    if (strict && !count) throw new Error(`${skill}: @banned block contains no structured literals`)
  }
  return tokens
}
