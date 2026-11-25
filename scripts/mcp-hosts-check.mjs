// What the two hosts (the CLI and the MCP server) owe a caller, proven against their built dist:
//
//   1. Neither host reads a Zod schema's internals. An op's fields come from the rendered JSON
//      Schema (`toolDefinition`), so an op behind `.refine()` has the same help, default project
//      and flags as any other. `--self-test` proves the scan goes red.
//   2. A flag reaches the op typed by the shared parse alone: a literal-union number is repaired,
//      and a boolean word that is not true/false is refused by name, never read as false.
//   3. The CLI's exit code follows the error's type: a revoked token is 6, a closed app is 5.
//   4. `slates use` survives the desktop app rewriting the connection file.
//   5. An op whose `confirm` is required runs on an asking host only after the user's yes.
//   6. `slates doctor` finds a Slates server entry, not the word "slates".
//
// Why: each was a live bug on 2026-11-24. Needs `npm run build` (the three dists).
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── 1. No Zod internals in a host ──
const HOSTS = ['packages/mcp/src', 'packages/cli/src']
const ZOD_INTERNALS = /\b_def\b|\.typeName\b/
const violations = (text) =>
  text.split('\n').flatMap((line, i) => (ZOD_INTERNALS.test(line) && !line.trim().startsWith('//') ? [i + 1] : []))
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.ts$/.test(name)) out.push(full)
  }
  return out
}
if (process.argv.includes('--self-test')) {
  for (const line of ["if (z?._def?.typeName !== 'ZodObject') return {}", 'const shape = def.shape(); return op.input._def']) {
    assert.equal(violations(line).length, 1, `self-test: missed ${line}`)
  }
  assert.equal(violations('const { properties } = toolDefinition(op).inputSchema').length, 0, 'self-test: flagged the rendered schema')
}
const found = HOSTS.flatMap((dir) =>
  walk(join(root, dir)).flatMap((file) => violations(readFileSync(file, 'utf8')).map((n) => `${relative(root, file)}:${n}`))
)
assert.deepEqual(found, [], `A host reads a Zod schema's internals, which sees nothing behind .refine():\n  ${found.join('\n  ')}\nRead the op's fields from toolDefinition(op).inputSchema.`)

// A home of its own, set before the shared package reads it: nothing here touches the real ~/.slates.
const home = mkdtempSync(join(tmpdir(), 'slates-mcp-hosts-'))
process.env.HOME = home
process.env.USERPROFILE = home
process.env.APPDATA = join(home, 'AppData', 'Roaming')
try {
  const shared = await import(new URL('../packages/shared/dist/index.js', import.meta.url))
  const { SlatesCloudHttpError } = await import(new URL('../packages/shared/dist/clients/cloud.js', import.meta.url))
  const { buildOpInput, prepareOpCall } = await import(new URL('../packages/cli/dist/commands/op.js', import.meta.url))
  const { EXIT, exitFor } = await import(new URL('../packages/cli/dist/exit-codes.js', import.meta.url))
  const { inspectJsonMcpConfigs } = await import(new URL('../packages/cli/dist/commands/mcp-config.js', import.meta.url))
  const { confirmGate, runWithConsent } = await import(new URL('../packages/mcp/dist/confirm-gate.js', import.meta.url))
  assert.ok(shared.AGENT_DIR.startsWith(home), 'the shared package must be reading the temp home')

  const op = (id) => shared.ALL_OPERATIONS.find((o) => o.id === id)
  const PROJECT = '8652884a-16ac-4531-b1f0-3d5ec5ea2b52'
  const out = join(home, 'out.mp4')

  // ── 2. Flags, through the one parse ──
  const projectScoped = shared.ALL_OPERATIONS.filter((o) => Object.hasOwn(shared.toolDefinition(o).inputSchema.properties ?? {}, 'projectId'))
  for (const o of projectScoped) {
    assert.equal(buildOpInput(o, [], () => PROJECT).projectId, PROJECT, `${o.id} takes projectId and did not get the default project`)
  }
  assert.equal(buildOpInput(op('slates_export_video'), ['--projectId', 'mine'], () => PROJECT).projectId, 'mine', 'an explicit --projectId wins')

  const run = (id, flags) => shared.prepareOperation(op(id), buildOpInput(op(id), flags, () => PROJECT))
  const exported = run('slates_export_video', ['--outputPath', out, '--fps', '30', '--overwrite', 'true', '--audioBitrate', '192'])
  assert.ok(exported.ok, `slates_export_video from flags: ${exported.message}`)
  assert.deepEqual(
    [exported.call.input.projectId, exported.call.input.fps, exported.call.input.overwrite, exported.call.input.audioBitrate],
    [PROJECT, 30, true, 192],
    'a refined op gets the default project, and a literal-union number and a boolean arrive typed'
  )
  assert.equal(run('slates_export_video', ['--outputPath', out, '--fps', 'null']).call?.input.fps, null, '--fps null is null where the field allows it')
  // The default project is a guess: an export named by its timeline goes out without it.
  const TIMELINE = '55555555-5555-4555-8555-555555555555'
  for (const id of ['slates_export_video', 'slates_export_timeline_xml']) {
    const byTimeline = prepareOpCall(op(id), ['--timelineId', TIMELINE, '--outputPath', id.endsWith('xml') ? join(home, 'out.xml') : out], () => PROJECT)
    assert.ok(byTimeline.ok, `${id} by timeline with a default project set: ${byTimeline.message}`)
    assert.deepEqual([byTimeline.call.input.projectId, byTimeline.call.input.timelineId], [undefined, TIMELINE])
  }
  assert.equal(prepareOpCall(op('slates_export_video'), ['--outputPath', out], () => PROJECT).call?.input.projectId, PROJECT, 'with no timeline the default project still fills')
  assert.equal(prepareOpCall(op('slates_get_variants'), ['--timelineId', TIMELINE], () => PROJECT).call?.input.projectId, PROJECT, 'an op that takes both keeps the default project')
  const mistake = prepareOpCall(op('slates_export_timeline_xml'), ['--timelineId', TIMELINE, '--outputPath', out], () => PROJECT).message
  assert.ok(/\.xml/.test(mistake) && !/exactly one of/.test(mistake), `a real mistake is named without the guessed project: ${mistake}`)
  assert.doesNotMatch(prepareOpCall(op('slates_get_variants'), ['--timelineId', 'not-a-uuid'], () => PROJECT).message, /projectId/, 'and the default project is kept where the op needs one')
  const badFps = run('slates_export_video', ['--outputPath', out, '--fps', '45'])
  assert.ok(!badFps.ok && /fps/.test(badFps.message), 'a frame rate outside the union still fails, naming fps')
  for (const word of ['on', 'yes', 'True', '1']) {
    const wrong = run('slates_export_video', ['--outputPath', out, '--overwrite', word])
    assert.ok(!wrong.ok && /overwrite/.test(wrong.message), `--overwrite ${word} must be refused by name, never read as false`)
  }
  // A number arrives as a string from a shell flag or a model: every decimal spelling is read, nothing else is.
  const { z } = await import('zod/v3')
  const numbered = { id: 'numbered', input: z.object({ n: z.number() }) }
  for (const [typed, n] of [['.5', 0.5], ['-.5', -0.5], ['5.', 5], ['+5', 5], ['1e3', 1000], [' 2.5 ', 2.5]]) {
    const parsed = shared.parseOperationInput(numbered, { n: typed })
    assert.ok(parsed.ok && parsed.input.n === n, `"${typed}" is read as ${n}`)
  }
  for (const typed of ['', 'Infinity', '0x10', 'on', '1e', '.']) {
    assert.ok(!shared.parseOperationInput(numbered, { n: typed }).ok, `"${typed}" is not a number and is refused`)
  }

  const images = buildOpInput(op('slates_generate_image'), ['--prompt', 'a, b', '--referenceAssetIds', 'IMG-A1,IMG-A2'], () => null)
  assert.deepEqual([images.prompt, images.referenceAssetIds], ['a, b', ['IMG-A1', 'IMG-A2']], 'a list flag splits on commas; a string flag never does')

  // ── 3. Exit codes ──
  const revoked = new SlatesCloudHttpError(
    "slates-api /credits rejected the auth token (401) — it's expired or was revoked. To reconnect, run `slates login` (CLI) or reconnect in Slates → Settings → AI tools", 401)
  assert.equal(exitFor(revoked), EXIT.NOT_SIGNED_IN, 'a revoked token is "not signed in", whatever its message names')
  assert.equal(exitFor(new shared.MissingCloudTokenError()), EXIT.NOT_SIGNED_IN)
  assert.equal(exitFor(new shared.MissingDesktopServerError()), EXIT.DESKTOP_UNREACHABLE)
  assert.equal(exitFor(new SlatesCloudHttpError('slates-api /projects/3f4012ab failed (404): not found', 404)), EXIT.ERROR, 'a 404 is an error')
  assert.equal(exitFor(new Error('Project 3f4012ab-0000 not found')), EXIT.ERROR, 'an id containing 401 is not a sign-in failure')
  // The real client against a port nothing listens on.
  const { createServer } = await import('node:net')
  const closedPort = await new Promise((done) => {
    const probe = createServer().listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => done(port)) })
  })
  shared.writeConnection({ cloud: { token: null }, desktop: { enabled: true, port: closedPort, token: 'slates_desktop_fixture' } })
  const refused = await new shared.SlatesDesktopClient().get('/agent/projects').then(() => null, (err) => err)
  assert.ok(refused, 'a closed port must fail')
  assert.equal(exitFor(refused), EXIT.DESKTOP_UNREACHABLE, `a closed app is "desktop unreachable": ${refused.message}`)

  // ── 4. `slates use` and the connection file ──
  /** What the desktop app does on every start and sign-in: the whole file, with the fields it knows. */
  const desktopRewrites = () => writeFileSync(shared.CONNECTION_FILE, JSON.stringify({ cloud: { token: 'slates_sk_x' }, desktop: { enabled: true, port: 1, token: 't' } }))
  shared.setDefaultProjectId(PROJECT)
  desktopRewrites()
  assert.equal(shared.readDefaultProjectId(), PROJECT, 'the default project survives the desktop rewriting the connection file')
  shared.setDefaultProjectId(null)
  assert.equal(shared.readDefaultProjectId(), null, '`slates use --clear` clears it')
  // A default an earlier CLI left in the connection file is carried over before the desktop drops it.
  rmSync(shared.CLI_STATE_FILE)
  writeFileSync(shared.CONNECTION_FILE, JSON.stringify({ cloud: { token: null }, desktop: { enabled: false, port: null, token: null }, defaultProjectId: PROJECT, fromANewerApp: 7 }))
  assert.equal(shared.readDefaultProjectId(), PROJECT)
  shared.setCloudToken('slates_sk_y')
  assert.equal(JSON.parse(readFileSync(shared.CONNECTION_FILE, 'utf8')).fromANewerApp, 7, "the CLI's write keeps a field it does not know")
  desktopRewrites()
  assert.equal(shared.readDefaultProjectId(), PROJECT, 'and the carried-over default outlives the next rewrite')

  // ── 5. Required confirm: the user is asked before the op runs ──
  const gates = shared.ALL_OPERATIONS.map((o) => [o, confirmGate(shared.toolDefinition(o).inputSchema)])
  const serverAsks = gates.filter(([, gate]) => gate === 'server-asks').map(([o]) => o)
  for (const id of ['slates_finish_draft', 'slates_finish_cut_drafts']) {
    assert.ok(serverAsks.some((o) => o.id === id) || confirmGate(shared.toolDefinition(op(id)).inputSchema) === 'op-asks', `${id} has no consent gate`)
  }
  for (const o of serverAsks) {
    for (const [answer, runs] of [[false, 0], [true, 1], [null, 1]]) {
      const asked = []
      let ran = 0
      const outcome = await runWithConsent({
        opId: o.id, gate: 'server-asks', args: { confirm: true, maxCredits: 500 }, hostCanAsk: true,
        run: async (patch) => { ran++; assert.equal(patch, undefined, 'the op runs as the model sent it'); return { text: 'ran' } },
        ask: async (message) => { asked.push(message); return answer },
      })
      assert.equal(asked.length, 1, `${o.id}: the user is asked once`)
      assert.match(asked[0], new RegExp(`${o.id}.*500 credits`), 'the question names the op and the ceiling')
      assert.equal(ran, runs, `${o.id}: answer ${answer} must run it ${runs} time(s)`)
      assert.equal('declined' in outcome, answer === false)
    }
  }
  // An approved quote runs under the request id it was quoted with, so a retry cannot pay twice.
  const patches = []
  await runWithConsent({
    opId: 'slates_upscale_image', gate: 'op-asks', args: {}, hostCanAsk: true,
    run: async (patch) => { patches.push(patch); return patch?.confirm ? { text: 'ran' } : { text: 'quote', data: { requires_confirm: true, requestId: 'R1', message: 'Cost' } } },
    ask: async () => true,
  })
  assert.deepEqual(patches, [undefined, { requestId: 'R1', confirm: true }], 'the confirmed run carries the quote’s request id')
  // The amount the user approved binds the run: the quote's own approvedCredits, never the model's figure.
  const bound = []
  await runWithConsent({
    opId: 'slates_generate_video', gate: 'op-asks', args: { confirm: true, approvedCredits: 9999 }, hostCanAsk: true,
    run: async (patch) => { bound.push(patch); return patch?.confirm ? { text: 'ran' } : { text: 'quote', data: { requires_confirm: true, estimated_credits: 60, approvedCredits: 60, message: 'Cost: 60 credits' } } },
    ask: async () => true,
  })
  assert.deepEqual(bound, [{ confirm: undefined }, { approvedCredits: 60, confirm: true }], 'the confirmed run is held to the approved quote, not the 9999 the model sent')
  const dropped = []
  await runWithConsent({
    opId: 'slates_generate_image', gate: 'op-asks', args: { approvedCredits: 9999 }, hostCanAsk: true,
    run: async (patch) => { dropped.push(patch); return patch?.confirm ? { text: 'ran' } : { text: 'quote', data: { requires_confirm: true, message: 'Cost' } } },
    ask: async () => true,
  })
  assert.deepEqual(dropped.at(-1), { approvedCredits: undefined, confirm: true }, 'a figure the quote did not name is dropped from the confirmed run')
  // End to end on the real op: the price rises while the form is open, and the confirmed run asks again.
  let videoQuote = { costKey: 'seedance-2.5-720p-5s', credits: 60 }
  const videoSent = []
  const videoCtx = {
    cloud: () => ({ get: async (path) => { const key = new URL(path, 'http://x').searchParams.get('costKey'); return { models: [{ model: key ?? videoQuote.costKey, cost_credits: videoQuote.credits }] } } }),
    desktop: () => ({
      hasCapability: async () => true, requireCapability: async () => {},
      get: async () => ({ assets: [] }),
      quote: async () => videoQuote,
      post: async (path, body) => { videoSent.push([path, body]); return { success: true, background: true, generationId: 'g' } },
    }),
  }
  const video = shared.prepareOperation(op('slates_generate_video'), { projectId: PROJECT, model: 'seedance-2.5', prompt: 'A lighthouse at dusk.', aspectRatio: '16:9', duration: 5, videoResolution: '720p', background: true })
  const rose = await runWithConsent({
    opId: 'slates_generate_video', gate: 'op-asks', args: video.call.input, hostCanAsk: true,
    run: (patch) => video.call.run(videoCtx, patch),
    ask: async () => { videoQuote = { costKey: 'seedance-2.5-720p-6s', credits: 72 }; return true },
  })
  assert.deepEqual([rose.data?.quote_exceeded, rose.data?.estimated_credits, videoSent.length], [true, 72, 0], 'a quote that rose while the form was open runs nothing and names the new price')
  // A failed upscale names the id its retry must reuse.
  const upscaleCtx = { desktop: () => ({
    requireCapability: async () => {},
    get: async (path) => path === '/agent/generation/upscale-quote'
      ? { credits: 1, factor: 2, width: 10, height: 10, outWidth: 20, outHeight: 20, code: 'IMG-A1' }
      : { assets: [{ id: PROJECT, projectId: PROJECT, code: 'IMG-A1', type: 'image', label: 'Still' }] },
    post: async () => { throw new Error('socket hang up') },
  }) }
  const retryId = '44444444-4444-4444-8444-444444444444'
  await assert.rejects(op('slates_upscale_image').run({ projectId: PROJECT, assetId: PROJECT, factor: 2, confirm: true, requestId: retryId }, upscaleCtx),
    new RegExp(`socket hang up.*requestId=${retryId}`), 'the error text carries the request id')
  let ranUnasked = 0
  await runWithConsent({ opId: 'x', gate: 'server-asks', args: { confirm: true }, hostCanAsk: false, run: async () => { ranUnasked++; return { text: 'ran' } }, ask: async () => assert.fail('a host that cannot ask is not asked') })
  assert.equal(ranUnasked, 1, 'on a host with no form the call stands as sent')

  // ── 6. doctor: a server entry, not a word ──
  const claudeCode = join(home, '.claude.json')
  const cursor = join(home, '.cursor', 'mcp.json')
  mkdirSync(dirname(cursor), { recursive: true })
  writeFileSync(claudeCode, JSON.stringify({ projects: { 'C:/Coding Projects/slates': { mcpServers: {}, history: ['open slates'] } } }))
  writeFileSync(cursor, JSON.stringify({ mcpServers: { other: { command: 'npx', args: ['-y', 'slates-notes'] } } }))
  assert.deepEqual(inspectJsonMcpConfigs([claudeCode, cursor]).configured, [], 'a folder or a note named slates is not a server')
  writeFileSync(claudeCode, JSON.stringify({ projects: { 'C:/work': { mcpServers: { slates: { command: 'npx', args: ['-y', '@slatesvideo/mcp-server'] } } } } }))
  writeFileSync(cursor, JSON.stringify({ mcpServers: { studio: { command: 'npx', args: ['-y', '@slatesvideo/mcp-server'] } } }))
  assert.deepEqual(inspectJsonMcpConfigs([claudeCode, cursor]).configured, [claudeCode, cursor], 'an entry is found by name, under a project, or by the package it launches')

  console.log(`mcp-hosts: no Zod internals in a host; ${projectScoped.length} project-scoped ops take the default project; flags are typed by the shared parse; exit codes follow the error type; the default project outlives a desktop rewrite; ${serverAsks.length} required-confirm op(s) ask the user first; doctor reads server entries`)
} finally {
  rmSync(home, { recursive: true, force: true })
}
