#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ALL_OPERATIONS,
  defaultContext,
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

const ops = ALL_OPERATIONS as readonly Operation<unknown>[]
const opsById = new Map<string, Operation<unknown>>(ops.map((o) => [o.id, o]))

// Version comes from this package's own package.json (dist/server.js →
// ../package.json) so the reported version never drifts from the publish.
const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')
) as { version: string }

const server = new Server(
  { name: 'slates-studio', version: pkg.version },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ops.map((op) => ({
    name: op.id,
    description: op.description,
    inputSchema: zodToJsonSchema(op.input as never, { target: 'openApi3' }) as Record<string, unknown>,
  })),
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const op = opsById.get(request.params.name)
  if (!op) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    }
  }
  try {
    const args = op.input.parse(request.params.arguments ?? {})
    const result = await op.run(args, defaultContext())
    const content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> = [
      { type: 'text', text: result.text },
    ]
    for (const img of result.images ?? []) {
      content.push({ type: 'image', data: img.data, mimeType: img.mimeType })
    }
    return { content }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }
})

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`[slates-mcp] server started, ${ops.length} tools registered`)
}

main().catch((err) => {
  console.error('[slates-mcp] fatal:', err)
  process.exit(1)
})
