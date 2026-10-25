// Runs the behaviour A/B: each case, in each arm, `--runs` times, as a headless
// Claude Code session against that arm's built MCP server and the fixture.
//
//   node scripts/behaviour-ab/run.mjs --baseline <slates-mcp checkout> --candidate <slates-mcp checkout> \
//     --out scripts/behaviour-ab/results/<date> [--cases-file <json>] [--cases id,id] [--arms baseline,candidate] [--runs 2] [--from-run 1] \
//     [--model claude-opus-5-5] [--concurrency 3] [--desktop <slate dir>]
//
// Each arm must be built (packages/shared/dist and packages/mcp/dist). Every run
// gets its own fixture, throwaway HOME and empty working folder; the batch shares
// one price list, fetched once. The session is `--restricted --tools ToolSearch`
// (no shell, file or web tools; user, project and local settings ignored, so no
// hooks), with CLAUDE.md memory off, `--strict-mcp-config` (this server only) and
// `--permission-mode dontAsk`: the arm's read-only tools are allowed, every other
// Slates tool is denied when called and the attempt is recorded, and every
// billable tool and the Blender bridge (it reaches a real Blender on this machine)
// are removed with --disallowedTools. Runs use the signed-in Claude plan.

import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { brainHash } from '../brain-eval/brain-hash.mjs'
import { fetchPriceList, startFixture, SHOT_COST_KEY } from './fixture.mjs'
import { armHome, realCloudToken } from './home.mjs'
import { arg, countArg, runClaude, scrubHome } from './lib.mjs'
import { balancesIn, pricedIn } from './score.mjs'

const here = import.meta.dirname
const repo = resolve(here, '..', '..')
const out = resolve(arg('out', join(here, 'results', new Date().toISOString().slice(0, 10))))
const model = arg('model', 'claude-opus-5-5')
const runs = countArg('runs', '2')
// Runs from --from-run to --runs, so more runs of a few cases add traces beside the first ones.
const fromRun = countArg('from-run', '1')
if (fromRun > runs) throw new Error('--from-run is past --runs')
const concurrency = countArg('concurrency', '3')
const desktopDir = resolve(arg('desktop', process.env.SLATES_DESKTOP_DIR ?? join(repo, '..', 'slate')))
const armDirs = { baseline: arg('baseline') && resolve(arg('baseline')), candidate: resolve(arg('candidate', repo)) }
const arms = arg('arms', 'baseline,candidate').split(',')
// Another case set in the same shape, such as the brain's craft briefs (scripts/brain-eval/craft-cases.json).
const { cases: allCases } = JSON.parse(readFileSync(resolve(arg('cases-file', join(here, 'cases.json'))), 'utf8'))
const wanted = arg('cases') ? arg('cases').split(',') : null
const unknownCases = (wanted ?? []).filter((id) => !allCases.some((c) => c.id === id))
if (unknownCases.length) throw new Error(`No such case: ${unknownCases.join(', ')}`)
const cases = allCases.filter((c) => !wanted || wanted.includes(c.id))
const SERVER = 'slates'
const TOOL_RESULT_CHARS = 6000
const RUN_TIMEOUT_MS = 15 * 60_000

/** Which tools the arm allows and removes, read from that arm's own build. */
async function armTools(dir) {
  const shared = await import(pathToFileURL(join(dir, 'packages', 'shared', 'dist', 'index.js')).href)
  const defs = shared.toolDefinitions(shared.ALL_OPERATIONS, { surface: 'mcp' })
  const blender = defs.map((d) => d.name).filter((n) => n.startsWith('slates_blender_'))
  const readOnly = defs.filter((d) => d.annotations?.readOnlyHint && !blender.includes(d.name)).map((d) => d.name)
  const billable = shared.ALL_OPERATIONS.filter((op) => op.billable).map((op) => op.id)
  // slates_load_tools only searches the catalog; its hint is not read-only because it changes the desktop's loaded set.
  const allowed = [...new Set([...readOnly, 'slates_load_tools'])]
  return { allowed, removed: [...billable, ...blender], billable, all: defs.map((d) => d.name) }
}

const prefix = (name) => `mcp__${SERVER}__${name}`

function claudeArgs(mcpConfig, tools) {
  return [
    '-p',
    '--model', model,
    '--restricted',
    '--tools', 'ToolSearch',
    '--strict-mcp-config',
    '--mcp-config', mcpConfig,
    '--permission-mode', 'dontAsk',
    '--allowedTools', ['ToolSearch', ...tools.allowed.map(prefix)].join(','),
    '--disallowedTools', tools.removed.map(prefix).join(','),
    '--output-format', 'stream-json',
    '--verbose',
  ]
}

/** Stream-json lines to a trace: the calls in order, trimmed results with their numbers, the reply and the usage. */
function toTrace(stdout) {
  const events = []
  let result = null
  let init = null
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue
    let ev
    try { ev = JSON.parse(line) } catch { continue }
    if (ev.type === 'system' && ev.subtype === 'init') init = { model: ev.model, tools: (ev.tools ?? []).length, mcp_servers: ev.mcp_servers }
    if (ev.type === 'assistant') {
      for (const block of ev.message?.content ?? []) {
        if (block.type === 'tool_use') events.push({ kind: 'call', id: block.id, name: block.name, input: block.input })
        if (block.type === 'text' && block.text.trim()) events.push({ kind: 'text', text: block.text })
      }
    }
    if (ev.type === 'user') {
      for (const block of ev.message?.content ?? []) {
        if (block.type !== 'tool_result') continue
        const text = typeof block.content === 'string' ? block.content : (block.content ?? []).map((c) => (c.type === 'text' ? c.text : `[${c.type}]`)).join('\n')
        events.push({
          kind: 'result',
          id: block.tool_use_id,
          error: !!block.is_error,
          text: text.length > TOOL_RESULT_CHARS ? `${text.slice(0, TOOL_RESULT_CHARS)}\n[trimmed ${text.length - TOOL_RESULT_CHARS} chars]` : text,
          // Read before the trim, so a price copied from row 400 of a long list, or a balance late in a long
          // result, still counts as sourced.
          priced: pricedIn(text),
          balances: balancesIn(text),
          // The router the server attaches once a connection (ROUTER_NOTICE in shared), at the end of a result.
          ...(/This session has not opened the router \(slates-start-here\)/.test(text) ? { router: true } : {}),
        })
      }
    }
    if (ev.type === 'result') result = ev
  }
  return {
    init,
    events,
    reply: result?.result ?? null,
    usage: result?.usage ?? null,
    turns: result?.num_turns ?? null,
    durationMs: result?.duration_ms ?? null,
    denials: (result?.permission_denials ?? []).map((d) => ({ name: d.tool_name, input: d.tool_input })),
    isError: result?.is_error ?? true,
  }
}

async function oneRun(job, tools, priceList) {
  const base = mkdtempSync(join(tmpdir(), `slates-ab-${job.arm}-${job.case.id}-`))
  const home = join(base, 'home')
  const cwd = join(base, 'work')
  mkdirSync(cwd, { recursive: true })
  const started = Date.now()
  let fixture = null
  let trace
  try {
    fixture = await startFixture({ desktopDir, priceList })
    const env = armHome(home, fixture.port)
    const mcpConfig = join(base, 'mcp.json')
    writeFileSync(mcpConfig, JSON.stringify({
      mcpServers: { [SERVER]: { command: process.execPath, args: [join(armDirs[job.arm], 'packages', 'mcp', 'dist', 'server.js')], env } },
    }, null, 2))
    const { code, stdout, stderr, error, timedOut } = await runClaude(claudeArgs(mcpConfig, tools), { prompt: job.case.prompt, cwd, timeoutMs: RUN_TIMEOUT_MS })
    trace = {
      exitCode: code,
      ...toTrace(stdout),
      timedOut: timedOut || undefined,
      spawnError: error,
      stderr: stderr.slice(-2000) || undefined,
    }
  } catch (error) {
    trace = { exitCode: null, events: [], reply: null, usage: null, denials: [], isError: true, spawnError: String(error?.message ?? error) }
  } finally {
    await fixture?.close()
    // Only the folder this run made; Windows can hold a file a moment after the session exits.
    try { rmSync(base, { recursive: true, force: true, maxRetries: 3 }) } catch {}
  }
  trace = {
    case: job.case.id,
    arm: job.arm,
    run: job.run,
    model,
    wallMs: Date.now() - started,
    ...trace,
    fixtureRequests: (fixture?.requests ?? []).map(({ method, path, query, status }) => ({ method, path, query, status })),
  }
  const file = join(out, 'traces', `${job.case.id}.${job.arm}.${job.run}.json`)
  writeFileSync(file, scrubHome(JSON.stringify(trace, null, 2)))
  return trace
}

mkdirSync(join(out, 'traces'), { recursive: true })
const toolsByArm = {}
// The brain each arm's build hands an agent, so a result can be tied to the brain it tested (brain-eval/gate.mjs).
const hashByArm = {}
for (const arm of arms) {
  if (!armDirs[arm] || !existsSync(join(armDirs[arm], 'packages', 'mcp', 'dist', 'server.js'))) throw new Error(`Arm ${arm}: no built server under ${armDirs[arm]}`)
  toolsByArm[arm] = await armTools(armDirs[arm])
  hashByArm[arm] = await brainHash(armDirs[arm])
}

// One price list for the whole batch, so both arms quote from the same data.
const priceList = await fetchPriceList(realCloudToken())
const priceRows = priceList.models ?? []
if (!priceRows.length) throw new Error('The price list came back empty: check the cloud token in ~/.slates/agent-connection.json')
if (!priceRows.some((m) => m.model === SHOT_COST_KEY)) console.warn(`warning: the price list has no ${SHOT_COST_KEY}, which the fixture's Shots quote at`)

// arms.json keeps every arm a re-run into this folder leaves out, so `--cases x --arms candidate` still scores.
const armsFile = join(out, 'arms.json')
const before = existsSync(armsFile) ? JSON.parse(readFileSync(armsFile, 'utf8')) : null
const desktop = scrubHome(desktopDir)
const priceListHash = createHash('sha256').update(JSON.stringify(priceRows)).digest('hex').slice(0, 16)
if (before) {
  if (before.model !== model) throw new Error(`${armsFile} was run on ${before.model}; use another --out for ${model}`)
  if (before.desktop !== desktop) throw new Error(`${armsFile} was run against ${before.desktop}; use another --out for ${desktop}`)
  for (const a of arms) {
    const was = before.arms?.[a]?.dir
    if (was && was !== scrubHome(armDirs[a])) throw new Error(`${armsFile} ran ${a} from ${was}; use another --out for ${scrubHome(armDirs[a])}`)
  }
  if (before.priceListHash && before.priceListHash !== priceListHash) console.warn("warning: the price list changed since this folder's first batch; re-run cases quote from the new one")
}
writeFileSync(armsFile, scrubHome(JSON.stringify({
  model,
  runs: Math.max(runs, before?.runs ?? 0),
  desktop,
  priceListRows: priceRows.length,
  priceListHash: before?.priceListHash ?? priceListHash,
  arms: {
    ...(before?.arms ?? {}),
    ...Object.fromEntries(arms.map((a) => [a, { dir: armDirs[a], brainHash: hashByArm[a], allowed: toolsByArm[a].allowed, removed: toolsByArm[a].removed, billable: toolsByArm[a].billable, tools: toolsByArm[a].all.length }])),
  },
}, null, 2)))

// Interleave arms so a slow hour or a plan limit hits both alike.
const jobs = []
for (let run = fromRun; run <= runs; run++) for (const c of cases) for (const arm of arms) jobs.push({ case: c, arm, run })
let next = 0
let done = 0
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++]
    const trace = await oneRun(job, toolsByArm[job.arm], priceList)
    done++
    const calls = trace.events.filter((e) => e.kind === 'call').length
    const server = trace.init?.mcp_servers?.find((s) => s.name === SERVER)?.status ?? 'no init'
    console.log(`[${done}/${jobs.length}] ${job.case.id} ${job.arm} #${job.run}: exit ${trace.exitCode}, server ${server}, ${calls} calls, ${trace.denials.length} denied, ${Math.round(trace.wallMs / 1000)}s${trace.spawnError ? `, ${trace.spawnError}` : ''}`)
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker))
console.log(`traces in ${join(out, 'traces')}`)
