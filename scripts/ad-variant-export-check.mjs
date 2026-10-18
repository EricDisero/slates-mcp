import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ALL_OPERATIONS, toolDefinitions } from '../packages/shared/dist/index.js'
import { desktopSource } from './desktop-source.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serverPath = join(root, 'packages/mcp/dist/server.js')
const projectId = '11111111-1111-4111-8111-111111111111'
const timelineId = '22222222-2222-4222-8222-222222222222'
const clipId = '33333333-3333-4333-8333-333333333333'
const byId = new Map(ALL_OPERATIONS.map(op => [op.id, op]))
const featureIds = ['slates_export_cuts', 'slates_get_export_batch', 'slates_cancel_export_batch',
  'slates_get_variant_grid', 'slates_reframe_clip', 'slates_get_reframe_report']
const textOf = result => result.content?.map(item => item.text ?? '').join('\n') ?? ''

// Junctioned workspace packages can point at the main checkout. Exercise this
// worktree's build, with all external requests refused before opening a socket.
export async function mcpFixture(connection) {
  const home = await mkdtemp(join(tmpdir(), 'slates-ad-mcp-'))
  await mkdir(join(home, '.slates'))
  if (connection) await writeFile(join(home, '.slates/agent-connection.json'), JSON.stringify(connection))
  const loader = join(home, 'shared-loader.mjs')
  const sharedUrl = pathToFileURL(join(root, 'packages/shared/dist/index.js')).href
  await writeFile(loader, `export async function resolve(specifier, context, next) {
    if (specifier === '@slatesvideo/shared') return { url: ${JSON.stringify(sharedUrl)}, shortCircuit: true };
    return next(specifier, context);
  }`)
  const preload = join(home, 'offline.mjs')
  const allowedPaths = ['/agent/healthz', '/agent/timeline/export-cuts', '/agent/timeline/export-cuts/status',
    '/agent/timeline/export-cuts/cancel', '/agent/timeline/export-batches', '/agent/timeline/variant-grid',
    '/agent/timeline/reframe', '/agent/timeline/reframe-report']
  await writeFile(preload, `import { register } from 'node:module';
    register(${JSON.stringify(pathToFileURL(loader).href)});
    const original = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url ?? input.href);
      if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') throw new Error('External network disabled by export check');
      if (${!!connection} && !${JSON.stringify(allowedPaths)}.includes(url.pathname)) throw new Error('Non-export HTTP request forbidden');
      return original(input, init);
    };`)
  return {
    home,
    args: ['--import', pathToFileURL(preload).href, serverPath],
    env: { ...process.env, HOME: home, USERPROFILE: home },
    close: () => rm(home, { recursive: true, force: true }),
  }
}

async function withClient(connection, work) {
  const fixture = await mcpFixture(connection)
  const transport = new StdioClientTransport({ command: process.execPath, args: fixture.args, env: fixture.env, stderr: 'pipe' })
  let stderr = ''
  transport.stderr?.on('data', chunk => { stderr += chunk.toString() })
  const client = new Client({ name: 'ad-variant-export-check', version: '1.0.0' })
  try { await client.connect(transport); return await work(client, fixture) }
  catch (error) { throw new Error(`${error.message}\nMCP stderr: ${stderr}`, { cause: error }) }
  finally { await client.close(); await fixture.close() }
}

async function promptCall(client, name, args) {
  const start = performance.now()
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 5000 })
  assert(performance.now() - start < 5000, `${name} did not finish promptly`)
  return result
}

async function fastCheck() {
  // Honor the shared checkout override so CI and local checks can exercise the
  // absent-desktop case without moving a folder. A partial checkout still fails.
  const desktopCheckout = resolve(root, process.env.SLATES_DESKTOP_DIR || '../slate')
  let editorRoutes
  if (existsSync(desktopCheckout)) {
    editorRoutes = await readFile(desktopSource('src/main/agent/routes-editor.ts'), 'utf8')
    const caps = await readFile(desktopSource('src/main/agent/server.ts'), 'utf8')
    assert(caps.includes("'ad-variant-export'"), 'desktop capability must land first')
  } else {
    console.log(`SKIP: desktop capability declaration and editor-route presence assertions; desktop checkout absent: ${desktopCheckout}`)
  }
  const calls = [], gates = []
  const receipt = { version: 2, batchId: 'check-batch', manifestPath: 'frozen/slates-manifest.json', running: true,
    outputs: [{ key: `${timelineId}:catalog-aspect:mp4`, adName: 'angle-A', fileName: 'desktop-owned.mp4' }] }
  const desktop = {
    requireCapability: async cap => { gates.push(cap) },
    get: async (path, input) => { calls.push(['GET', path, input]); return receipt },
    post: async (path, input) => { calls.push(['POST', path, input]); return receipt },
  }
  const ctx = { desktop: () => desktop, cloud: () => { throw new Error('Billable/cloud call forbidden') } }
  const invoke = async (name, input) => byId.get(name).run(byId.get(name).input.parse(input), ctx)
  const batch = { version: 2, projectId, batchId: 'check-batch', exportRoot: 'fixture-root',
    items: [{ timelineId, aspects: ['catalog-aspect'], formats: ['mp4'], taxonomy: { concept: 'angle', variant: 'A', lp: 'landing-key' } }],
    copy: { headline: 'User supplied' }, outputCopy: { output: { cta: 'User supplied' } } }
  assert.deepEqual((await invoke('slates_export_cuts', batch)).data, receipt)
  assert.deepEqual(calls.at(-1)[2], batch, 'do not rewrite names, aspects or copy')
  for (const action of ['start', 'status', 'cancel']) {
    const legacy = { projectId, directory: 'legacy', manifestId: 'v1', action, items: [{ timelineId, format: 'xml' }] }
    gates.length = 0
    await invoke('slates_export_cuts', legacy)
    assert.deepEqual(gates, ['named-cuts'])
    assert.deepEqual(calls.at(-1)[2], legacy)
  }
  for (const [name, input, method, path] of [
    ['slates_export_cuts', batch, 'POST', '/agent/timeline/export-cuts'],
    ['slates_get_export_batch', { projectId, batchId: 'check-batch' }, 'GET', '/agent/timeline/export-cuts/status'],
    ['slates_get_export_batch', { projectId }, 'GET', '/agent/timeline/export-batches'],
    ...['now', 'after-current'].map(mode => ['slates_cancel_export_batch', { projectId, batchId: 'check-batch', mode }, 'POST', '/agent/timeline/export-cuts/cancel']),
    ['slates_get_variant_grid', { projectId }, 'GET', '/agent/timeline/variant-grid'],
    ['slates_get_reframe_report', { projectId, timelineId, clipId, aspect: 'catalog-aspect' }, 'GET', '/agent/timeline/reframe-report'],
    ['slates_reframe_clip', { projectId, timelineId, clipId, aspect: 'catalog-aspect', framing: null }, 'POST', '/agent/timeline/reframe'],
    ['slates_reframe_clip', { projectId, timelineId, clipId, aspect: 'catalog-aspect', framing: { mode: 'fit', focusX: 0.7, zoom: 2 } }, 'POST', '/agent/timeline/reframe'],
    ['slates_update_timeline_settings', { projectId, timelineId, delivery: null }, 'POST', '/agent/timeline/delivery'],
    ['slates_update_timeline_settings', { projectId, timelineId, delivery: { formats: ['catalog-aspect'] }, masterVolume: 1 }, 'POST', '/agent/timeline/update-settings'],
    ['slates_save_timeline', { projectId, timelineId, name: 'Cut', taxonomy: null, gridBinding: { familyId: 'family', slots: { hook: { key: 'choice', choicePosition: 0 } } } }, 'POST', '/agent/timelines'],
    ['slates_set_view', { cut: { format: 'catalog-aspect', gridSelection: { rowKeys: ['row'], aspects: ['catalog-aspect'] } } }, 'POST', '/agent/view'],
    ['slates_export_video', { timelineId, outputPath: '/fixture/output.mp4', aspect: 'catalog-aspect' }, 'POST', '/agent/timeline/export-video'],
  ]) {
    gates.length = 0
    await invoke(name, input)
    assert(gates.includes('ad-variant-export'), `${name} needs capability gate`)
    assert.equal(calls.at(-1)[0], method)
    assert.equal(calls.at(-1)[1], path)
    assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1)[2])), input)
    if (editorRoutes !== undefined) {
      assert(editorRoutes.includes(`r.add('${method}', '${path}'`) || path === '/agent/view', `${path} must exist before op`)
    }
    assert.equal(byId.get(name).annotations.readOnlyHint, method === 'GET')
    const before = calls.length
    const refusing = { ...desktop, requireCapability: async cap => { if (cap === 'ad-variant-export') throw new Error('Update Slates: ad-variant-export required') } }
    await assert.rejects(() => byId.get(name).run(byId.get(name).input.parse(input), { ...ctx, desktop: () => refusing }), /Update Slates/)
    assert.equal(calls.length, before, 'refusal must precede transport')
  }
  for (const id of featureIds) {
    const op = byId.get(id)
    assert.equal(op.billable, false, `${id} must be non-billable`)
    assert.equal(op.annotations.openWorldHint, false)
    assert(op.description.length <= 2048)
  }
  assert.equal(byId.get('slates_export_cuts').input.safeParse({ ...batch, directory: 'mixed-v1' }).success, false)
  assert.equal(byId.get('slates_export_cuts').input.safeParse({ ...batch, items: [] }).success, false)
  assert.equal(byId.get('slates_cancel_export_batch').input.safeParse({ projectId, batchId: 'b', mode: 'invalid' }).success, false)

  // Real stdio MCP -> desktop client -> authenticated loopback HTTP. The fast
  // fixture proves routing only; it is not evidence of long-render safety.
  for (const capable of [false, true]) {
    const requests = []
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      requests.push([req.method, url.pathname])
      let payload
      if (url.pathname === '/agent/healthz') payload = { agentApiVersion: 2, capabilities: capable ? ['named-cuts', 'ad-variant-export'] : ['named-cuts'] }
      else {
        assert.equal(req.headers.authorization, 'Bearer fixture-token')
        assert(['/agent/timeline/export-cuts', '/agent/timeline/export-cuts/status', '/agent/timeline/export-batches'].includes(url.pathname), 'unexpected generation/billing request')
        if (url.searchParams.get('batchId') === 'probe-missing') {
          res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Export batch not found' })); return
        }
        payload = url.pathname.endsWith('export-batches') ? { batches: [receipt] } : receipt
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(payload))
    })
    await new Promise(done => server.listen(0, '127.0.0.1', done))
    try {
      await withClient({ cloud: { token: null }, desktop: { enabled: true, port: server.address().port, token: 'fixture-token' } }, async (client, fixture) => {
        const listed = (await client.listTools()).tools
        assert.deepEqual(listed.map(tool => tool.name), ALL_OPERATIONS.map(op => op.id))
        for (const id of featureIds) assert.deepEqual(listed.find(tool => tool.name === id).annotations, byId.get(id).annotations)
        const status = await promptCall(client, 'slates_get_export_batch', { projectId, batchId: 'check-batch' })
        if (!capable) {
          assert.equal(status.isError, true)
          assert.match(textOf(status), /Update Slates/)
          assert.deepEqual(requests, [['GET', '/agent/healthz']])
        } else {
          assert.deepEqual(status.structuredContent, receipt)
          const started = await promptCall(client, 'slates_export_cuts', batch)
          assert.deepEqual(started.structuredContent, receipt)
          const listedBatches = await promptCall(client, 'slates_get_export_batch', { projectId })
          assert.deepEqual(listedBatches.structuredContent, { batches: [receipt] })
          const missing = await promptCall(client, 'slates_get_export_batch', { projectId, batchId: 'probe-missing' })
          assert.equal(missing.isError, true)
          assert.match(textOf(missing), /Export batch not found/)
          const inputFile = join(fixture.home, 'batch-input.json')
          await writeFile(inputFile, JSON.stringify(batch))
          const cli = await promisify(execFile)(process.execPath, ['--import', fixture.args[1], join(root, 'packages/cli/dist/index.js'),
            'run', 'slates_export_cuts', '--input-file', inputFile, '--json'], { env: fixture.env, timeout: 5000 })
          assert.deepEqual(JSON.parse(cli.stdout).data, receipt, 'CLI must return the same receipt')
        }
        await client.callTool({ name: 'slates_load_tools', arguments: { names: featureIds } })
        assert.deepEqual((await client.listTools()).tools, listed, 'MCP list must stay fixed')
      })
    } finally { await new Promise(done => server.close(done)) }
  }
  assert.equal(toolDefinitions(ALL_OPERATIONS, { surface: 'mcp' }).length, ALL_OPERATIONS.length)
  console.log('ad-variant-export: schemas, legacy forwarding, receipts, verbs, capability refusal, annotations, fixed real MCP listing; zero billable calls passed')
}

async function longBatch() {
  // Use a running verification desktop with its own connection file and real
  // existing media. Never borrow the user's production profile or generation.
  const valueOf = flag => {
    const index = process.argv.indexOf(flag)
    return index < 0 || process.argv[index + 1]?.startsWith('--') ? undefined : process.argv[index + 1]
  }
  const home = valueOf('--home')
  const selectedProject = valueOf('--project-id')
  const exportRoot = valueOf('--export-root')
  if (!home || !selectedProject || !exportRoot) {
    console.error('NOT RUN: --long-batch needs a running isolated desktop. Pass --home (isolated HOME containing .slates/agent-connection.json), --project-id and --export-root. Optional --timeline-ids is a comma-separated selection. Prepare existing cuts whose render stays active for at least ten minutes; no media is generated by this test.')
    process.exitCode = 2
    return
  }
  assert.notEqual((await realpath(home)).toLowerCase(), (await realpath(homedir())).toLowerCase(), 'isolated HOME required')
  const connection = JSON.parse(await readFile(join(home, '.slates/agent-connection.json'), 'utf8'))
  assert(connection.desktop?.enabled && connection.desktop.port && connection.desktop.token, 'running isolated desktop connection required')
  try {
    const production = JSON.parse(await readFile(join(homedir(), '.slates/agent-connection.json'), 'utf8'))
    // Every desktop listens on the same default port, so the port cannot tell them apart. The token can: the
    // isolated desktop's token is rejected by a production desktop, so a call can never act on the real app.
    assert.notEqual(connection.desktop.token, production.desktop?.token, 'refusing the production desktop token')
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  const selectedIds = valueOf('--timeline-ids')?.split(',')
  await withClient({ ...connection, cloud: { token: null } }, async client => {
    const grid = await promptCall(client, 'slates_get_variant_grid', { projectId: selectedProject })
    assert(!grid.isError, textOf(grid))
    const data = grid.structuredContent
    const rows = data.rows.filter(row => row.timelineId && (!selectedIds || selectedIds.includes(row.timelineId)))
    assert(rows.length > 0, 'existing named cuts required')
    const aspects = data.formats.map(format => format.id)
    const batchId = `mcp-long-${Date.now()}`
    const input = { version: 2, projectId: selectedProject, batchId, exportRoot,
      items: [...new Set(rows.map(row => row.timelineId))].map(id => ({ timelineId: id, aspects, formats: ['mp4'] })) }
    console.log(`long-batch request: ${input.items.length} cuts, aspects ${JSON.stringify(aspects)}, first item ${JSON.stringify(input.items[0])}`)
    const listed = (await client.listTools()).tools
    const started = await promptCall(client, 'slates_export_cuts', input)
    assert(!started.isError, textOf(started))
    assert.equal(started.structuredContent.batchId, batchId)
    assert(started.structuredContent.manifestPath && started.structuredContent.outputs.length)
    const began = Date.now(), duration = 10 * 60 * 1000
    let polls = 0
    try {
      while (Date.now() - began < duration) {
        const status = await promptCall(client, 'slates_get_export_batch', { projectId: selectedProject, batchId })
        assert(!status.isError, textOf(status))
        assert.equal(status.structuredContent.running, true, 'fixture ended before ten minutes; long-batch acceptance is unproved')
        polls++
        console.log(`long-batch: ${Math.floor((Date.now() - began) / 1000)}s, poll ${polls}, batch ${batchId}, prompt status response`)
        await new Promise(done => setTimeout(done, 15_000))
      }
      assert(Date.now() - began >= duration)
      const status = await promptCall(client, 'slates_get_export_batch', { projectId: selectedProject, batchId })
      assert(!status.isError, textOf(status))
      assert.equal(status.structuredContent.running, true)
      assert.deepEqual((await client.listTools()).tools, listed)
      assert(featureIds.every(id => byId.get(id).billable === false))
      console.log(`long-batch passed: ${polls + 1} prompt polls over at least ten minutes; real isolated desktop existing-media job, no generation tools called`)
    } finally {
      const stopped = await promptCall(client, 'slates_cancel_export_batch', { projectId: selectedProject, batchId, mode: 'now' })
      assert(!stopped.isError, textOf(stopped))
    }
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--long-batch')) await longBatch()
  else await fastCheck()
}
