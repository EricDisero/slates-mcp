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
//
// 🚨 A CHECKER NOBODY HAS SEEN FAIL IS NOT A CHECKER. Each of the four has been
// mutation-tested (break it, confirm red, restore, confirm green). If you add a
// fifth check, mutation-test it too or it is decoration.
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
 * Measured 2026-08-30, after the doctrine was cut back to what only IT can say:
 * 9,613 chars (preamble 429 / working method 1,650 / hard rules ~4,000 / guide
 * index ~3,400). It started at 37,976, of which the MODEL ROUTING table was
 * 17,700 and the full-description guide index 14,556 — 85% of the whole thing
 * in two blocks that mostly duplicated MODEL_CAPABILITIES, the rate functions
 * and the skills. Routing now rides the op that makes the choice; the index is
 * compressed to names plus a first sentence.
 *
 * ⚠️ AND THE INSTRUCTIONS WERE NEVER THE BIG NUMBER. Measured the same day, the
 * always-in-context total is ~63K chars: instructions 9.6K, op descriptions
 * 25K, op param descriptions 28K. If someone comes here to shrink the agent's
 * context, this constant is 15% of the problem — the tool surface is the rest.
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
  MODEL_FACTS,
  describeRouting,
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
  if (!/tools: ops\.map\(\(op\) => \(\{\s*name: op\.id,/.test(server)) {
    fail(CHECK, `${mcpServerPath}: ListTools no longer maps every op's own id — a surface-private tool can now hide here.`)
  }

  if (!existsSync(desktopOpsPath)) {
    warn(`sibling repo ../slate is not on disk — the DESKTOP half of checks 1 and 3 was skipped.`)
  } else {
    const ops = readFileSync(desktopOpsPath, 'utf8')
    if (!/const opTools: AnthropicTool\[\] = ALL_OPERATIONS\.map\(/.test(ops)) {
      fail(CHECK, `${desktopOpsPath}: buildTools() no longer maps ALL_OPERATIONS — the surfaces can now diverge.`)
    }
    // Exactly ONE loop-level tool is allowed past the shared registry, and it
    // is UI protocol (the cost-approval card), not a capability. Anything else
    // appearing here is a capability the MCP surface will never see.
    const extras = /cachedTools = \[\.\.\.opTools,\s*([A-Za-z0-9_,\s]*?)\]/.exec(ops)
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
  if (!/capabilities: \{ tools: \{\} \}, instructions \}/.test(server)) {
    fail(CHECK, `${mcpServerPath}: the Server is constructed without passing \`instructions\` — MCP clients get no doctrine at all, which is the exact regression this plan closed.`)
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
