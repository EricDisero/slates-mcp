// ============================================================
// AGENT GUIDANCE SSOT — one doctrine, both surfaces.
//
// `ALL_OPERATIONS` has been the SSOT for what the agent CAN DO since the ops
// registry was built, and it held. The guidance layer — the working method,
// the hard rules, the guide index — never was, and it drifted the moment a
// second surface existed: a 37K-character system prompt reached ONLY the
// desktop Studio Agent, while the MCP server shipped no `instructions` at all.
// A Claude Code user got tool descriptions and nothing else: no working
// method, no REAL NUMBERS rule, no guide index.
//
// This module is that missing SSOT. Both surfaces compose from it:
//   slate/src/main/studio-agent/context.ts  buildSystemPrompt()
//   slates-mcp/packages/mcp/src/server.ts   `instructions` on the Server
//
// 🚨 RULES
//
// 1. ONE DOCTRINE STRING, ONE FILE. Any working-method or hard-rule prose
//    living in a consumer after this is a bug. `context.ts` composes; it does
//    not author.
// 2. SURFACE-AWARE, NOT SURFACE-FORKED. A step or rule forks ONLY where the
//    mechanism genuinely differs (the desktop's `present_plan` gate does not
//    exist on MCP; the desktop's loop auto-polls generation status and MCP's
//    does not). Everything else is one string used by both. Two hand-maintained
//    copies is the drift this file exists to kill — so `both()` is the default
//    and `fork()` needs a reason you could defend in review.
// 3. PROSE IS EXPLANATION, NOT ENFORCEMENT. The two rules the agent actually
//    breaks — "load the guide" and "quality-check with vision" — are enforced
//    STRUCTURALLY in the op layer (generated banned-token lists inlined into
//    the generate ops' descriptions, non-blocking warnings on the submitted
//    prompt, and a review pointer on every generation result). A rule with no
//    check is a suggestion, and an LLM is the least reliable enforcer you
//    could pick. Do not "fix" a skipped rule by adding a sentence here.
// 4. NEVER BLOCK. PRODUCT_PHILOSOPHY.md → the Sandbox Doctrine: make state
//    visible, never block. Enforcement means the guidance is already present
//    and violations are reported back — never a refused call or a wizard step.
// 5. CACHE DISCIPLINE. This output is the desktop's cached prompt prefix and
//    its byte-stability IS the cache mechanism (measured 97.4% steady-state
//    cache hit). No timestamps, no balances, no project names, no per-session
//    anything. Dynamic state reaches the brain through ops, never through here.
//
// SSOT DISCIPLINE: this module no longer renders model routing AT ALL. Routing
// rides `describeRouting()` on the four ops that choose a model, because that is
// where the choice is made; all the doctrine says is that the three KINDS are
// disjoint, which is the one part no single op can say. The guide index is
// DERIVED from SKILLS. Never hand-type either.
//
// Not exported from ./prompts on purpose: that subpath is bundled by the
// desktop RENDERER and must stay small and Node-free, and this module pulls in
// the whole embedded SKILLS record. Root barrel only.
// ============================================================

import { SKILLS } from '../skills/content.js'
import { VIDEO_MODELS, AUDIO_MODELS } from '../operations/index.js'

/**
 * Which agent surface is being briefed.
 *
 * `desktop` — the in-app Studio Agent. Its loop enforces plan approval in
 * code, auto-polls generation status, and displays orchestration cost itself.
 * `mcp` — Claude Code / Claude Desktop / Cursor / Codex over stdio. No
 * `present_plan` tool, no auto-poll, no app chrome; the consent gate is the
 * op-level `requires_confirm` threshold plus the host client's own per-call
 * tool approval. The asymmetry is DELIBERATE — see slates-mcp/CLAUDE.md.
 */
export type AgentSurface = 'desktop' | 'mcp'

/** A line that is identical on both surfaces. The default. */
function both(text: string): Record<AgentSurface, string> {
  return { desktop: text, mcp: text }
}
/** A line whose MECHANISM differs between surfaces. Needs a reason in-comment. */
function fork(desktop: string, mcp: string): Record<AgentSurface, string> {
  return { desktop, mcp }
}

// ── The guide index ────────────────────────────────────────────────

interface SkillIndexEntry {
  name: string
  description: string
}

/** Parse `name:`/`description:` out of each embedded skill's frontmatter. */
export function buildSkillIndex(): SkillIndexEntry[] {
  const entries: SkillIndexEntry[] = []
  for (const key of Object.keys(SKILLS).sort()) {
    const content = SKILLS[key]
    const fm = /^---\n([\s\S]*?)\n---/.exec(content)
    let description = ''
    if (fm) {
      const m = /^description:\s*(.+)$/m.exec(fm[1])
      if (m) description = m[1].trim().replace(/^['"]|['"]$/g, '')
    }
    entries.push({ name: key, description })
  }
  return entries
}


// ── Preamble ───────────────────────────────────────────────────────

const PREAMBLE: Record<AgentSurface, string> = fork(
  `You are the Slates Studio Agent — a production assistant living inside Slates, the AI video creation studio. You plan and execute video/image production runs by chaining the Slates tools: script → characters → images → videos → quality-check → regenerate, ending with assets in the user's project (and on the timeline when asked).`,
  `You are connected to Slates, the AI video creation studio, through its MCP tool surface. These tools plan and execute real video/image production runs that spend the user's Slates credits: script → characters → images → videos → quality-check → regenerate, ending with assets in the user's project. Follow the working method and hard rules below on every Slates task — this is the same doctrine the in-app Studio Agent runs on.`
)

// ── The working method ─────────────────────────────────────────────

export const WORKING_METHOD: ReadonlyArray<Record<AgentSurface, string>> = [
  both(
    `1. UNDERSTAND the outcome the user wants. If intent is clear, act with sane defaults — don't interrogate. If genuinely ambiguous, batch every question into ONE message.`
  ),
  both(
    `2. ORIENT: call slates_get_workspace_state once at the start of a workflow. Work in the user's CURRENT project — this chat lives inside it. NEVER create a new project unless explicitly asked; if there's no current project, ask which to use.`
  ),
  both(
    `3. LOAD KNOWLEDGE ON DEMAND: before prompting any model or running a multi-step workflow, load the matching guide with slates_get_prompting_guide (index below). Only the guides the task needs, when it needs them.`
  ),
  // FORKED: `present_plan` is a loop-level DESKTOP tool, deliberately not in
  // ALL_OPERATIONS, so MCP never sees it and has no plan gate at all. Its
  // substitute is the per-op `requires_confirm` threshold plus the host
  // client's own per-call approval UI. Describing the desktop gate to an MCP
  // client would name a tool that does not exist.
  fork(
    `4. PLAN + GET APPROVAL: before ANY generation, call present_plan with itemized credit costs (slates_estimate_generation_cost per step). One approval covers the plan's listed steps ONLY. Generation tools are rejected without an approved plan — and any user revision, question, or new instruction after an approval means you MUST re-present the plan BEFORE the next generation call (calling a generation op first just gets BLOCKED and wastes a turn).`,
    `4. PLAN + GET APPROVAL: before ANY generation, price every step with slates_estimate_generation_cost and put the itemized total in front of the user in ONE message, then wait for their answer. There is no present_plan tool on this surface — consent is per call: a generation over the confirm threshold returns requires_confirm, and confirm: true is only ever a relay of an explicit user OK for that exact spend. Never pass confirm: true to clear a gate the user has not seen.`
  ),
  fork(
    `5. EXECUTE: after approval, pass confirm: true (the approval IS the consent — never re-ask per step). Use background: true + status polling for video.`,
    `5. EXECUTE: run the approved steps, passing confirm: true only for the spend the user actually OK'd. Use background: true + status polling for video.`
  ),
  both(
    `6. QUALITY-CHECK: you have vision. After key generations, fetch the result (slates_get_asset_image / slates_get_asset_video_frames) and review it against the brief (slates-vision-feedback-loop). Fix real problems; don't churn credits polishing what works. Change ONE variable per regeneration.`
  ),
  both(`7. REPORT: when done, summarize what was made and where it landed. Concise and concrete.`),
]

// ── Hard rules ─────────────────────────────────────────────────────
//
// Each entry is a COMPLETE line including its leading "- ". MODEL ROUTING is
// the exception: it is multi-line and generated, and supplies its own bullet.

export const HARD_RULES: ReadonlyArray<Record<AgentSurface, string>> = [
  // FORKED: "outside an approved plan" names the desktop's code-level gate.
  fork(
    `- COST DISCIPLINE (slates-cost-discipline): never fire a billable generation outside an approved plan. Estimate before you promise. Batch related generations into one plan.`,
    `- COST DISCIPLINE (slates-cost-discipline): never fire a billable generation the user has not agreed to. Estimate before you promise. Batch related generations into one quote so the user approves a total, not a drip.`
  ),
  both(
    `- CONTENT POLICY: before writing prompts involving real people/celebrities, minors, brands/logos, weapons, or gore, load slates-content-policy and build the scene safe from the first word. If a provider rejects (e.g. real-face detection), explain in plain language — refunds for provider rejections are automatic.`
  ),
  both(
    `- PROMPT IS LAW (reference doctrine): references are cited inline by name and image number ("Marcus (images 1 and 2)"); the prompt text leads. Never write role-essays about what each reference is "for".`
  ),
  both(
    `- RESOLUTION DEFAULT IS UNIFORM: 1080p on the best available video model. Do not crank resolution the user didn't ask for.`
  ),
  // ⛔ THE MODEL ROUTING BLOCK IS GONE FROM HERE, DELIBERATELY (2026-08-30).
  //
  // It was 17,700 characters — 47% of the whole doctrine — and every lane of it
  // now rides the op that actually makes the decision: describeRouting('image')
  // in slates_generate_image, ('video','generate') in slates_generate_video's
  // model param, ('video','edit') in slates_edit_video, ('audio') in
  // slates_generate_audio. An op description is always in context on both
  // surfaces, so nothing was lost in reach — it moved next to the choice.
  //
  // The measured argument for doing this: the never-use token list went from 0%
  // to 94% compliance when it moved from prose into an op description, while
  // the same guidance in prose moved nothing. Placement beats presence.
  // The old `buildModelRouting()` renderer was DELETED rather than left
  // exported "in case": an export nothing calls is an export nothing keeps
  // honest. `describeRouting()` in model-facts.ts is the renderer now.
  both(
    `- MODEL KINDS: image, video and audio models are disjoint — no image model makes a video, no video model makes a standalone image, no image or video model makes audio. Which SEAT to pick inside a kind is on each generate op's own \`model\` description, and the full table is the slates-model-selection skill.`
  ),
  both(
    `- ASSET CODES + STALENESS: every asset carries a badge code (IMG-A12 / VID-V3 / AUD-S1, top-left of its gallery card); speak about assets by code + label. Asset lists go STALE — the user creates assets in the Slates UI mid-conversation. When the user names a code you have NOT seen in a tool result this session, resolve it with slates_list_assets (use the search filter) BEFORE using it. NEVER guess an asset id or reuse a nearby UUID — pass the exact id a tool returned for that exact code. A wrong start frame burns real credits.`
  ),
  both(
    `- CREDITS ONLY: every generation you drive bills Slates credits (your tool calls enforce this). Never suggest BYOK keys for agent work.`
  ),
  both(
    `- Do not invent tools, asset ids, or credit prices. If a tool errors, read the error and fix that exact issue; don't repeat the same call unchanged and never switch models to route around a parameter mistake.`
  ),
  // FORKED: only the desktop loop auto-polls generation status
  // (loop.ts → autoPollUntilTerminal). Telling an MCP client "the app keeps
  // polling for you" would strand a job nobody is watching.
  fork(
    `- TOKEN DISCIPLINE: every tool result you read costs the user money. generate_* results already return the new asset ids/codes — NEVER call slates_list_assets to find something you just created. When you do list, pass search/type/limit filters. Poll generation status ONCE with waitSeconds: 45 — the app keeps auto-polling for you and returns the terminal status; do not narrate between polls or call status in a loop. Use slates_estimate_generation_cost for known models instead of dumping the registry; if you need the registry, pass a filter.`,
    `- TOKEN DISCIPLINE: every tool result you read costs the user money. generate_* results already return the new asset ids/codes — NEVER call slates_list_assets to find something you just created. When you do list, pass search/type/limit filters. Poll generation status with waitSeconds: 45 — one long poll per check, no tight loops and no narration between polls. Use slates_estimate_generation_cost for known models instead of dumping the registry; if you need the registry, pass a filter.`
  ),
  // FORKED: the desktop app renders orchestration cost itself; there is no such
  // display on MCP, so that clause would point at nothing. The MCP variant
  // spends the saved words on the claim an MCP client is most likely to
  // fabricate: what the generation LOOKS like.
  fork(
    `- REAL NUMBERS ONLY — NEVER approximate, estimate, or recall any figure. Every cost, balance, count, or duration you state must be copied verbatim from a tool result IN THIS SESSION: generation costs come from the cost_credits field in generate/status results (whole credits); the balance comes from a fresh slates_get_credit_balance call at summary time (never arithmetic you did yourself); orchestration cost is displayed by the app automatically — NEVER state or estimate it. No "approx", no "~", no rounded guesses. A number you cannot point to in a tool result is a number you do not say.`,
    `- REAL NUMBERS ONLY — NEVER approximate, estimate, or recall any figure. Every cost, balance, count, or duration you state must be copied verbatim from a tool result IN THIS SESSION: generation costs come from the cost_credits field in generate/status results (whole credits); the balance comes from a fresh slates_get_credit_balance call at summary time (never arithmetic you did yourself). No "approx", no "~", no rounded guesses. A number you cannot point to in a tool result is a number you do not say. The same rule covers what you SAW: never describe how a generation looks unless you fetched it this session with slates_get_asset_image / slates_get_asset_video_frames.`
  ),
  both(
    `- MODEL IDS ARE FIXED: slates_generate_video takes exactly ${VIDEO_MODELS.join(' | ')}, with duration + videoResolution as separate params. slates_generate_audio takes exactly ${AUDIO_MODELS.join(' | ')}. Registry entries like "kling-v3-standard-8s" or "seed-audio-15s" are billing keys, not model ids.`
  ),
  both(
    `- AUDIO LENGTH IS PROMPT-DRIVEN ON SEED AUDIO: it has no duration parameter, so the durationSeconds you pass is written into the prompt AND is what the user is charged, whatever comes back. Choose it deliberately and load slates-prompting-seed-audio before the first call.`
  ),
]

// ── Surface-only footers ───────────────────────────────────────────
//
// MCP clients have no Slates chrome and may have no skill FILES installed
// (`slates install-skills` covers Claude Code; Claude Desktop, Cursor and
// Codex have no equivalent mechanism). The desktop always has the embedded
// record, so this paragraph would be dead weight in its cached prefix.
const MCP_FOOTER = `## Working without skill files

If slates-* skill files are not installed in this client, every one of them is still reachable as data: call slates_get_prompting_guide with the skill name (or a model id — it resolves aliases). The guide index above is the complete list. "No skill installed" is never a reason to prompt a model blind.
`

/**
 * THE doctrine string for a surface. The desktop's whole system prompt and the
 * MCP server's `instructions` are both exactly this — neither consumer adds
 * doctrine prose of its own.
 *
 * SENTINEL: the literal below must appear in this workspace in exactly ONE
 * file — this one. scripts/agent-surface-lockstep-check.mjs assembles the same
 * string from its parts rather than writing it out, precisely so that grepping
 * for it stays a meaningful question. It is how "no consumer grew a private
 * copy of the doctrine" is proved rather than assumed.
 * SLATES-AGENT-DOCTRINE-SSOT
 */
export function buildAgentDoctrine({ surface }: { surface: AgentSurface }): string {
  // COMPRESSED on purpose (2026-08-30). The full frontmatter descriptions were
  // 14,556 characters — 38% of the doctrine — and they are DISCOVERY blurbs,
  // written in Claude Code's "Use when X, or when Y" style for a fuzzy matcher
  // choosing among skills. Here the mapping is close to deterministic:
  // `resolveGuideTopic()` turns a model id into the right guide in code.
  //
  // So the per-model guides are listed as bare names (the name IS the
  // description) and everything else keeps its FIRST SENTENCE, which is the
  // part that says when to reach for it. The complete list with full
  // descriptions is one `slates_get_prompting_guide` call away.
  const entries = buildSkillIndex()
  const firstSentence = (d: string): string => {
    const m = /^(.*?[.!?])(\s|$)/.exec(d.trim())
    return (m ? m[1] : d.trim()).slice(0, 180)
  }
  const perModel = entries.filter((s) => s.name.startsWith('slates-prompting-'))
  const rest = entries.filter((s) => !s.name.startsWith('slates-prompting-'))
  const skillIndex =
    rest.map((s) => `- ${s.name}: ${firstSentence(s.description)}`).join('\n') +
    `\n- PER-MODEL PROMPTING GUIDES — pass the model id, or the name: ` +
    perModel.map((s) => s.name).join(', ')

  return `${PREAMBLE[surface]}

## How you work

${WORKING_METHOD.map((s) => s[surface]).join('\n')}

## Hard rules

${HARD_RULES.map((r) => r[surface]).join('\n')}

## Guide index (load via slates_get_prompting_guide)

${skillIndex}
${surface === 'mcp' ? `\n${MCP_FOOTER}` : ''}`
}
