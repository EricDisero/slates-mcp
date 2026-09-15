import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ToolListChangedNotificationSchema, ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ALL_OPERATIONS, toolDefinitions } from '../packages/shared/dist/index.js'

const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../packages/mcp/dist/server.js', import.meta.url))], stderr: 'pipe' })
const client = new Client({ name: 'compact-surface-check', version: '1.0.0' })
let changed = 0
client.setNotificationHandler(ToolListChangedNotificationSchema, () => { changed++ })
try {
  await client.connect(transport)
  assert.equal(client.getServerCapabilities().tools.listChanged, true)
  const initial = (await client.listTools()).tools
  assert.ok(initial.length < 12)
  assert.ok(!initial.some((t) => t.name === 'slates_generate_image'))
  const search = await client.callTool({ name: 'slates_load_tools', arguments: { query: 'generate image' } })
  assert.ok(search.structuredContent.matches.some((m) => m.name === 'slates_generate_image'))
  await client.callTool({ name: 'slates_load_tools', arguments: { names: ['slates_generate_image'] } })
  const loaded = (await client.listTools()).tools.find((t) => t.name === 'slates_generate_image')
  const expected = toolDefinitions(ALL_OPERATIONS, { surface: 'mcp' }).find((t) => t.name === loaded.name)
  assert.deepEqual(loaded, expected)
  assert.equal(loaded.annotations.readOnlyHint, false)
  assert.ok(changed > 0)
  await client.callTool({ name: 'slates_load_tools', arguments: { names: ['slates_delete_project'] } })
  const next = (await client.listTools()).tools
  assert.ok(!next.some((t) => t.name === 'slates_generate_image'))
  assert.equal(next.find((t) => t.name === 'slates_delete_project').annotations.destructiveHint, true)
  const invalid = await client.callTool({ name: 'slates_load_tools', arguments: { names: ['slates_missing'] } })
  assert.equal(invalid.isError, true)
  assert.deepEqual((await client.listTools()).tools, next)
  // Compatibility: previously discovered names remain callable, even if a host
  // does not refresh its list. No generation: missing aspect ratio returns early.
  const call = await client.callTool({ name: 'slates_generate_image', arguments: { prompt: 'photorealistic cinematic room', model: 'gpt-image-2-5-sunburst' } })
  assert.equal(call.structuredContent.requires_clarification, true)
  assert.equal(call.structuredContent.prompt_warning, undefined)
  for (const args of [{ topic: 'sunburst' }, { topic: 'cinematic', query: 'near-silhouette' }, { topic: 'cinematic', depth: 'full' }]) {
    const r = await client.callTool({ name: 'slates_get_prompting_guide', arguments: args })
    assert.equal(r.isError, undefined)
    assert.equal(r.structuredContent.guide, r.content[0].text)
    assert.ok(r.structuredContent.guide.length > 100)
  }
  console.log(`compact-mcp: ${initial.length} startup tools / ${Buffer.byteLength(JSON.stringify(initial))} bytes; discovery, listChanged, permission hints, compatibility calls and guide bodies passed`)
} finally { await client.close(); await transport.close() }

// Mock only the billable operation to exercise the real MCP approval protocol.
// Network is disabled in the server process; no provider or account can be touched.
const fixtureDir = mkdtempSync(join(tmpdir(), 'slates-elicit-'))
const fixture = join(fixtureDir, 'fixture.mjs')
writeFileSync(fixture, `import { ALL_OPERATIONS } from ${JSON.stringify(new URL('../packages/shared/dist/index.js', import.meta.url).href)};
globalThis.fetch = async () => { throw Error('Network forbidden in MCP approval test') };
ALL_OPERATIONS.find(o => o.id === 'slates_generate_image').run = async input => input.confirm
  ? {text: 'Completed fixture generation', data: {status: 'completed', assetId: 'fixture-only'}}
  : {text: 'Approve fixture spend', data: {requires_confirm: true}};`)
const approvalTransport = new StdioClientTransport({command: process.execPath, args: ['--import', pathToFileURL(fixture).href, fileURLToPath(new URL('../packages/mcp/dist/server.js', import.meta.url))], stderr: 'pipe'})
const approvalClient = new Client({name: 'approval-shape-check', version: '1.0.0'}, {capabilities: {elicitation: {}}})
let approvalRequests = 0
approvalClient.setRequestHandler(ElicitRequestSchema, async () => { approvalRequests++; return {action: 'accept', content: {confirm: true}} })
try {
  await approvalClient.connect(approvalTransport)
  const result = await approvalClient.callTool({name: 'slates_generate_image', arguments: {prompt: 'fixture'}})
  assert.equal(approvalRequests, 1)
  assert.equal(result.content[0].text, 'Completed fixture generation')
  assert.deepEqual(result.structuredContent, {status: 'completed', assetId: 'fixture-only'})
  console.log('MCP approval: text and structured content both describe the final operation result')
} finally { await approvalClient.close(); await approvalTransport.close() }
