#!/usr/bin/env node
// Does the MCP server actually PUT the doctrine on the wire?
//
// The lockstep check proves we pass `instructions` into `new Server(...)`. That
// is a source-level claim. This spawns the real stdio server, does a real
// initialize handshake with the real SDK client, and reads `instructions` back
// off the InitializeResult — the same field a Claude Code / Cursor / Codex
// session receives.
//
// It cannot prove a given CLIENT reads or keeps them (that is the human check in
// slate/docs/testing/2026-08-30-agent-guidance-ssot.md), but it closes the gap
// between "we set the field" and "the field arrives".
//
//   node scripts/mcp-instructions-smoke.mjs
//
// No credentials needed: initialize happens before any tool call, so nothing
// here touches slates-api or the desktop.

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const serverPath = join(here, '..', 'packages', 'mcp', 'dist', 'server.js')

if (!existsSync(serverPath)) {
  console.error(`[mcp-smoke] ${serverPath} missing — run \`npm run build\` first.`)
  process.exit(1)
}

let failures = 0
const check = (name, cond, detail = '') => {
  if (cond) {
    console.log(`  ok  ${name}`)
    return
  }
  failures++
  console.error(`  !! ${name}${detail ? ` — ${detail}` : ''}`)
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  stderr: 'pipe',
})
const client = new Client({ name: 'slates-instructions-smoke', version: '1.0.0' })

await client.connect(transport)

const instructions = client.getInstructions()
const tools = (await client.listTools()).tools

console.log('mcp-instructions-smoke')
check(
  'the server sends `instructions` at all',
  typeof instructions === 'string' && instructions.length > 0
)

if (typeof instructions === 'string') {
  // The spine. If a fork ever ate one of these, an MCP client would be briefed
  // on less than the desktop is and nobody would notice until a user did.
  for (const spine of [
    '## How you work',
    '## Hard rules',
    '## Guide index',
    'LOAD KNOWLEDGE ON DEMAND',
    'REAL NUMBERS ONLY',
    // 'MODEL ROUTING' became 'MODEL KINDS' on 2026-08-30: the per-seat table
    // moved onto the ops that make the choice, and what stays in the
    // instructions is the one thing no single op can say — that the three
    // kinds are disjoint.
    'MODEL KINDS',
    'slates_get_prompting_guide',
  ]) {
    check(`instructions carry "${spine}"`, instructions.includes(spine))
  }
  // The MCP fork: `present_plan` is a DESKTOP loop-level tool this surface never
  // sees, so naming it here would send a client after a tool that does not exist.
  check(
    'instructions do NOT name present_plan (a desktop-only tool)',
    !instructions.includes('call present_plan'),
    'the mcp fork of working-method step 4 has regressed to the desktop text'
  )
  check(
    'instructions tell a client with no skill files what to do',
    instructions.includes('Working without skill files')
  )
  console.log(`  ..  ${instructions.length} chars of instructions on the wire`)
}

check('tool list is non-empty', tools.length > 0, `${tools.length}`)
const generateImage = tools.find((t) => t.name === 'slates_generate_image')
check('slates_generate_image is exposed', !!generateImage)
if (generateImage) {
  // The structural half of "load the guide": the never-use list rides the
  // description, which every client has in context with no call required.
  check(
    'its description carries the generated never-use list',
    generateImage.description.includes('NEVER put these in a prompt'),
    generateImage.description.slice(-160)
  )
  check(
    'and the tokens really came from the skill',
    generateImage.description.includes('"photorealistic"') &&
      generateImage.description.includes('"cinematic"')
  )
}

// ── the enforcement, end to end, through the real MCP call path ────────────
//
// `slates_generate_image` computes the prompt warning and then hits its
// clarification gate (aspectRatio + resolution are mandatory) BEFORE it touches
// any transport. So this round-trips a real CallTool through the real op and
// reads the real warning back, with no credentials, no network and no spend —
// which is the only part of "does the MCP surface enforce this too" that can be
// asserted without an LLM driving the client. What it cannot cover is whether
// the client's own model then ACTS on it; that is the honest limit of measuring
// a surface whose model and system prompt we do not own.
{
  const res = await client.callTool({
    name: 'slates_generate_image',
    arguments: {
      prompt:
        'A chestnut horse galloping across a golden meadow at sunset, warm cinematic light, photorealistic',
    },
  })
  const text = (res.content ?? []).map((c) => c.text ?? '').join('\n')
  // The op returns a JSON payload, so assert against the PARSED object rather
  // than the serialized text — a substring check for a quoted token is defeated
  // by nothing more than JSON escaping the quotes around it.
  let payload = {}
  try {
    payload = JSON.parse(text)
  } catch {
    /* leave it empty; the checks below report the failure with the raw text */
  }
  const warning = payload.prompt_warning ?? ''
  check(
    'a banned-token prompt comes back with a warning over MCP',
    warning.includes('PROMPT WARNING'),
    text.slice(0, 200)
  )
  check(
    'the warning names the tokens it found',
    warning.includes('"photorealistic"') && warning.includes('"cinematic"'),
    warning.slice(0, 200)
  )
  check(
    'the warning points at the skill that owns the rule',
    warning.includes('slates-prompting-nano-banana-2')
  )
  check(
    'and it did NOT block the call (clarification, not an error)',
    res.isError !== true && payload.requires_clarification === true,
    `isError=${res.isError}`
  )
}

await client.close()

if (failures > 0) {
  console.error(`\nmcp-instructions-smoke FAILED (${failures} assertion(s))`)
  process.exit(1)
}
console.log('mcp-instructions-smoke passed')
