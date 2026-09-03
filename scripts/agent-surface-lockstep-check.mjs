// ============================================================
// AGENT SURFACE LOCKSTEP CHECK
//
// The capability layer has been SSOT since the ops registry was built, and it
// held. The GUIDANCE layer never was, and it drifted the moment a second
// surface existed: a 37K-character system prompt reached ONLY the desktop
// Studio Agent while the MCP server shipped no `instructions` at all.
//
// This script is the thing that keeps it from happening again. It asserts, on
// every build:
//
//   1. SURFACE PARITY   — both surfaces expose the same op id set, and neither
//                         has grown a private tool (the desktop's `present_plan`
//                         is the single documented exception).
//   2. MCP INSTRUCTIONS — the MCP server passes a non-empty `instructions`
//                         built from buildAgentDoctrine, within a pinned byte
//                         ceiling so growth is a review decision.
//   3. NO PRIVATE COPY  — neither consumer contains doctrine prose of its own.
//   4. BANNED TOKENS    — every token inlined into a generate op's description
//                         still appears inside its source skill's @banned
//                         block. The generation is real, not stale.
//   5. ROUTING PURITY   — MODEL_FACTS.notes stays ROUTING, and does not grow
//                         back into a fourth copy of the price list and the
//                         capability table.
//   6. ANNOTATIONS      — every op declares all four MCP hints, and none is
//                         CONTRADICTED by its own transport verbs. A
//                         `readOnlyHint` on an op that POSTs is the one lie
//                         that lets a host auto-approve a mutation.
//   7. SURFACE BUDGET   — the CORE tool surface stays under its byte ceiling,
//                         every deferred op is reachable through
//                         `slates_load_tools`, and the per-turn total is
//                         PRINTED so nothing downstream has to restate it.
//   8. CRAFT CARDS      — every per-model skill carries a card, under its
//                         ceiling, LEADING the file, naming at least five
//                         levers as backticked phrases; and the estimate op
//                         still attaches it.
//
// 🚨 A CHECKER NOBODY HAS SEEN FAIL IS NOT A CHECKER. Each of the eight has
// been mutation-tested (break it, confirm red, restore, confirm green). If you
// add a ninth, mutation-test it too or it is decoration.
//
// This is a SOURCE-LEVEL check for the two consumers on purpose. The desktop
// mapper lives in a sibling repo and imports Electron main-process modules and
// a path alias, so it cannot be imported here; the honest alternative to
// "import it and compare" is "assert the source still says what we claim it
// says", with anchors precise enough that a real change moves them.
//
// Sibling-repo rule (root CLAUDE.md): `../slate` may be absent — a clone of
// slates-mcp alone must still build. The desktop half SKIPS WITH A WARNING
// rather than failing, exactly like slates-web/scripts/check-price-lockstep.mjs.
// ============================================================

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')
const sharedRoot = join(repoRoot, 'packages', 'shared')
const skillsDir = join(sharedRoot, 'skills')
const mcpServerPath = join(repoRoot, 'packages', 'mcp', 'src', 'server.ts')
const desktopRoot = join(repoRoot, '..', 'slate')
const desktopContextPath = join(desktopRoot, 'src', 'main', 'studio-agent', 'context.ts')
const desktopOpsPath = join(desktopRoot, 'src', 'main', 'studio-agent', 'ops.ts')

/**
 * The MCP `instructions` string is injected into EVERY client session, in a
 * context we do not own and cannot cache. This ceiling is not a style rule —
 * it is the review trigger. Raise it deliberately, with a reason, never to make
 * a red build green.
 *
 * It started at 37,976, of which the MODEL ROUTING table was 17,700 and the
 * full-description guide index 14,556 — 85% of the whole thing in two blocks
 * that mostly duplicated MODEL_CAPABILITIES, the rate functions and the skills.
 * Routing now rides the op that makes the choice; the index is compressed to
 * names plus a first sentence. Check 2 PRINTS the current size every build —
 * read it there. (The figure that used to sit in this comment was 11% stale
 * within three days of being written, which is the whole argument for printing
 * a number rather than narrating it.)
 *
 * ⚠️ AND THE INSTRUCTIONS ARE NOT THE BIG NUMBER — the TOOL SURFACE is, by an
 * order of magnitude. Check 7 owns that ceiling and prints the per-turn total.
 * If you came here to shrink the agent's context, this constant is the small
 * end of the problem.
 */
const MCP_INSTRUCTIONS_CEILING = 14_000

const failures = []
const warnings = []
const fail = (check, msg) => failures.push(`[${check}] ${msg}`)
const warn = (msg) => warnings.push(msg)
const pass = (check, msg) => console.log(`  ok  ${check}: ${msg}`)

// ── comment stripping ───────────────────────────────────────────────────────
//
// Check 3 asks whether a consumer contains doctrine PROSE — text that reaches
// the model. A comment that NAMES the doctrine ("the MODEL ROUTING block lives
// in the shared module") is exactly the pointer we want people to write, so
// comments must be excluded or the check punishes good documentation. Done with
// a real scanner rather than a regex because `//` inside a string (a URL, a
// path) would otherwise eat the rest of the line and hide a violation.
function stripComments(src) {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    const next = src[i + 1]
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && next === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      out += c
      i++
      while (i < n) {
        if (src[i] === '\\') {
          out += src[i] + (src[i + 1] ?? '')
          i += 2
          continue
        }
        out += src[i]
        if (src[i] === quote) {
          i++
          break
        }
        i++
      }
      continue
    }
    out += c
    i++
  }
  return out
}

// ── 0. load the built package ───────────────────────────────────────────────
//
// The DIST, not the source: this runs after `tsc` in the build chain, and the
// dist is what both surfaces actually import. A check that reads the source
// could pass while the shipped artifact is stale.
const distIndex = join(sharedRoot, 'dist', 'index.js')
if (!existsSync(distIndex)) {
  console.error(
    `[agent-surface-lockstep] ${distIndex} is missing — run \`npm run build -w packages/shared\` first.`
  )
  process.exit(1)
}
const shared = await import(pathToFileURL(distIndex).href)
const {
  ALL_OPERATIONS,
  buildAgentDoctrine,
  BANNED_PROMPT_TOKENS,
  describeBannedTokens,
  bannedTokensForSkill,
  MODEL_FACTS,
  describeRouting,
  toolDefinitions,
  craftCard,
  CRAFT_CARD_CEILING,
  SKILLS,
} = shared

console.log('agent-surface-lockstep-check')

// ── 1. SURFACE PARITY ───────────────────────────────────────────────────────
{
  const CHECK = '1 surface-parity'
  const opIds = ALL_OPERATIONS.map((o) => o.id)
  const dupes = opIds.filter((id, i) => opIds.indexOf(id) !== i)
  if (dupes.length > 0) fail(CHECK, `duplicate op ids in ALL_OPERATIONS: ${dupes.join(', ')}`)

  const server = readFileSync(mcpServerPath, 'utf8')
  // The MCP tool list must be ALL_OPERATIONS and nothing else.
  if (!/const ops = ALL_OPERATIONS as readonly Operation<unknown>\[\]/.test(server)) {
    fail(CHECK, `${mcpServerPath}: the tool list is no longer \`ALL_OPERATIONS\` — parity is unprovable.`)
  }
  // ONE RENDERER, both surfaces. Two renderers meant "the same tools" was true
  // of the id set and unproven of the bytes.
  if (!/const TOOLS = toolDefinitions\(ops, \{ surface: 'mcp' \}\)/.test(server)) {
    fail(CHECK, `${mcpServerPath}: ListTools no longer renders through the shared \`toolDefinitions()\` — a surface-private tool or a divergent schema can now hide here.`)
  }
  if (!/tools: TOOLS\.map\(/.test(server)) {
    fail(CHECK, `${mcpServerPath}: ListTools no longer maps every rendered definition.`)
  }

  if (!existsSync(desktopOpsPath)) {
    warn(`sibling repo ../slate is not on disk — the DESKTOP half of checks 1 and 3 was skipped.`)
  } else {
    const ops = readFileSync(desktopOpsPath, 'utf8')
    if (!/toolDefinitions\(ALL_OPERATIONS,\s*\{\s*surface: 'desktop'/.test(ops)) {
      fail(CHECK, `${desktopOpsPath}: buildTools() no longer renders through the shared \`toolDefinitions()\` — the surfaces can now diverge in schema bytes, not just in ids.`)
    }
    // Exactly ONE loop-level tool is allowed past the shared registry, and it
    // is UI protocol (the cost-approval card), not a capability. Anything else
    // appearing here is a capability the MCP surface will never see.
    const extras = /const tools = \[\.\.\.opTools,\s*([A-Za-z0-9_,\s]*?)\]/.exec(ops)
    if (!extras) {
      fail(CHECK, `${desktopOpsPath}: could not find the buildTools() tool assembly — anchor moved, check is blind.`)
    } else {
      const names = extras[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (names.length !== 1 || names[0] !== 'PRESENT_PLAN_TOOL') {
        fail(
          CHECK,
          `${desktopOpsPath}: the desktop adds loop-level tools the MCP surface cannot see: ` +
            `${names.join(', ') || '(none parsed)'}. Only PRESENT_PLAN_TOOL is allowed — ` +
            `a new CAPABILITY belongs in ALL_OPERATIONS so both surfaces get it.`
        )
      }
    }
  }
  if (!failures.some((f) => f.startsWith(`[${CHECK}]`))) {
    pass(CHECK, `${opIds.length} ops, one registry, no surface-private capabilities`)
  }
}

// ── 2. MCP INSTRUCTIONS ─────────────────────────────────────────────────────
{
  const CHECK = '2 mcp-instructions'
  const server = readFileSync(mcpServerPath, 'utf8')
  if (!/const instructions = buildAgentDoctrine\(\{ surface: 'mcp' \}\)/.test(server)) {
    fail(CHECK, `${mcpServerPath}: \`instructions\` is not built from buildAgentDoctrine({ surface: 'mcp' }).`)
  }
  // `instructions` must reach the constructor. The capabilities object grew
  // (prompts, resources, logging), so the anchor is the field, not the literal.
  if (!/new Server\([\s\S]{0,600}?\n\s*instructions,\n\s*\}\n\s*\)/.test(server)) {
    fail(CHECK, `${mcpServerPath}: the Server is constructed without passing \`instructions\` — MCP clients get no doctrine at all, which is the exact regression this plan closed.`)
  }
  // The four protocol capabilities the 2026-09-02 review found unused. Each one
  // removes a reason the host has to route something through the model.
  for (const cap of ['tools', 'prompts', 'resources', 'logging']) {
    if (!new RegExp(`\\n\\s*${cap}: \\{\\}`).test(server)) {
      fail(CHECK, `${mcpServerPath}: the \`${cap}\` capability is no longer advertised.`)
    }
  }
  const mcp = buildAgentDoctrine({ surface: 'mcp' })
  const desktop = buildAgentDoctrine({ surface: 'desktop' })
  if (mcp.length === 0) fail(CHECK, 'buildAgentDoctrine({surface:"mcp"}) returned an empty string.')
  if (mcp.length > MCP_INSTRUCTIONS_CEILING) {
    fail(
      CHECK,
      `MCP instructions are ${mcp.length} chars, over the ${MCP_INSTRUCTIONS_CEILING} ceiling. ` +
        `This is injected into every client session with no prompt cache behind it. ` +
        `Cut it, or raise the ceiling deliberately with a reason in the constant's comment.`
    )
  }
  // Both surfaces must actually carry the shared spine. If a fork ever ate one
  // of these, the check that "the shared rules are one string" is worthless.
  // 'MODEL ROUTING' left this list on 2026-08-30: the block moved onto the ops
  // that make the decision, and asserting a phrase that now lives in an op
  // description would just re-pin the copy this change deleted.
  for (const spine of ['## How you work', '## Hard rules', '## Guide index', 'REAL NUMBERS ONLY', 'MODEL KINDS']) {
    if (!desktop.includes(spine)) fail(CHECK, `desktop doctrine is missing "${spine}".`)
    if (!mcp.includes(spine)) fail(CHECK, `mcp doctrine is missing "${spine}".`)
  }
  if (!failures.some((f) => f.startsWith(`[${CHECK}]`))) {
    pass(CHECK, `desktop ${desktop.length} chars, mcp ${mcp.length} chars (ceiling ${MCP_INSTRUCTIONS_CEILING})`)
  }
}

// ── 3. NO PRIVATE COPY OF THE DOCTRINE ──────────────────────────────────────
{
  const CHECK = '3 no-private-copy'
  const SENTINEL = ['SLATES', 'AGENT', 'DOCTRINE', 'SSOT'].join('-')
  const doctrineSrc = readFileSync(join(sharedRoot, 'src', 'prompts', 'agent-doctrine.ts'), 'utf8')
  if (!doctrineSrc.includes(SENTINEL)) {
    fail(CHECK, `agent-doctrine.ts no longer carries the ${SENTINEL} sentinel — check 3 is blind without it.`)
  }

  // Load-bearing phrases from the working method and the hard rules. Any of
  // these appearing in a CONSUMER (outside comments) means the doctrine has
  // been copied instead of composed.
  const DOCTRINE_PHRASES = [
    'UNDERSTAND the outcome',
    'ORIENT: call slates_get_workspace_state',
    'LOAD KNOWLEDGE ON DEMAND',
    'PLAN + GET APPROVAL',
    'QUALITY-CHECK: you have vision',
    'COST DISCIPLINE (slates-cost-discipline)',
    'CONTENT POLICY: before writing prompts',
    'PROMPT IS LAW',
    'RESOLUTION DEFAULT IS UNIFORM',
    'ASSET CODES + STALENESS',
    'CREDITS ONLY: every generation',
    'TOKEN DISCIPLINE: every tool result',
    'REAL NUMBERS ONLY — NEVER approximate',
    'MODEL IDS ARE FIXED',
    'AUDIO LENGTH IS PROMPT-DRIVEN',
    '- MODEL KINDS: image, video and audio models are disjoint',
  ]
  const consumers = [
    ['packages/mcp/src/server.ts', mcpServerPath],
    ['../slate/src/main/studio-agent/context.ts', desktopContextPath],
  ]
  for (const [label, path] of consumers) {
    if (!existsSync(path)) continue // sibling-absent case already warned in check 1
    const code = stripComments(readFileSync(path, 'utf8'))
    for (const phrase of DOCTRINE_PHRASES) {
      if (code.includes(phrase)) {
        fail(
          CHECK,
          `${label} contains doctrine prose ("${phrase}"). Consumers COMPOSE the doctrine, ` +
            `they never author it — move the line into agent-doctrine.ts (use fork() if it is ` +
            `only true on one surface).`
        )
      }
    }
    if (code.includes(SENTINEL)) {
      fail(CHECK, `${label} carries the ${SENTINEL} sentinel — it belongs only to agent-doctrine.ts.`)
    }
  }
  if (!failures.some((f) => f.startsWith(`[${CHECK}]`))) {
    pass(CHECK, `${consumers.length} consumer(s) compose the doctrine, none author it`)
  }
}

// ── 4. BANNED TOKENS ARE REAL AND REACH THE OPS ─────────────────────────────
{
  const CHECK = '4 banned-tokens'
  if (BANNED_PROMPT_TOKENS.length === 0) {
    fail(CHECK, 'BANNED_PROMPT_TOKENS is empty — the "load the guide" enforcement is off.')
  }
  const FENCE_RE = /<!--\s*@banned:start\s*-->([\s\S]*?)<!--\s*@banned:end\s*-->/g
  const fencedBySkill = new Map()
  for (const { skill } of BANNED_PROMPT_TOKENS) {
    if (fencedBySkill.has(skill)) continue
    const file = join(skillsDir, `${skill}.md`)
    if (!existsSync(file)) {
      fail(CHECK, `${skill}.md does not exist, but tokens are being generated from it.`)
      fencedBySkill.set(skill, '')
      continue
    }
    const md = readFileSync(file, 'utf8')
    let body = ''
    let m
    FENCE_RE.lastIndex = 0
    while ((m = FENCE_RE.exec(md)) !== null) body += m[1]
    if (body.trim() === '') {
      fail(
        CHECK,
        `${skill}.md has no @banned:start/@banned:end block. The op description is GENERATED ` +
          `from it — restore the markers rather than hand-typing the list downstream.`
      )
    }
    fencedBySkill.set(skill, body)
  }
  for (const { token, skill } of BANNED_PROMPT_TOKENS) {
    const body = fencedBySkill.get(skill) ?? ''
    if (!body.includes('`' + token + '`')) {
      fail(
        CHECK,
        `token "${token}" is inlined into an op description but no longer appears backticked ` +
          `inside ${skill}.md's @banned block — the generated list is stale.`
      )
    }
  }
  // …and the generated list must actually be IN the description. This is the
  // half that makes the enforcement structural: an op description is always in
  // context on both surfaces, so a token that reached it cannot be skipped.
  const byOp = [
    ['slates_generate_image', 'image'],
    ['slates_generate_video', 'video'],
  ]
  for (const [opId, scope] of byOp) {
    const op = ALL_OPERATIONS.find((o) => o.id === opId)
    if (!op) {
      fail(CHECK, `${opId} is not in ALL_OPERATIONS.`)
      continue
    }
    const generated = describeBannedTokens(scope)
    if (generated === '') {
      fail(CHECK, `describeBannedTokens('${scope}') is empty — nothing reaches ${opId}'s description.`)
      continue
    }
    if (!op.description.includes(generated)) {
      fail(
        CHECK,
        `${opId}'s description does not contain the generated ${scope} never-use list. ` +
          `Append \`describeBannedTokens('${scope}')\` to it — never hand-type the tokens.`
      )
    }
  }
  if (!failures.some((f) => f.startsWith(`[${CHECK}]`))) {
    pass(CHECK, `${BANNED_PROMPT_TOKENS.length} tokens, all traced to a skill and inlined into an op`)
  }
}


// ── 5. ROUTING PURITY ───────────────────────────────────────────────────────
//
// `notes` is the routing SSOT, and it had quietly become the dumping ground for
// everything that had nowhere else to go: 16,799 characters carrying 80
// resolution tokens, 42 duration claims, 23 hard-typed prices and two skills'
// worth of prompting craft — all of it in a prompt prefix that is ALWAYS in
// context, and all of it already owned by MODEL_CAPABILITIES, the rate
// functions, or a slates-prompting-* skill.
//
// Worse than the size: those prices contradicted the agent's own REAL NUMBERS
// ONLY rule, which forbids it repeating a figure it cannot point to in a tool
// result — so the prompt was handing the model 23 numbers it was told not to
// use, that went stale on the next rate change.
//
// Resolution words are NOT policed. "The only Seedance with native 4K" is a
// routing claim and there is no generated sentence that says it; the length cap
// is what stops the block re-inflating around them.
{
  const CHECK = '5 routing-purity'
  const SEP = String.fromCharCode(10)
  const MAX_NOTE = 700
  const BANNED = [
    [/\$\d/, 'a price — the rate functions own those, and REAL NUMBERS ONLY forbids the agent repeating a figure it cannot point to in a tool result'],
    [/\b\d[\d,]*\s*credits?\b/i, 'a credit figure — call slates_estimate_generation_cost instead'],
    [/\b\d+\s*(s|sec|seconds)\b/, 'a duration — MODEL_CAPABILITIES owns it and already generates it into the duration param'],
    [/\b\d+\s+(images?|clips?|files?|subjects?|references?|frames?)\b/i, 'a reference count — MODEL_CAPABILITIES owns it and already generates it'],
  ]
  for (const fact of MODEL_FACTS) {
    for (const [re, why] of BANNED) {
      const hit = re.exec(fact.notes)
      if (hit) {
        fail(
          CHECK,
          `MODEL_FACTS["${fact.id}"].notes contains ${JSON.stringify(hit[0])} — that is ${why}. ` +
            `notes is ROUTING ONLY: why you would pick this seat over its neighbour.`
        )
      }
    }
    if (fact.notes.length > MAX_NOTE) {
      fail(
        CHECK,
        `MODEL_FACTS["${fact.id}"].notes is ${fact.notes.length} chars, over the ${MAX_NOTE} cap. ` +
          `A routing note that needs a page is carrying something that belongs in a skill.`
      )
    }
  }
  // …and the ops must CONSUME the renderer rather than restating it. This is
  // the rule slates-mcp/CLAUDE.md already had and the video op broke for 1,282
  // characters.
  for (const [opId, kind, route] of [
    ['slates_generate_image', 'image', 'generate'],
    ['slates_generate_video', 'video', 'generate'],
  ]) {
    const op = ALL_OPERATIONS.find((o) => o.id === opId)
    if (!op) {
      fail(CHECK, `${opId} is not in ALL_OPERATIONS.`)
      continue
    }
    const generated = describeRouting(kind, route)
    // Joined, never JSON.stringify'd: that escapes the newlines inside the
    // generated block and the verbatim comparison can then never match.
    const surface = [op.description, ...zodDescriptions(op)].join(SEP)
    if (!surface.includes(generated)) {
      fail(
        CHECK,
        `${opId} does not carry describeRouting('${kind}', '${route}') verbatim. Routing prose is ` +
          `GENERATED — a hand-written model list here is a second copy that drifts.`
      )
    }
  }
  // 🚨 ORPHAN LANES. Every (kind, route) pair present in MODEL_FACTS must reach
  // an agent through some op, or those models are invisible: the fact compiles,
  // sits in the registry, and nothing ever tells the agent they exist. Audio
  // nearly shipped that way when buildModelRouting() filtered to two kinds while
  // the type union said three.
  //
  // This replaces a `console.error` that lived inside the prompt renderer and
  // was deleted with it. It is stronger in two ways: it FAILS THE BUILD, and it
  // asserts the routing actually REACHES a surface rather than that a filter
  // exists to drop it.
  const lanes = new Set(MODEL_FACTS.map((f) => `${f.kind}|${f.route}`))
  const everySurface = ALL_OPERATIONS.map((o) => [o.description, ...zodDescriptions(o)].join(SEP)).join(SEP)
  for (const lane of lanes) {
    const [kind, route] = lane.split('|')
    const rendered = describeRouting(kind, route)
    if (rendered && !everySurface.includes(rendered)) {
      fail(
        CHECK,
        `no op carries describeRouting('${kind}', '${route}') — every model in that lane is INVISIBLE ` +
          `to the agent. A MODEL_FACTS row whose lane reaches no op compiles, sits in the registry, ` +
          `and is never mentioned to anyone.`
      )
    }
  }
  if (!failures.some((f) => f.startsWith(`[${CHECK}]`))) {
    const total = MODEL_FACTS.reduce((n, f) => n + f.notes.length, 0)
    pass(
      CHECK,
      `${MODEL_FACTS.length} notes, ${total} chars total, no prices/durations/counts, ` +
        `${lanes.size} lanes all reach an op`
    )
  }
}

// ── 6. ANNOTATIONS ARE PRESENT AND DO NOT LIE ───────────────────────────────
//
// A `readOnlyHint: true` on an op that WRITES is the one annotation bug that
// actually costs something: a host reads it and auto-approves a mutation the
// user never saw. So this does not trust the declaration — it re-derives the
// verb from the op's OWN SOURCE (`desktop().post(`, `cloud().post(`) and
// compares. Mutation-tested: flip one op's id into READ_ONLY_PREFIXES in
// surface.ts and this goes red.
{
  const CHECK = '6 annotations'
  const HINTS = ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint']
  const opsSrc = readFileSync(join(sharedRoot, 'src', 'operations', 'index.ts'), 'utf8')

  /** The `run` body of one op, by source slicing between `id: '<id>'` and the
   *  next top-level `export const`. Crude on purpose: a parser here would be a
   *  second implementation of TypeScript to check four booleans. */
  const bodyOf = (id) => {
    const start = opsSrc.indexOf(`id: '${id}'`)
    if (start === -1) return null
    const next = opsSrc.indexOf('\nexport const ', start)
    return opsSrc.slice(start, next === -1 ? opsSrc.length : next)
  }

  /**
   * Ops that POST but READ. Each entry is a decision, not a waiver: the verb is
   * a proxy for "does this change anything", and these four are the places the
   * proxy is wrong. A new entry here needs a reason on the same line.
   */
  const READ_VIA_POST = new Map([
    ['slates_get_assets_batch', 'POSTs because the id LIST is the payload; it writes nothing'],
    ['slates_blender_status', 'runs a read-only scene summary over the bridge'],
    ['slates_blender_scene', 'runs a read-only scene summary over the bridge'],
    ['slates_blender_docs', 'reads the API reference the add-on ships'],
    ['slates_blender_search_docs', 'reads the API reference the add-on ships'],
  ])

  let missing = 0
  for (const op of ALL_OPERATIONS) {
    const a = op.annotations
    if (!a || HINTS.some((h) => typeof a[h] !== 'boolean')) {
      fail(CHECK, `${op.id} is missing one of ${HINTS.join('/')} — a host reads an absent hint as false, which is the wrong default for destructiveHint.`)
      missing++
      continue
    }
    if (op.billable && !a.openWorldHint) {
      fail(CHECK, `${op.id} is billable but not openWorldHint — every billable op reaches a provider outside this system.`)
    }
    if (a.readOnlyHint && a.destructiveHint) {
      fail(CHECK, `${op.id} claims to be both read-only and destructive.`)
    }
    const body = bodyOf(op.id)
    if (body === null) {
      fail(CHECK, `${op.id} has no findable source block — check 6 is blind for it.`)
      continue
    }
    // A write verb in the body: an HTTP post (with or without a type
    // parameter — `ctx.desktop().post(` and `desktop.post<T>(` are both real
    // call shapes here), or the blender execute path.
    const writes = /\.post\s*[<(]/.test(body) || /BlenderBridgeClient|client\.call\(/.test(body)
    if (a.readOnlyHint && writes && !READ_VIA_POST.has(op.id)) {
      fail(
        CHECK,
        `${op.id} is annotated readOnlyHint but its run body POSTs. A host auto-approves a read — ` +
          `this hint would let it auto-approve a mutation. Fix the derivation in operations/surface.ts.`
      )
    }
  }
  if (missing === 0 && !failures.some((f) => f.startsWith(`[${CHECK}]`))) {
    const reads = ALL_OPERATIONS.filter((o) => o.annotations.readOnlyHint).length
    const destructive = ALL_OPERATIONS.filter((o) => o.annotations.destructiveHint).length
    pass(CHECK, `${ALL_OPERATIONS.length} ops annotated (${reads} read-only, ${destructive} destructive), none contradicted by its own transport`)
  }
}

// ── 7. THE SURFACE BUDGET ───────────────────────────────────────────────────
//
// 🚨 THIS IS THE NUMBER THE 2026-09-02 REVIEW WAS ABOUT. Every Studio Agent
// turn sends the doctrine plus every CORE op's name, description and JSON
// schema. It was 112,114 bytes across 90 ops before the diet; the ceilings
// below are where it landed after (delete + compress + defer), pinned so the
// next 15 KB of prose is a review decision instead of an accident.
//
// ⚠️ THE PLAN'S TARGET WAS 60,000 AND THIS IS NOT THERE. What is left is not
// slack: `slates_generate_video`'s `model` param alone is ~4.8 KB of
// `describeRouting()`, which is the routing SSOT and belongs exactly where the
// model is chosen. Getting under 60 KB from here means either cutting the
// routing doctrine or deferring generation ops behind a fifth group — both of
// which are product decisions, not tidying. Raise these deliberately, with a
// reason, and never to make a red build green.
{
  const CHECK = '7 surface-budget'
  const CORE_CEILING = 68_000
  const PER_OP_CEILING = 14_000
  const core = toolDefinitions(ALL_OPERATIONS, { surface: 'desktop' })
  const bytes = (d) => Buffer.byteLength(d.name + d.description + JSON.stringify(d.inputSchema), 'utf8')
  const total = core.reduce((n, d) => n + bytes(d), 0)
  if (total > CORE_CEILING) {
    fail(
      CHECK,
      `the CORE tool surface is ${total} bytes, over the ${CORE_CEILING} ceiling. Every desktop turn ` +
        `pays for all of it. Cut prose, or defer an op into a slates_load_tools group — see operations/surface.ts.`
    )
  }
  for (const d of core) {
    const b = bytes(d)
    if (b > PER_OP_CEILING) {
      fail(CHECK, `${d.name} is ${b} bytes, over the ${PER_OP_CEILING} per-op ceiling.`)
    }
  }
  // Every deferred op must be reachable, or it is simply gone.
  const loader = ALL_OPERATIONS.find((o) => o.id === 'slates_load_tools')
  if (!loader) fail(CHECK, 'slates_load_tools is not in ALL_OPERATIONS — every extended op is unreachable from the desktop.')
  if (loader && loader.tier !== 'core') fail(CHECK, 'slates_load_tools is not itself core — nothing could ever load a group.')
  for (const op of ALL_OPERATIONS) {
    if (op.tier === 'extended' && !op.group) {
      fail(CHECK, `${op.id} is extended but names no group — it is deferred with no way to load it.`)
    }
  }
  if (!failures.some((f) => f.startsWith(`[${CHECK}]`))) {
    const all = toolDefinitions(ALL_OPERATIONS, { surface: 'mcp' }).reduce((n, d) => n + bytes(d), 0)
    pass(
      CHECK,
      `core ${core.length} ops / ${total} B (ceiling ${CORE_CEILING}), full surface ${ALL_OPERATIONS.length} ops / ${all} B, ` +
        `desktop per-turn ≈ ${total + Buffer.byteLength(buildAgentDoctrine({ surface: 'desktop' }), 'utf8')} B`
    )
  }
}

// ── 8. CRAFT CARDS AND PER-MODEL BANNED LISTS ───────────────────────────────
//
// The banned-token enforcement that measured 0/8 → 30/32 covered TWO skills of
// fifteen: `describeBannedTokens('image')` was Nano Banana's list and
// `('video')` was Seedance's. Every other model's prompt was matched against
// someone else's rules. And the POSITIVE half — the levers that make a shot
// good rather than merely un-bad — reached the model only if it chose to fetch
// the guide, which it did 13% of the time, before AND after.
{
  const CHECK = '8 craft-cards'
  const perModel = Object.keys(SKILLS).filter((n) => n.startsWith('slates-prompting-'))
  for (const skill of perModel) {
    if (!craftCard(skill)) {
      fail(CHECK, `${skill}.md has no <!-- @card:start --> block. The card is the ONE piece of positive craft guidance that reaches the agent without a fetch — write one, 250-400 words.`)
    }
    if (bannedTokensForSkill(skill).length === 0) {
      fail(CHECK, `${skill}.md has no @banned block with backticked tokens. Its prompts are matched against another model's never-use list.`)
    }
    const card = craftCard(skill)
    if (card && card.length > CRAFT_CARD_CEILING) {
      fail(CHECK, `${skill}'s card is ${card.length} chars, over the ${CRAFT_CARD_CEILING} ceiling.`)
    }
    // 🚨 A CARD MUST NAME ITS LEVERS AS LITERAL PHRASES. The eval scorer's
    // `craft_levers_present` reads the BACKTICKED spans out of the card — never
    // a hand-typed word list, for the same reason `banned.mjs` imports its list
    // rather than retyping it. A card of pure prose teaches nothing checkable
    // and scores every prompt the same.
    const ticks = card ? (card.match(/`[^`\n]+`/g) ?? []).length : 0
    if (card && ticks < 5) {
      fail(
        CHECK,
        `${skill}'s card has ${ticks} backticked lever phrase(s), under the 5 minimum. ` +
          `Write the levers as literal phrases (\`slow push in\`, \`85mm f/1.4\`) — that is what the ` +
          `agent copies and what craft_levers_present scores.`
      )
    }
    // 🚨 THE CARD LEADS. `slates install-skills` writes each file verbatim into
    // .claude/skills/<name>/SKILL.md, and Claude Code's skill preview shows the
    // TOP of the file — so a card buried on page four is a card nobody sees
    // when deciding whether to load the skill. First quarter, measured on the
    // raw file, so this cannot be satisfied by a short skill alone.
    const raw = SKILLS[skill] ?? ''
    const at = raw.indexOf('@card:start')
    if (at !== -1 && at > raw.length * 0.25) {
      fail(
        CHECK,
        `${skill}.md's @card block starts ${Math.round((at / raw.length) * 100)}% of the way in. ` +
          `It must lead — the installed SKILL.md is what a skill preview shows, and the levers are what makes it worth loading.`
      )
    }
  }
  // …and the card must actually REACH an agent. It rides the estimate result;
  // an estimate op that stopped attaching it would silently undo all of this.
  const estimateSrc = readFileSync(join(sharedRoot, 'src', 'operations', 'index.ts'), 'utf8')
  if (!/craft_card: card/.test(estimateSrc) || !/describeCraftCard\(skill\)/.test(estimateSrc)) {
    fail(CHECK, `slates_estimate_generation_cost no longer attaches the craft card to its result — the positive half reaches nobody again.`)
  }
  if (!failures.some((f) => f.startsWith(`[${CHECK}]`))) {
    const total = perModel.reduce((n, s) => n + (craftCard(s)?.length ?? 0), 0)
    pass(CHECK, `${perModel.length} per-model skills, all carrying a card (${total} chars total) and their own never-use list`)
  }
}

/** Every `.describe()` string on an op's input schema, for substring checks. */
function zodDescriptions(op) {
  const out = []
  const shape = op.input?._def?.shape?.() ?? {}
  for (const key of Object.keys(shape)) {
    let node = shape[key]
    // unwrap optional/default/nullable chains
    for (let i = 0; i < 6 && node?._def; i++) {
      if (node._def.description) out.push(node._def.description)
      node = node._def.innerType ?? node._def.schema ?? null
      if (!node) break
    }
  }
  return out
}

// ── report ──────────────────────────────────────────────────────────────────
for (const w of warnings) console.warn(`  !!  skipped: ${w}`)
if (failures.length > 0) {
  console.error('\nagent-surface-lockstep-check FAILED:')
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log('agent-surface-lockstep-check passed')
