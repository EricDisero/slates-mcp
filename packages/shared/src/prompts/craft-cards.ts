// ============================================================
// CRAFT CARDS — the POSITIVE half of "load the guide", made structural.
//
// THE MEASUREMENT THIS ANSWERS (2026-08-30, 48 trials at k=8, same brain, same
// scorer). Inlining each model's NEVER-USE list into the generate ops'
// descriptions moved `no_banned_tokens` from 0/8 to 30/32 — 94%. Over the same
// runs, `guide_before_generate` was 13% before and 13% after: the agent still
// did not fetch the skill. So the skill's NEGATIVE half became enforced and its
// POSITIVE half — the named lens, the light direction, the stock, the
// composition, the levers that make a shot GOOD rather than merely UN-BAD —
// still only arrived if the model chose to go and get it, and it usually did
// not.
//
// The lesson generalised in the CLAUDE.md rules: put the FACT where it cannot
// be skipped, not a POINTER to the fact. A card is that fact for the positive
// half — 250-400 words of the levers that matter for ONE model, delivered
// where the agent is already looking.
//
// 🚨 WHERE IT IS DELIVERED, AND WHY THERE. On the RESULT of
// `slates_estimate_generation_cost`, which the doctrine already tells the agent
// to call before every generation. That placement costs ZERO prefix bytes — the
// desktop's cached tool prefix is unchanged — and it arrives at the one moment
// the model has just named the model it is about to use. Putting it in the
// `model` param description instead would have grown the largest op on the
// surface by 15 cards on every turn of every session, to be read once.
//
// 🚨 THE CARD IS NEVER WRITTEN HERE. It is EXTRACTED from the skill file
// itself, between `<!-- @card:start -->` / `<!-- @card:end -->` markers — the
// same mechanism, and the same reason, as banned-tokens.ts: a card authored
// downstream is a second copy of the skill that drifts from it. Edit the skill;
// the card follows on the next build.
// ============================================================

import { SKILLS } from '../skills/content.js'

/**
 * Hard ceiling per card, in characters.
 *
 * A card is a CARD. The largest skill is 5,736 words and loading it whole is
 * exactly the cost this mechanism exists to avoid — if a card needs more than
 * this, the extra belongs in the body of the skill, which is one
 * `slates_get_prompting_guide` call away. Asserted at load, so an over-long
 * card fails the build rather than quietly inflating every estimate result.
 */
export const CRAFT_CARD_CEILING = 2400

const CARD_FENCE_RE = /<!--\s*@card:start\s*-->([\s\S]*?)<!--\s*@card:end\s*-->/g
/** Author notes to whoever edits the skill next; never part of the card. */
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g

function extractCard(skill: string, content: string): string | null {
  CARD_FENCE_RE.lastIndex = 0
  const parts: string[] = []
  let m: RegExpExecArray | null
  while ((m = CARD_FENCE_RE.exec(content)) !== null) {
    parts.push(m[1].replace(HTML_COMMENT_RE, '').trim())
  }
  if (parts.length === 0) return null
  const body = parts.join('\n\n').trim()
  if (body.length > CRAFT_CARD_CEILING) {
    throw new Error(
      `[craft-cards] ${skill}.md's @card block is ${body.length} chars, over the ` +
        `${CRAFT_CARD_CEILING} ceiling. A card rides EVERY estimate result for that model — ` +
        `move the overflow into the body of the skill, which slates_get_prompting_guide returns whole.`
    )
  }
  return body
}

/** Every card, keyed by skill name. Built once at load; integrity asserted. */
export const CRAFT_CARDS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(SKILLS)
      .map(([skill, content]) => [skill, extractCard(skill, content)] as const)
      .filter((entry): entry is readonly [string, string] => entry[1] !== null)
  )
)

/** The card for a skill, or null when that skill carries none. */
export function craftCard(skill: string): string | null {
  return CRAFT_CARDS[skill] ?? null
}

/**
 * The card as it appears in an op RESULT: the body, plus one line naming where
 * the rest lives so the agent knows the card is a summary and not the guide.
 */
export function describeCraftCard(skill: string): string {
  const card = craftCard(skill)
  if (!card) return ''
  return `${card}\n\nFull guide (examples, failure modes, sources): slates_get_prompting_guide("${skill}").`
}
