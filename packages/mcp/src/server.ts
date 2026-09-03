#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  ALL_OPERATIONS,
  SKILLS,
  MODEL_CAPABILITIES,
  MODEL_FACTS,
  SlatesCloudClient,
  buildAgentDoctrine,
  defaultContext,
  toolDefinitions,
  type Operation,
} from '@slatesvideo/shared'

// Slates MCP server. Stdio transport. Wires every operation in
// @slatesvideo/shared as an MCP tool. Both the desktop server and the
// cloud API are reached through env-discovered creds in
// ~/.slates/agent-connection.json — no env vars to set, no config to
// fiddle with. The user just runs `slates login` or toggles "Connect
// Claude Code" in Slates Settings, then adds:
//
//   { "command": "npx", "args": ["-y", "@slatesvideo/mcp-server"] }
//
// to their Claude / Cursor / Claude Desktop / Codex MCP config.
//
// 🚨 THE PROTOCOL IS THE PRODUCT SURFACE, NOT JUST THE TRANSPORT. Until
// 2026-09-02 this file used exactly one MCP feature — tools — so a host had no
// way to tell `slates_list_assets` from `slates_delete_project` (no
// annotations), no way to read a result as data (no structured content), no way
// to offer the 33 skills in its own picker (no prompts), no way to attach the
// capability table as context (no resources), and no way to show a render's
// progress (no progress notifications). All five are in the 2025-06-18 spec and
// all five are now used. Adding one is not decoration: each removes a reason
// the host has to route something through the model instead.

const ops = ALL_OPERATIONS as readonly Operation<unknown>[]
const opsById = new Map<string, Operation<unknown>>(ops.map((o) => [o.id, o]))

// Version comes from this package's own package.json (dist/server.js →
// ../package.json) so the reported version never drifts from the publish.
const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')
) as { version: string }

// The MCP protocol carries a field for exactly this, and it sat unused: a
// Claude Code / Cursor / Codex user got tool descriptions and nothing else —
// no working method, no REAL NUMBERS rule, no guide index, while the desktop
// Studio Agent had 37K characters of all three. Same doctrine, one source
// (@slatesvideo/shared → prompts/agent-doctrine.ts), surface-aware only where
// the mechanism genuinely differs.
//
// ⚠️ SIZE IS DELIBERATE. This is injected into EVERY client session and some
// clients truncate or ignore long instructions, so it ships the working method
// + hard rules + guide index and leaves the long-form skills to
// slates_get_prompting_guide. scripts/agent-surface-lockstep-check.mjs pins the
// byte count so growth is a review decision, not an accident.
const instructions = buildAgentDoctrine({ surface: 'mcp' })

const server = new Server(
  { name: 'slates-studio', version: pkg.version },
  {
    capabilities: {
      tools: {},
      // The 33 bundled skills, offered in the host's own picker rather than
      // only through a tool call the model has to decide to make.
      prompts: {},
      // Stable documents a client can attach as context instead of spending a
      // turn fetching them.
      resources: {},
      // Server-side warnings a host can surface without the model relaying them.
      logging: {},
    },
    instructions,
  }
)

// ── Tools ───────────────────────────────────────────────────────────────────
//
// 🚨 ONE RENDERER, SHARED WITH THE DESKTOP. This used to call zodToJsonSchema
// with `target: 'openApi3'` while `slate/src/main/studio-agent/ops.ts` used
// `$refStrategy: 'none'` — so "both surfaces expose the same tools" was proven
// of the ID SET and unproven of the BYTES. `toolDefinitions()` in shared is now
// the only renderer either one calls, and the lockstep check compares them.
//
// `surface: 'mcp'` sends every op: a stdio server has no run to append to, and
// Claude Code already defers stdio tool schemas through its own tool search.
const TOOLS = toolDefinitions(ops, { surface: 'mcp' })

/**
 * Output schemas for the ops whose result shape is STABLE.
 *
 * Deliberately not every op: an `outputSchema` a result can violate is worse
 * than none, because a client may validate against it. These five shapes are
 * fixed by the op's own code paths, and every one of them is a number or an id
 * a client would otherwise have to parse back out of prose.
 */
const OUTPUT_SCHEMAS: Record<string, Record<string, unknown>> = {
  slates_estimate_generation_cost: {
    type: 'object',
    properties: {
      model: { type: 'string' },
      cost_key: { type: 'string' },
      quantity: { type: 'integer' },
      cost_per_credits: { type: 'number' },
      total_credits: { type: 'number' },
      requires_confirm: { type: 'boolean' },
      craft_card: { type: 'string', description: 'How to prompt this model — the levers block.' },
      banned_tokens: { type: 'string' },
      requires_clarification: { type: 'boolean' },
      missing: { type: 'array', items: { type: 'string' } },
      message: { type: 'string' },
    },
  },
  slates_get_generation_status: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'] },
      error: { type: 'string' },
      asset: { type: 'object' },
      cost_credits: { type: 'number' },
    },
  },
  slates_get_credit_balance: {
    type: 'object',
    properties: { success: { type: 'boolean' }, credit_balance: { type: 'number' } },
  },
  slates_list_assets: {
    type: 'object',
    properties: {
      assets: { type: 'array', items: { type: 'object' } },
      total_matching: { type: 'integer' },
      total_in_project: { type: 'integer' },
      truncated: { type: 'boolean' },
    },
  },
  slates_get_workspace_state: {
    type: 'object',
    properties: {
      projects: { type: 'array', items: { type: 'object' } },
      project_count: { type: 'integer' },
      activeProject: { type: 'object' },
    },
  },
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    // readOnlyHint / destructiveHint / idempotentHint / openWorldHint. Derived
    // in shared from the op id and re-derived independently by the lockstep
    // check from the op's own transport verbs — a read-only claim on an op that
    // posts is the one lie that would let a host auto-approve a mutation.
    annotations: t.annotations,
    ...(OUTPUT_SCHEMAS[t.name] ? { outputSchema: OUTPUT_SCHEMAS[t.name] } : {}),
  })),
}))

/**
 * Zod's default error is a JSON blob of issue objects. The model has to parse
 * prose out of it to learn that `aspectRatio` was the problem and what the
 * legal values are — so flatten to one line per issue, and print the legal set
 * whenever an enum was the thing that failed.
 */
function flattenZodError(err: z.ZodError): string {
  return err.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
      if (issue.code === 'invalid_enum_value') {
        const legal = (issue as unknown as { options?: unknown[] }).options ?? []
        return `${path}: ${issue.message}. Legal values: ${legal.join(', ')}`
      }
      if (issue.code === 'unrecognized_keys') {
        const keys = (issue as unknown as { keys?: string[] }).keys ?? []
        return `${path}: unknown parameter(s) ${keys.join(', ')} — check the tool schema`
      }
      return `${path}: ${issue.message}`
    })
    .join('\n')
}

/** Fire-and-forget: a host that has not enabled logging must not break a call. */
function warn(message: string): void {
  if (!server.getClientCapabilities()?.['logging' as never]) return
  void server.sendLoggingMessage({ level: 'warning', logger: 'slates', data: message }).catch(() => {})
}

/**
 * Elicitation (spec 2025-06-18): ask the USER, through the host's own UI,
 * rather than making the model notice a `requires_confirm` string and decide to
 * re-call. Behind a capability check, with a timeout — the text path stays the
 * default for every client that does not advertise it, and a client that
 * half-supports it must not hang the call.
 */
const ELICIT_TIMEOUT_MS = 60_000

function clientSupportsElicitation(): boolean {
  return !!server.getClientCapabilities()?.elicitation
}

/** Does this op actually have a `confirm` gate to satisfy? */
function opTakesConfirm(op: Operation<unknown>): boolean {
  const def = (op.input as unknown as { _def?: { shape?: () => Record<string, unknown> } })._def
  const shape = typeof def?.shape === 'function' ? def.shape() : undefined
  return !!shape && 'confirm' in shape
}

async function elicitConfirm(message: string): Promise<boolean | null> {
  try {
    const res = await server.elicitInput(
      {
        message,
        requestedSchema: {
          type: 'object',
          properties: {
            confirm: {
              type: 'boolean',
              title: 'Spend the credits',
              description: 'Yes proceeds and charges the account.',
            },
          },
          required: ['confirm'],
        },
      },
      { timeout: ELICIT_TIMEOUT_MS }
    )
    if (res.action !== 'accept') return false
    return (res.content as { confirm?: boolean } | undefined)?.confirm === true
  } catch {
    // Declined, timed out, or a host that advertised the capability and then
    // failed it. Fall back to the text path rather than failing the call.
    return null
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const op = opsById.get(request.params.name)
  if (!op) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    }
  }
  try {
    let args: unknown
    try {
      args = op.input.parse(request.params.arguments ?? {})
    } catch (err) {
      if (err instanceof z.ZodError) {
        return {
          content: [
            {
              type: 'text',
              text: `Invalid arguments for ${op.id}:\n${flattenZodError(err)}`,
            },
          ],
          isError: true,
        }
      }
      throw err
    }

    // Progress notifications: a background render is invisible to the host
    // until the model polls. When the client sent a progress token, tick while
    // the long-poll is in flight so the host can show something moving.
    const progressToken = request.params._meta?.progressToken
    let ticker: NodeJS.Timeout | undefined
    if (progressToken !== undefined && op.id === 'slates_get_generation_status') {
      const started = Date.now()
      ticker = setInterval(() => {
        void server
          .notification({
            method: 'notifications/progress',
            params: {
              progressToken,
              progress: Math.round((Date.now() - started) / 1000),
              message: `rendering — ${Math.round((Date.now() - started) / 1000)}s`,
            },
          })
          .catch(() => {})
      }, 5_000)
      ticker.unref?.()
    }

    let result
    try {
      result = await op.run(args as never, { ...defaultContext(), signal: extra?.signal })
    } finally {
      if (ticker) clearInterval(ticker)
    }

    const data = result.data as Record<string, unknown> | undefined

    // The one place the server can ask the USER instead of the model.
    //
    // 🚨 GATED ON THE OP HAVING A `confirm` INPUT, not merely on the flag.
    // `slates_estimate_generation_cost` returns `requires_confirm: true` as
    // INFORMATION — "the generation this quotes will trip the gate" — and takes
    // no `confirm` param at all. Eliciting there would ask the user to approve
    // a spend that is not happening, on a read-only pre-flight quote, and then
    // re-run the quote with a parameter it does not have.
    if (data?.requires_confirm === true && opTakesConfirm(op) && clientSupportsElicitation()) {
      const answer = await elicitConfirm(
        typeof data.message === 'string' ? data.message : result.text
      )
      if (answer === true) {
        result = await op.run({ ...(args as object), confirm: true } as never, {
          ...defaultContext(),
          signal: extra?.signal,
        })
      } else if (answer === false) {
        return {
          content: [{ type: 'text', text: 'The user declined the spend. Do not re-call without new instructions.' }],
        }
      }
      // null → the host could not answer; the text path below still applies.
    }

    if (typeof data?.prompt_warning === 'string' && data.prompt_warning) {
      warn(data.prompt_warning)
    }

    const content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> = [
      { type: 'text', text: result.text },
    ]
    for (const img of result.images ?? []) {
      content.push({ type: 'image', data: img.data, mimeType: img.mimeType })
    }
    return {
      content,
      // `data` beside the prose, so a client can read cost_credits, asset codes
      // and status as VALUES rather than regexing them back out of a sentence.
      ...(data !== undefined && data !== null && typeof data === 'object'
        ? { structuredContent: data }
        : {}),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/not reachable|Agent Control/i.test(message)) warn(message)
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }
})

// ── Prompts: the 33 bundled skills ──────────────────────────────────────────
//
// This is exactly what MCP prompts are for, and the only path before now was a
// tool call the model had to decide to make — measured at 13% compliance. As a
// prompt, the skill shows up in the host's own picker and the USER can invoke
// it, which is a completely different actor making the decision.

/** First sentence of the frontmatter description — the picker's one-liner. */
function skillSummary(name: string): string {
  const body = SKILLS[name] ?? ''
  const fm = /^---\n([\s\S]*?)\n---/.exec(body)
  const desc = fm ? /^description:\s*(.+)$/m.exec(fm[1])?.[1] : undefined
  const first = (desc ?? name).split(/(?<=\.)\s/)[0]
  return first.length > 300 ? `${first.slice(0, 297)}…` : first
}

const SKILL_NAMES = Object.keys(SKILLS).sort()

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: SKILL_NAMES.map((name) => ({
    name,
    title: name.replace(/^slates-/, '').replace(/-/g, ' '),
    description: skillSummary(name),
  })),
}))

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const name = request.params.name
  const content = SKILLS[name]
  if (content === undefined) {
    throw new Error(`Unknown prompt: ${name}. Available: ${SKILL_NAMES.join(', ')}`)
  }
  return {
    description: skillSummary(name),
    messages: [{ role: 'user' as const, content: { type: 'text' as const, text: content } }],
  }
})

// ── Resources: the stable documents ─────────────────────────────────────────

const MANUAL_URI = 'slates://manual'
const CAPABILITIES_URI = 'slates://capabilities'
const PRICES_URI = 'slates://prices'

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: MANUAL_URI,
      name: 'Slates agent manual',
      description: 'The working method, the hard rules and the guide index — the same doctrine this server sends as instructions.',
      mimeType: 'text/markdown',
    },
    {
      uri: CAPABILITIES_URI,
      name: 'Model capabilities',
      description: 'What every model ACCEPTS: aspect ratios, video resolutions, duration windows and reference caps, generated from the capability SSOT.',
      mimeType: 'text/markdown',
    },
    {
      uri: PRICES_URI,
      name: 'Credit price list',
      description: 'Live per-generation credit cost for every registry key. Read from the account, never cached — a stale price is a wrong quote.',
      mimeType: 'text/markdown',
    },
  ],
}))

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resourceTemplates: [
    {
      uriTemplate: 'slates://skill/{name}',
      name: 'Prompting or workflow guide',
      description: `One bundled skill, whole. Names: ${SKILL_NAMES.join(', ')}`,
      mimeType: 'text/markdown',
    },
    {
      uriTemplate: 'slates://project/{projectId}/shots',
      name: 'Shot list',
      description: 'Every Shot in a project, with the variety distribution the counts are read from.',
      mimeType: 'application/json',
    },
  ],
}))

/** Generated from MODEL_CAPABILITIES + MODEL_FACTS — never hand-written. */
function renderCapabilities(): string {
  const lines = ['# Slates model capabilities', '', 'Generated from the capability SSOT. Never quote a number from memory.', '']
  for (const [model, cap] of Object.entries(MODEL_CAPABILITIES)) {
    const fact = MODEL_FACTS.find((f) => f.id === model)
    lines.push(`## ${model}${fact ? ` — ${fact.kind}` : ''}`)
    if (cap.aspectRatios) lines.push(`- Aspect ratios: ${cap.aspectRatios.join(', ')}`)
    if (cap.videoResolution) {
      const vr = cap.videoResolution
      lines.push(`- Video resolutions: ${vr.fixed ? `${vr.fixed} (fixed)` : (vr.options ?? []).join(', ')}${vr.default ? ` (default ${vr.default})` : ''}`)
    }
    if (cap.duration) {
      const d = cap.duration
      lines.push(`- Duration: ${d.values ? d.values.join(' / ') : `${d.min}-${d.max}`}s`)
    }
    const refs: string[] = []
    if (cap.maxRefImages != null) refs.push(`${cap.maxRefImages} images (create)`)
    if (cap.maxIngredientImages != null) refs.push(`${cap.maxIngredientImages} ingredient images`)
    if (cap.maxReferenceVideos) refs.push(`${cap.maxReferenceVideos} videos`)
    if (cap.maxReferenceAudio) refs.push(`${cap.maxReferenceAudio} audio clips`)
    if (cap.maxReferenceFilesTotal != null) refs.push(`${cap.maxReferenceFilesTotal} files total`)
    if (refs.length > 0) lines.push(`- Reference caps: ${refs.join(' · ')}`)
    lines.push('')
  }
  return lines.join('\n')
}

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri
  const text = async (): Promise<string> => {
    if (uri === MANUAL_URI) {
      return `${instructions}\n\n---\n\nFull product manual: https://slates.video/slates-reference.md`
    }
    if (uri === CAPABILITIES_URI) return renderCapabilities()
    if (uri === PRICES_URI) {
      // 🚨 READ LIVE, NEVER EMBEDDED. A price baked into the package at build
      // time is wrong on the next rate change, and REAL NUMBERS ONLY exists to
      // stop exactly that number reaching a user.
      const registry = await new SlatesCloudClient().get<{
        models: Array<{ model: string; cost_credits?: number; cost_cents?: number }>
      }>('/api/agent/models')
      return [
        '# Slates credit prices (live)',
        '',
        'Credits per generation, by registry cost key.',
        '',
        ...registry.models.map((m) => `${m.model} ${m.cost_credits ?? m.cost_cents ?? 0}`),
      ].join('\n')
    }
    const skill = /^slates:\/\/skill\/(.+)$/.exec(uri)
    if (skill) {
      const content = SKILLS[decodeURIComponent(skill[1])]
      if (content === undefined) throw new Error(`Unknown skill: ${skill[1]}`)
      return content
    }
    const shots = /^slates:\/\/project\/([^/]+)\/shots$/.exec(uri)
    if (shots) {
      const op = opsById.get('slates_list_shots')
      if (!op) throw new Error('slates_list_shots is not registered')
      const r = await op.run({ projectId: decodeURIComponent(shots[1]) } as never, defaultContext())
      return JSON.stringify(r.data ?? {}, null, 2)
    }
    throw new Error(`Unknown resource: ${uri}`)
  }
  return {
    contents: [
      {
        uri,
        mimeType: uri.endsWith('/shots') ? 'application/json' : 'text/markdown',
        text: await text(),
      },
    ],
  }
})

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(
    `[slates-mcp] server started, ${ops.length} tools registered, ` +
      `${SKILL_NAMES.length} skills as prompts, 3 resources + 2 templates, ` +
      `${instructions.length} chars of agent doctrine sent as instructions`
  )
}

main().catch((err) => {
  console.error('[slates-mcp] fatal:', err)
  process.exit(1)
})
