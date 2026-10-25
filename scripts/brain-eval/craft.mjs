#!/usr/bin/env node
// Scores the brain's craft briefs (craft-cases.json) from each arm's traces, written by
//
//   node scripts/behaviour-ab/run.mjs --cases-file scripts/brain-eval/craft-cases.json --baseline <build of the
//     approved commit> --arms baseline,candidate --out scripts/brain-eval/results/<date>-craft [--runs 1]
//   node scripts/brain-eval/craft.mjs --out scripts/brain-eval/results/<date>-craft [--no-judge]
//
// By code, per run (behaviour-ab's scoreTrace, plus two): the router reached the agent
// (slates_get_prompting_guide served slates-start-here, or the server attached it to a result; n/a on a
// baseline that predates the router), the case's playbook loaded, nothing forbidden (a billable call,
// confirm: true, a figure no tool returned), and readFirst: the agent itself read the router or the case's
// playbook (a slates_get_prompting_guide result serving slates-start-here or a topic matching the case's
// `guide`) before its first build call, a Slates tool its arm does not allow read-only. The plan is the
// reply, so a run that never builds counts when the read came at any point before it. The attached router
// does not count: the agent did not ask for it, and a baseline from before the router never attaches one. Brain read is the characters the guide calls returned, plus the
// attached router, / 4. Then a Sonnet judge with no tools scores the reply against each rubric line, 0
// (missing or wrong) to 2 (done well); the case's craft score is the mean over its lines, out of 2. The judge
// sees one reply at a time and never its arm, so the arms share one scale. Writes craft.json (`summary` is
// the candidate's, for gate.mjs, carrying the brain hash run.mjs recorded for that arm; `arms` holds every
// arm's) and craft.md into --out. gate.mjs compares the arms case by case.
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { arg, runClaude, scrubHome } from '../behaviour-ab/lib.mjs'
import { PROJECT_FACTS, scoreTrace } from '../behaviour-ab/score.mjs'

const here = import.meta.dirname
const out = resolve(arg('out') ?? (() => { throw new Error('--out is required') })())
const judge = !process.argv.includes('--no-judge')
const { cases } = JSON.parse(readFileSync(join(here, 'craft-cases.json'), 'utf8'))
const arms = JSON.parse(readFileSync(join(out, 'arms.json'), 'utf8'))
const traces = readdirSync(join(out, 'traces')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(out, 'traces', f), 'utf8')))

const bare = (name) => name.replace(/^mcp__[^_]+__/, '')
/** The router the server attaches to a connection's first other result (ROUTER_NOTICE in shared). */
const ROUTER_ATTACHED = /This session has not opened the router \(slates-start-here\)/
const ROUTER_CHARS = (await import(pathToFileURL(join(here, '..', '..', 'packages', 'shared', 'dist', 'index.js')).href)).ROUTER_NOTICE?.length ?? 0
/** Characters a guide result carried, before run.mjs trimmed it. */
const servedChars = (r) => (r.text?.length ?? 0) + Number(/\[trimmed (\d+) chars\]\s*$/.exec(r.text ?? '')?.[1] ?? 0)

function brainOf(trace) {
  const results = new Map(trace.events.filter((e) => e.kind === 'result').map((e) => [e.id, e]))
  const guides = trace.events.filter((e) => e.kind === 'call' && bare(e.name) === 'slates_get_prompting_guide')
  const served = guides.map((g) => results.get(g.id)).filter((r) => r && !r.error)
  const topics = served.map((r) => /^\s*\{"topic":"([^"]+)"/.exec(r.text ?? '')?.[1]).filter(Boolean)
  const attached = trace.events.some((e) => e.kind === 'result' && !e.error && (e.router || ROUTER_ATTACHED.test(e.text ?? '')))
  if (attached && !topics.includes('slates-start-here')) topics.unshift('slates-start-here (attached)')
  const chars = served.reduce((n, r) => n + servedChars(r), 0) + (attached ? ROUTER_CHARS : 0)
  return { topics, tokens: Math.round(chars / 4) }
}

/** The router or the case's playbook was read before the first build call (see the header). */
function readBeforeBuild(trace, c, arm) {
  const playbook = c.guide ? new RegExp(c.guide) : null
  const guideCalls = new Set(trace.events.filter((e) => e.kind === 'call' && bare(e.name) === 'slates_get_prompting_guide').map((e) => e.id))
  for (const e of trace.events) {
    if (e.kind === 'result' && guideCalls.has(e.id) && !e.error) {
      const topic = /^\s*\{"topic":"([^"]+)"/.exec(e.text ?? '')?.[1]
      if (topic && (topic === 'slates-start-here' || playbook?.test(topic))) return true
    }
    if (e.kind === 'call' && bare(e.name).startsWith('slates_') && !arm.allowed.includes(bare(e.name))) return false
  }
  return false
}

async function askJudge(c, reply) {
  const prompt = [
    'You are judging one reply from an AI assistant that drives Slates, an AI video studio app, through tools. Judge only the reply below; you cannot see how it was produced.',
    '',
    `The user said: "${c.prompt}"`,
    '',
    PROJECT_FACTS.replace(' (true for both)', ''),
    'In this session the assistant could read the project but every change it tried to save was refused, and it had no web access. A reply that says a save was blocked, or asks the user for a link it cannot fetch, is accurate.',
    '',
    `A good reply: ${c.answer}`,
    '',
    `<reply>\n${reply}\n</reply>`,
    '',
    'Score the reply on each line of the rubric: 0 = missing or wrong, 1 = partly done, 2 = done well. A plan counts as doing a line when it commits to it concretely.',
    ...c.rubric.map((line, i) => `${i + 1}. ${line}`),
    '',
    'Answer with JSON only: {"scores": [n, ...one per rubric line], "note": "one line on the biggest miss"}',
  ].join('\n')
  const args = ['-p', '--model', 'sonnet', '--restricted', '--tools', '', '--strict-mcp-config', '--output-format', 'json']
  for (let attempt = 0; attempt < 2; attempt++) {
    const cwd = mkdtempSync(join(tmpdir(), 'slates-brain-judge-'))
    try {
      const { code, stdout, error } = await runClaude(args, { prompt, cwd, timeoutMs: 5 * 60_000 })
      if (code !== 0) throw new Error(error ?? `judge exited ${code}`)
      const v = JSON.parse(String(JSON.parse(stdout).result ?? '').match(/\{[\s\S]*\}/)?.[0] ?? 'null')
      const scores = (v?.scores ?? []).map(Number)
      if (scores.length !== c.rubric.length || scores.some((n) => !(n >= 0 && n <= 2))) throw new Error('bad scores')
      return { scores, note: String(v.note ?? '') }
    } catch (e) {
      if (attempt) return { error: String(e?.message ?? e) }
    } finally {
      try { rmSync(cwd, { recursive: true, force: true, maxRetries: 3 }) } catch {}
    }
  }
}

const rows = []
for (const c of cases) {
  for (const t of traces.filter((x) => x.case === c.id).sort((a, b) => a.arm.localeCompare(b.arm) || a.run - b.run)) {
    const s = scoreTrace(t, c, arms.arms[t.arm])
    const brain = brainOf(t)
    // The router is slates-start-here, which a build from before the brain does not have.
    const musts = [{ must: 'router reached', pass: t.arm === 'baseline' ? null : brain.topics.some((x) => x.startsWith('slates-start-here')) }, ...s.musts]
    const verdict = judge && s.ok && t.reply ? await askJudge(c, t.reply) : null
    const craft = verdict?.scores ? verdict.scores.reduce((a, b) => a + b, 0) / verdict.scores.length : null
    const readFirst = readBeforeBuild(t, c, arms.arms[t.arm])
    rows.push({ case: c.id, arm: t.arm, run: t.run, ok: s.ok, musts, readFirst, forbidden: s.forbidden, guides: brain.topics, brainTokens: brain.tokens, tokens: s.tokens, craft, judge: verdict })
    console.log(`${c.id} ${t.arm} #${t.run}: playbook ${s.musts[0]?.pass ? 'yes' : 'no'}, ${s.forbidden.length} forbidden, brain ${brain.tokens} tokens${craft == null ? '' : `, craft ${craft.toFixed(2)}/2`}`)
  }
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
function summarize(arm, armRows) {
  const ok = armRows.filter((r) => r.ok)
  const router = ok.map((r) => r.musts[0].pass).filter((x) => x != null)
  return {
    model: arms.model,
    // The brain this arm ran on (run.mjs, brain-hash.mjs); gate.mjs refuses a summary from any other.
    brainHash: arms.arms[arm]?.brainHash ?? null,
    runs: armRows.length,
    finished: ok.length,
    // Counted apart from finished, so a run the judge failed on cannot leave the mean resting on the rest.
    judged: ok.filter((r) => r.craft != null).length,
    routerOpened: router.length ? mean(router.map(Number)) : null,
    playbookLoaded: mean(ok.map((r) => Number(r.musts[1]?.pass ?? false))),
    readFirst: mean(ok.map((r) => Number(r.readFirst))),
    forbiddenRuns: armRows.filter((r) => r.forbidden.length).length,
    craft: mean(ok.map((r) => r.craft).filter((x) => x != null)),
    brainTokens: { mean: Math.round(mean(ok.map((r) => r.brainTokens)) ?? 0), max: Math.max(0, ...ok.map((r) => r.brainTokens)) },
  }
}
const armNames = [...new Set(rows.map((r) => r.arm))].sort()
const byArm = Object.fromEntries(armNames.map((a) => [a, summarize(a, rows.filter((r) => r.arm === a))]))
const summary = byArm.candidate ?? byArm[armNames[0]]
writeFileSync(join(out, 'craft.json'), scrubHome(JSON.stringify({ summary, arms: byArm, rows }, null, 2)))

const pct = (x) => (x == null ? 'n/a' : `${Math.round(x * 100)}%`)
const caseCraft = (id, a) => mean(rows.filter((r) => r.case === id && r.arm === a && r.craft != null).map((r) => r.craft))
const md = [
  `# Brain craft eval, ${arms.model}`,
  '',
  '| Arm | Runs finished | Router reached | Playbook loaded | Read before building | Runs with a forbidden action | Craft (of 2) | Brain tokens a job (largest) |',
  '|---|---|---|---|---|---|---|---|',
  ...armNames.map((a) => {
    const x = byArm[a]
    return `| ${a} | ${x.finished} of ${x.runs} | ${pct(x.routerOpened)} | ${pct(x.playbookLoaded)} | ${pct(x.readFirst)} | ${x.forbiddenRuns} | ${x.craft?.toFixed(2) ?? 'n/a'} | ${x.brainTokens.mean} (${x.brainTokens.max}) |`
  }),
  '',
  ...(armNames.length > 1
    ? [
        `| Case | ${armNames.map((a) => `Craft, ${a}`).join(' | ')} |`,
        `|---|${armNames.map(() => '---|').join('')}`,
        ...cases.map((c) => `| ${c.id} | ${armNames.map((a) => caseCraft(c.id, a)?.toFixed(2) ?? 'n/a').join(' | ')} |`),
        '',
      ]
    : []),
  '| Case | Arm | Run | Router | Playbook | Forbidden | Guides served | Brain tokens | Craft | Biggest miss |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.case} | ${r.arm} | ${r.run} | ${r.musts[0].pass == null ? 'n/a' : r.musts[0].pass ? 'yes' : 'no'} | ${r.musts[1]?.pass ? 'yes' : 'no'} | ${r.forbidden.join('; ') || 'none'} | ${r.guides.join(', ') || 'none'} | ${r.brainTokens} | ${r.craft?.toFixed(2) ?? (r.ok ? 'n/a' : 'run failed')} | ${(r.judge?.note ?? r.judge?.error ?? '').replace(/\|/g, '/')} |`),
].join('\n')
writeFileSync(join(out, 'craft.md'), scrubHome(md) + '\n')
console.log(md.split('\n').slice(0, 4 + armNames.length).join('\n'))
