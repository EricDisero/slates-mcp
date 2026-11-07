import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ToolListChangedNotificationSchema, ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ALL_OPERATIONS, ROUTER_NOTICE, toolDefinitions } from '../packages/shared/dist/index.js'
import { mcpFixture } from './ad-variant-export-check.mjs'
import { useBrainSource } from '../packages/shared/dist/skills/served.js'
import { brainOrSkip } from './brain-source.mjs'

// The guides are the brain's (slates-api brain/), held as a member's server holds them, here and in any server this spawns.
const brain = brainOrSkip('compact-mcp')
process.env.SLATES_DEV = '1'
process.env.SLATES_BRAIN_DIR = brain
useBrainSource(brain)

const serverPath = fileURLToPath(new URL('../packages/mcp/dist/server.js', import.meta.url))

// Every launch has the full list, including legacy flags retained for compatibility.
// Tool discovery returns schemas; it never changes capability availability.
for (const flags of [[], ['--tools=compact'], ['--tools=flat']]) {
  const isolated = await mcpFixture()
  const transport = new StdioClientTransport({ command: process.execPath, args: [...isolated.args, ...flags], env: isolated.env, stderr: 'pipe' })
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
    // Missing required settings returns before any transport or generation, once the model's guide is read.
    await client.callTool({ name: 'slates_get_prompting_guide', arguments: { topic: 'gpt-image-2-5-sunburst' } })
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
  } finally { await client.close(); await transport.close(); await isolated.close() }
}

// Mock only the billable operation to exercise the real MCP approval protocol.
// Network is disabled in the server process; no provider or account can be touched.
const fixtureDir = mkdtempSync(join(tmpdir(), 'slates-elicit-'))
const fixture = join(fixtureDir, 'fixture.mjs')
writeFileSync(fixture, `import { ALL_OPERATIONS } from ${JSON.stringify(new URL('../packages/shared/dist/index.js', import.meta.url).href)};
globalThis.fetch = async () => { throw Error('Network forbidden in MCP approval test') };
ALL_OPERATIONS.find(o => o.id === 'slates_generate_image').run = async input => input.confirm
  ? {text: 'Completed fixture generation', data: {status: 'completed', assetId: 'fixture-only'}}
  : input.prompt === 'clarify'
    ? {text: 'Clarify fixture prompt', data: {requires_clarification: true, confirm_sends_as_written: true, message: 'Pass confirm=true to send it as written.'}}
    : {text: 'Approve fixture spend', data: {requires_confirm: true}};
// The batch refuses a confirm that does not carry the fingerprint of the quote the user approved.
ALL_OPERATIONS.find(o => o.id === 'slates_generate_from_shots').run = async input => input.confirm && input.fingerprint === 'quote-1'
  ? {text: 'Completed fixture batch', data: {results: [], total: 0}}
  : {text: 'Approve fixture batch', data: {requires_confirm: true, fingerprint: 'quote-1', total_credits: 30}};`)
const isolatedApproval = await mcpFixture()
const approvalTransport = new StdioClientTransport({command: process.execPath, args: ['--import', isolatedApproval.args[1], '--import', pathToFileURL(fixture).href, serverPath], env: isolatedApproval.env, stderr: 'pipe'})
const approvalClient = new Client({name: 'approval-shape-check', version: '1.0.0'}, {capabilities: {elicitation: {}}})
let approvalRequests = 0
approvalClient.setRequestHandler(ElicitRequestSchema, async () => { approvalRequests++; return {action: 'accept', content: {confirm: true}} })
try {
  await approvalClient.connect(approvalTransport)
  const result = await approvalClient.callTool({name: 'slates_generate_image', arguments: {prompt: 'fixture'}})
  assert.equal(approvalRequests, 1)
  // A billable op's result never carries the router, first result of the connection or not: it reports a spend,
  // and the router read there comes after the money is gone.
  assert.equal(result.content[0].text, 'Completed fixture generation')
  assert.equal(result.content.length, 1, 'the router does not ride a billable result')
  assert.deepEqual(result.structuredContent, {status: 'completed', assetId: 'fixture-only'})
  // The first result of an op that spends nothing carries it, once: a guide for a topic other than the router
  // counts, as its own text block (the op's text stays as it was) and in the structured content.
  const playbook = await approvalClient.callTool({name: 'slates_get_prompting_guide', arguments: {topic: 'slates-cuts'}})
  assert.notEqual(playbook.content[0].text, ROUTER_NOTICE)
  assert.equal(playbook.structuredContent.guide, playbook.content[0].text, "the guide's own text is unchanged")
  assert.equal(playbook.content[1]?.text, ROUTER_NOTICE, 'the router rides the first non-billable result')
  assert.equal(playbook.structuredContent.brain_router, ROUTER_NOTICE)
  const batch = await approvalClient.callTool({name: 'slates_generate_from_shots', arguments: {shotIds: ['SHOT-A1']}})
  assert.equal(approvalRequests, 2)
  assert.equal(batch.content[0].text, 'Completed fixture batch', 'an approved batch fires with the fingerprint of the quote shown')
  assert.equal(batch.content.length, 1)
  assert.deepEqual(batch.structuredContent, {results: [], total: 0})
  const again = await approvalClient.callTool({name: 'slates_load_tools', arguments: {query: 'animate these photos'}})
  assert.equal(again.content.length, 1, 'the router is not sent twice')
  assert.equal(again.structuredContent.brain_router, undefined)
  console.log('MCP approval: text and structured content both describe the final operation result; an approved batch carries the fingerprint of its quote; the router skips billable results and rides the first non-billable one, once')
} finally { await approvalClient.close(); await approvalTransport.close(); await isolatedApproval.close() }

// A model's confirm: true is not the user's yes. On a host that can ask, only a person's yes spends. What a
// person did not decide is no yes either: silence and a host error spend nothing. The exceptions are hosts
// where nobody can be asked, and there the spend is the model's word, never an approval.
// The real SDK timer, cut from 60s to keep this check short: no flag in the server, only the time.
const shortTimeout = join(fixtureDir, 'short-timeout.mjs')
writeFileSync(shortTimeout, `import { Server } from ${JSON.stringify(import.meta.resolve('@modelcontextprotocol/sdk/server/index.js'))};
const elicitInput = Server.prototype.elicitInput;
Server.prototype.elicitInput = function (params, options) { return elicitInput.call(this, params, {...options, timeout: 300}) };`)
async function approvalSession(capabilities, run, preloads = []) {
  const isolated = await mcpFixture()
  const imports = [fixture, ...preloads].flatMap(file => ['--import', pathToFileURL(file).href])
  const transport = new StdioClientTransport({command: process.execPath, args: ['--import', isolated.args[1], ...imports, serverPath], env: isolated.env, stderr: 'pipe'})
  const client = new Client({name: 'claimed-confirm-check', version: '1.0.0'}, {capabilities})
  try {
    await client.connect(transport)
    await run(client)
  } finally { await client.close(); await transport.close(); await isolated.close() }
}
const generate = (client, prompt, confirm) => client.callTool({name: 'slates_generate_image', arguments: {prompt, ...(confirm === undefined ? {} : {confirm})}})
const textOf = async (call) => (await call).content[0].text
const SPENT = 'Completed fixture generation'
const QUOTED = 'Approve fixture spend'
const REFUSED = /declined or did not answer, so nothing ran/
/** A person: an answer that takes longer than a host's own policy does. */
const afterReading = (reply) => new Promise(done => setTimeout(() => done(reply), 700))
try {
  await approvalSession({elicitation: {}}, async (client) => {
    let asked = 0
    let answer = () => afterReading({action: 'decline'})
    client.setRequestHandler(ElicitRequestSchema, async () => { asked++; return answer() })

    assert.match(await textOf(generate(client, 'fixture', true)), REFUSED, "a person's no stops a claimed confirm")
    assert.equal(asked, 1, 'a claimed confirm still asks the user')

    answer = () => afterReading({action: 'cancel'})
    assert.match(await textOf(generate(client, 'fixture', true)), REFUSED, "and so does a person's cancel")

    answer = () => ({action: 'accept', content: {confirm: false}})
    assert.match(await textOf(generate(client, 'fixture', true)), REFUSED, 'an unticked yes is a no')

    answer = () => ({action: 'accept', content: {confirm: true}})
    assert.equal(await textOf(generate(client, 'fixture', true)), SPENT, 'and a yes runs it')
    assert.equal(asked, 4)

    assert.equal(await textOf(generate(client, 'clarify')), 'Clarify fixture prompt', 'a clarification goes to the model')
    assert.equal(asked, 4, 'without asking the user')
    assert.equal(await textOf(generate(client, 'clarify', true)), SPENT, 'until the model claims confirm, when the user decides')
    assert.equal(asked, 5)
  })
  // D1: a prompt nobody answers. The model's confirm spends nothing, then or on the next call, and the next
  // call still asks: one unattended prompt must not switch the gate off for the connection.
  await approvalSession({elicitation: {}}, async (client) => {
    let asked = 0
    client.setRequestHandler(ElicitRequestSchema, () => { asked++; return new Promise(() => {}) })
    for (const attempt of [1, 2]) {
      assert.match(await textOf(generate(client, 'fixture', true)), REFUSED, 'an unanswered prompt spends nothing')
      assert.equal(asked, attempt, 'and the next call asks again')
    }
  }, [shortTimeout])
  // A host that errors on the question has given no yes either.
  await approvalSession({elicitation: {}}, async (client) => {
    let asked = 0
    client.setRequestHandler(ElicitRequestSchema, async () => { asked++; throw new Error('the host failed its own question') })
    for (const attempt of [1, 2]) {
      assert.match(await textOf(generate(client, 'fixture', true)), REFUSED, 'a host error spends nothing')
      assert.equal(asked, attempt)
    }
  })
  // D2: Codex with approval policy "never" declines every form before a person could read it. Nobody was
  // asked, so that call runs as on a host without elicitation, and only that call: the next one asks again.
  await approvalSession({elicitation: {}}, async (client) => {
    let asked = 0
    let answer = () => ({action: 'decline'})
    client.setRequestHandler(ElicitRequestSchema, async () => { asked++; return answer() })
    assert.equal(await textOf(generate(client, 'fixture')), QUOTED, 'without a confirm the quote goes to the model')
    assert.equal(await textOf(generate(client, 'fixture', true)), SPENT, "with one the model's word stands, as on a host that cannot ask")
    answer = () => ({action: 'cancel'})
    assert.equal(await textOf(generate(client, 'fixture', true)), SPENT, 'a cancel that fast is the same')
    assert.equal(asked, 3, 'every call still asks')
    answer = () => afterReading({action: 'decline'})
    assert.match(await textOf(generate(client, 'fixture', true)), REFUSED, 'so a person who does answer on this connection is heard')
    answer = () => ({action: 'decline'})
    const batch = (args) => textOf(client.callTool({name: 'slates_generate_from_shots', arguments: {shotIds: ['SHOT-A1'], confirm: true, ...args}}))
    assert.equal(await batch({}), 'Approve fixture batch', 'no person saw the quote, so the server does not fill in its fingerprint')
    assert.equal(await batch({fingerprint: 'quote-1'}), 'Completed fixture batch', "the model's own fingerprint is what runs")
  })
  // A host that advertised elicitation and has no such method: the rest of the connection is the text path.
  await approvalSession({elicitation: {}}, async (client) => {
    assert.equal(await textOf(generate(client, 'fixture')), QUOTED)
    assert.equal(await textOf(generate(client, 'fixture', true)), SPENT, 'a host with no handler keeps the text path')
  })
  await approvalSession({}, async (client) => {
    assert.equal(await textOf(generate(client, 'fixture')), QUOTED)
    assert.equal(await textOf(generate(client, 'fixture', true)), SPENT, 'a host with no elicitation keeps the text path')
  })
  // A url-only host is a host without elicitation: the same two answers, and nobody asked.
  await approvalSession({elicitation: {url: {}}}, async (client) => {
    let asked = 0
    client.setRequestHandler(ElicitRequestSchema, async () => { asked++; return {action: 'decline'} })
    assert.equal(await textOf(generate(client, 'fixture')), QUOTED)
    assert.equal(await textOf(generate(client, 'fixture', true)), SPENT, 'the same as no elicitation')
    assert.equal(asked, 0, 'no form question ever goes to it')
  })
  console.log("MCP approval: where a person can be asked only their yes spends, and silence, a no or a host error spend nothing; on a host that declines at once or has no form elicitation, nobody is asked and the model's confirm spends unapproved")
} finally { rmSync(fixtureDir, { recursive: true, force: true }) }
