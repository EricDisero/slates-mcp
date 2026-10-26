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

import { brainFiles, servedBrain, type ServedBrain } from '../skills/served.js'
import { splitOverlay } from './brain.js'

/**
 * Hard ceiling per card, in characters.
 *
 * A card is a CARD. The largest skill is 5,736 words and loading it whole is
 * exactly the cost this mechanism exists to avoid — if a card needs more than
 * this, the extra belongs in the body of the skill, which is one
 * `slates_get_prompting_guide` call away. check:agent-surface § 8 fails the build on an over-long card; a served
 * brain arrives at run time, so there an over-long card is skipped and named (oversizedCraftCards), never thrown.
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
        `move the overflow into the body of the skill, retrieved with slates_get_prompting_guide depth: full.`
    )
  }
  return body
}

/**
 * Every card, keyed by skill name, from the brain this process holds (skills/served.ts): rebuilt when that brain
 * changes, integrity asserted on each build. Model guides are served by tier, so without a brain there are none.
 */
let built: { brain: ServedBrain; cards: Readonly<Record<string, string>>; oversized: readonly string[] } | undefined
function build(): NonNullable<typeof built> {
  const brain = servedBrain()
  if (built?.brain !== brain) {
    const cards: Record<string, string> = {}
    const oversized: string[] = []
    for (const [skill, content] of Object.entries(brainFiles())) {
      try {
        const card = extractCard(skill, content)
        if (card !== null) cards[skill] = card
      } catch (error) {
        // One over-long card must not take down every estimate: that guide goes without a card, and says why.
        oversized.push(skill)
        console.error(String((error as Error).message))
      }
    }
    built = { brain, cards: Object.freeze(cards), oversized: Object.freeze(oversized) }
  }
  return built
}
const cards = (): Readonly<Record<string, string>> => build().cards

/** The guides in the held brain whose card is over the ceiling and so rides no estimate result. */
export function oversizedCraftCards(): readonly string[] {
  return build().oversized
}

/** A live view of cards(), so `CRAFT_CARDS[name]`, `in` and `Object.keys` follow the served brain. */
export const CRAFT_CARDS: Readonly<Record<string, string>> = new Proxy({} as Record<string, string>, {
  get: (_, key) => (typeof key === 'string' ? cards()[key] : undefined),
  has: (_, key) => typeof key === 'string' && Object.hasOwn(cards(), key),
  ownKeys: () => Reflect.ownKeys(cards()),
  getOwnPropertyDescriptor: (_, key) =>
    typeof key === 'string' && Object.hasOwn(cards(), key) ? { value: cards()[key], enumerable: true, configurable: true, writable: false } : undefined,
  set: () => false,
})

/** The card for a skill, or null when that skill carries none. */
export function craftCard(skill: string): string | null {
  return CRAFT_CARDS[skill] ?? null
}

/**
 * The card inside this content: the bundled card when the content is the bundled skill, else the content's own.
 * A My brain file laid over a model guide (brain.ts, overlayGuide) gives its own card first, as the rules that
 * win, then the shared card. An oversized card in a user's file reads as none, so the guide falls back to its
 * summary instead of throwing.
 */
export function craftCardOf(skill: string, content: string): string | null {
  if (brainFiles()[skill] === content) return craftCard(skill)
  const overlay = splitOverlay(content)
  if (overlay) {
    const own = craftCardOf(skill, overlay.theirs)
    const shared = craftCard(skill) ?? craftCardOf(skill, overlay.shared)
    if (!own || !shared) return own ?? shared
    return `Their card (My brain), which wins where they differ:\n${own}\n\nThe shared card:\n${shared}`
  }
  try {
    return extractCard(skill, content)
  } catch {
    return null
  }
}

/**
 * The card as it appears in an op RESULT: the body, plus one line naming where
 * the rest lives so the agent knows the card is a summary and not the guide.
 * `content` is the skill as this user's brain serves it (brainSkills().skills),
 * so a card from their My brain rides; without it, the bundled card.
 */
export function describeCraftCard(skill: string, content?: string): string {
  const card = content === undefined ? craftCard(skill) : craftCardOf(skill, content)
  if (!card) return ''
  return `${card}\n\nFull guide (examples, failure modes, sources): slates_get_prompting_guide({topic: "${skill}", depth: "full"}); use query for one section.`
}
