#!/usr/bin/env node
// Does the router send each job to the right playbook? (second-brain plans/2026-10-25-slates-brain.md
// § Step 3.) Each ask in routing-cases.json goes to a headless Claude Code session holding exactly
// what every agent holds at the start of a job, the Director card and the router (read from the
// markdown, cut the way the package cuts them), and the session names the playbook it would open
// first. Scored by code: a hit is any name in the case's `expect`.
//
//   node scripts/brain-eval/routing.mjs --root <build of the approved commit> [--model sonnet] [--runs 1] [--cases id,id]
//     [--concurrency 4] [--min 0.9]
//
// Two arms in one batch, their asks interleaved so a slow hour hits both alike: `candidate`, this checkout,
// and `baseline`, the build at --root (a checkout of scoreboard.json approvedCommit, built), which gate.mjs
// compares it with. Without --root only the candidate runs, and the gate refuses the file. An approved brain
// from before the router has no card or router to hand an agent: its arm records `noRouter` and asks nothing.
//
// Runs on the signed-in Claude plan, no tools, no settings, no CLAUDE.md (lib.mjs). Writes
// results/<date>-routing-<model>.json with each arm's root and brain hash (brain-hash.mjs), which gate.mjs
// needs; an arm's hash is null when its markdown differs from its build, since it would then name a brain
// this run did not test. Fails when the candidate is under --min.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { arg, countArg, runClaude, scrubHome } from '../behaviour-ab/lib.mjs'
import { ROUTER, readSkills } from '../brain-lint.mjs'
import { brainHash, unbuiltSkills } from './brain-hash.mjs'
import { brainLayers } from './tokens.mjs'

const here = import.meta.dirname
const model = arg('model', 'sonnet')
const runs = countArg('runs', '1')
const concurrency = countArg('concurrency', '4')
const min = Number(arg('min', '0.9'))
const roots = { candidate: resolve(here, '..', '..'), ...(arg('root') ? { baseline: resolve(arg('root')) } : {}) }
if (!roots.baseline) console.warn('warning: no --root, so no baseline arm; gate.mjs refuses a routing file without one.')

/** What one arm's agent holds: its build's hash and its markdown's card and router, cut as the package cuts them. */
async function armOf(name, root) {
  const skillsDir = join(root, 'packages', 'shared', 'skills')
  if (!existsSync(join(root, 'packages', 'shared', 'dist', 'index.js'))) throw new Error(`${name} arm: no build under ${root} (npm run build there first)`)
  const unbuilt = await unbuiltSkills(root)
  if (unbuilt.length) console.warn(`warning: ${name}: ${unbuilt.length} skills differ from the build (${unbuilt.join(', ')}); this arm records no brain hash and the gate will refuse it. npm run build there first.`)
  const skills = readSkills(skillsDir)
  // The markdown, cut as the package cuts it, so a router edit is tested before a build.
  return { name, root, brainHash: unbuilt.length ? null : await brainHash(root), ...(skills[ROUTER] ? brainLayers(skills) : { noRouter: true }) }
}
const arms = {}
for (const [name, root] of Object.entries(roots)) arms[name] = await armOf(name, root)
if (arms.candidate.noRouter) throw new Error(`the candidate has no router (${ROUTER}); nothing to test`)
const { cases: all } = JSON.parse(readFileSync(join(here, 'routing-cases.json'), 'utf8'))
const wanted = arg('cases')?.split(',')
const cases = all.filter((c) => !wanted || wanted.includes(c.id))

const prompt = ({ card, routerBody }, ask) => [
  'You are the agent inside Slates, an AI video studio. This is what you hold at the start of every job:',
  '',
  '## Start here',
  '',
  card,
  '',
  '## The router',
  '',
  routerBody,
  '',
  '---',
  '',
  `The user says: "${ask}"`,
  '',
  'Which playbook do you open first? Answer with one line and nothing else: `playbook: <name>`, where <name> is a playbook id from the Playbooks table (a rule is not a playbook), `motion-overview` if the router sends this job to that topic, or `none` if no playbook fits and you would ask first.',
].join('\n')

const ARGS = ['-p', '--model', model, '--restricted', '--tools', '', '--strict-mcp-config', '--output-format', 'json']

async function ask(arm, c) {
  const cwd = mkdtempSync(join(tmpdir(), 'slates-brain-route-'))
  try {
    const { code, stdout, error } = await runClaude(ARGS, { prompt: prompt(arm, c.ask), cwd, timeoutMs: 3 * 60_000 })
    if (code !== 0) return { error: error ?? `exited ${code}` }
    const text = String(JSON.parse(stdout).result ?? '')
    const picked = /playbook:\s*`?([a-z0-9-]+)`?/i.exec(text)?.[1]?.toLowerCase() ?? null
    return { picked, raw: text.slice(0, 300) }
  } catch (e) {
    return { error: String(e?.message ?? e) }
  } finally {
    try { rmSync(cwd, { recursive: true, force: true, maxRetries: 3 }) } catch {}
  }
}

const asking = Object.values(arms).filter((a) => !a.noRouter)
const jobs = []
for (let run = 1; run <= runs; run++) for (const c of cases) for (const arm of asking) jobs.push({ arm, c, run })
const results = Object.fromEntries(Object.keys(arms).map((a) => [a, []]))
let next = 0
async function worker() {
  while (next < jobs.length) {
    const { arm, c, run } = jobs[next++]
    const r = await ask(arm, c)
    const hit = !!r.picked && c.expect.includes(r.picked)
    results[arm.name].push({ case: c.id, run, expect: c.expect, ...r, hit })
    console.log(`${hit ? '✓' : '✗'} ${arm.name} ${c.id} #${run}: ${r.picked ?? r.error}${hit ? '' : ` (expected ${c.expect.join(' or ')})`}`)
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker))

const summary = Object.fromEntries(Object.entries(arms).map(([name, arm]) => {
  const rs = results[name].sort((a, b) => a.case.localeCompare(b.case) || a.run - b.run)
  const answered = rs.filter((r) => !r.error)
  const accuracy = answered.length ? answered.filter((r) => r.hit).length / answered.length : arm.noRouter ? 0 : null
  return [name, { root: scrubHome(arm.root), brainHash: arm.brainHash, ...(arm.noRouter ? { noRouter: true } : {}), accuracy, hits: answered.filter((r) => r.hit).length, answered: answered.length, errors: rs.length - answered.length, results: rs }]
}))
const out = join(here, 'results')
mkdirSync(out, { recursive: true })
const file = join(out, `${new Date().toISOString().slice(0, 10)}-routing-${model}.json`)
writeFileSync(file, scrubHome(JSON.stringify({ model, runs, arms: summary }, null, 2)))
for (const [name, x] of Object.entries(summary)) console.log(`routing on ${model}, ${name}: ${x.noRouter ? 'no router in this build' : `${x.hits}/${x.answered} (${Math.round((x.accuracy ?? 0) * 100)}%), ${x.errors} errors`}`)
console.log(`→ ${scrubHome(file)}`)
if (!(summary.candidate.accuracy >= min)) process.exit(1)
