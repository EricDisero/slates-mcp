import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ToolListChangedNotificationSchema, ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ALL_OPERATIONS, toolDefinitions } from '../packages/shared/dist/index.js'

const serverPath = fileURLToPath(new URL('../packages/mcp/dist/server.js', import.meta.url))

// Every launch has the full list, including legacy flags retained for compatibility.
// Tool discovery returns schemas; it never changes capability availability.
for (const flags of [[], ['--tools=compact'], ['--tools=flat']]) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath, ...flags], stderr: 'pipe' })
  const client = new Client({ name: 'fixed-surface-check', version: '1.0.0' })
  let changed = 0
  client.setNotificationHandler(ToolListChangedNotificationSchema, () => { changed++ })
  try {
    await client.connect(transport)
    const initial = (await client.listTools()).tools
    assert.equal(initial.length, ALL_OPERATIONS.length, 'every launch lists every operation')
    for (const name of ['slates_generate_image', 'slates_generate_video', 'slates_create_shot', 'slates_generate_from_shots']) {
      assert.ok(initial.some(tool => tool.name === name), `${name} is listed at startup`)
    }
    const search = await client.callTool({ name: 'slates_load_tools', arguments: { query: 'animate these photos' } })
    assert.ok(search.structuredContent.matches.slice(0, 3).some(match => match.name === 'slates_generate_video'))
    await client.callTool({ name: 'slates_load_tools', arguments: { names: ['slates_generate_image'] } })
    await client.callTool({ name: 'slates_load_tools', arguments: { group: 'admin' } })
    assert.deepEqual((await client.listTools()).tools, initial, 'queries, exact loads and group loads never change the list')
    assert.equal(changed, 0, 'no tools/list_changed notification is sent')
    const image = initial.find(tool => tool.name === 'slates_generate_image')
    assert.deepEqual(image, toolDefinitions(ALL_OPERATIONS, { surface: 'mcp' }).find(tool => tool.name === image.name))
    assert.equal(image.annotations.readOnlyHint, false)
    assert.equal(initial.find(tool => tool.name === 'slates_delete_project').annotations.destructiveHint, true)
    const invalid = await client.callTool({ name: 'slates_load_tools', arguments: { names: ['slates_missing'] } })
    assert.equal(invalid.isError, true)
    assert.deepEqual((await client.listTools()).tools, initial, 'an invalid load preserves the list')
    // Missing required settings returns before any transport or generation.
    const call = await client.callTool({ name: 'slates_generate_image', arguments: { prompt: 'photorealistic cinematic room', model: 'gpt-image-2-5-sunburst' } })
    assert.equal(call.structuredContent.requires_clarification, true)
    assert.equal(call.structuredContent.prompt_warning, undefined)
    for (const args of [{ topic: 'sunburst' }, { topic: 'cinematic', query: 'near-silhouette' }, { topic: 'cinematic', depth: 'full' }]) {
      const result = await client.callTool({ name: 'slates_get_prompting_guide', arguments: args })
      assert.equal(result.isError, undefined)
      assert.equal(result.structuredContent.guide, result.content[0].text)
      assert.ok(result.structuredContent.guide.length > 100)
    }
    console.log(`fixed-mcp ${flags.join(' ') || 'default'}: ${initial.length} tools / ${Buffer.byteLength(JSON.stringify(initial))} bytes; discovery, permission hints, errors and guides passed`)
  } finally { await client.close(); await transport.close() }
}

// Mock only the billable operation to exercise the real MCP approval protocol.
// Network is disabled in the server process; no provider or account can be touched.
const fixtureDir = mkdtempSync(join(tmpdir(), 'slates-elicit-'))
const fixture = join(fixtureDir, 'fixture.mjs')
writeFileSync(fixture, `import { ALL_OPERATIONS } from ${JSON.stringify(new URL('../packages/shared/dist/index.js', import.meta.url).href)};
globalThis.fetch = async () => { throw Error('Network forbidden in MCP approval test') };
ALL_OPERATIONS.find(o => o.id === 'slates_generate_image').run = async input => input.confirm
  ? {text: 'Completed fixture generation', data: {status: 'completed', assetId: 'fixture-only'}}
  : {text: 'Approve fixture spend', data: {requires_confirm: true}};
// The batch refuses a confirm that does not carry the fingerprint of the quote the user approved.
ALL_OPERATIONS.find(o => o.id === 'slates_generate_from_shots').run = async input => input.confirm && input.fingerprint === 'quote-1'
  ? {text: 'Completed fixture batch', data: {results: [], total: 0}}
  : {text: 'Approve fixture batch', data: {requires_confirm: true, fingerprint: 'quote-1', total_credits: 30}};`)
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
  const batch = await approvalClient.callTool({name: 'slates_generate_from_shots', arguments: {shotIds: ['SHOT-A1']}})
  assert.equal(approvalRequests, 2)
  assert.equal(batch.content[0].text, 'Completed fixture batch', 'an approved batch fires with the fingerprint of the quote shown')
  console.log('MCP approval: text and structured content both describe the final operation result; an approved batch carries the fingerprint of its quote')
} finally { await approvalClient.close(); await approvalTransport.close() }
