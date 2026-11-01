#!/usr/bin/env node
// The release batch: every routing ask and every craft brief, both arms, once, on the final brain hash, right before
// brain-review.mjs --approve (Eric, 2026-10-25: a full batch is heavy plan usage, so only before a brain release). It is
// the one way to start a full run (release-guard.mjs): it refuses until the review is answered and the tree is final,
// with brain-review.mjs's own checks, then sets RELEASE_BATCH_ENV for the runs it starts.
//
//   node scripts/brain-eval/release-batch.mjs --spec <spec.json> --decisions <decisions.json> --root <build of the
//     approved commit> --baseline-brain <slates-api brain/ at the approved pin> [--models sonnet,haiku]
//     [--routing-runs 2] [--craft-runs 2]
//
// Refuses unless the decisions cover every waiting commit and every held one is reverted (brain-review.mjs
// reviewAnswered), nothing under packages/shared or the brain files is uncommitted, and the build is current: the
// skills on disk are built and it hands agents the brain the page was built from (buildRefusals). Then runs, in order:
// routing.mjs on each of --models, behaviour-ab/run.mjs on craft-cases.json, and craft.mjs, writing
// results/<date>-routing-<model>.json and results/<date>-craft/. Runs on the signed-in Claude plan (behaviour-ab/lib.mjs).
// Prints the --approve line that takes those files; the gate runs there.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { arg, countArg } from '../behaviour-ab/lib.mjs'
import { buildRefusals, reviewAnswered } from '../brain-review.mjs'
import { RELEASE_BATCH_ENV } from './release-guard.mjs'

const here = import.meta.dirname
const repo = resolve(here, '..', '..')
const need = (name) => arg(name) ?? (() => { throw new Error(`--${name} is required (see the header)`) })()
const specFile = resolve(need('spec'))
const decisionsFile = resolve(need('decisions'))
const baseline = resolve(need('root'))
const baselineBrain = resolve(need('baseline-brain'))
const models = arg('models', 'sonnet,haiku').split(',').map((m) => m.trim()).filter(Boolean)
const routingRuns = countArg('routing-runs', '2')
// Two runs a brief, as every release batch before this script ran (results/2026-10-25-craft-*/arms.json): at one,
// a single judge swing on a case both arms read the same guides for decides its sign.
const craftRuns = countArg('craft-runs', '2')

const { refuse, page, after } = reviewAnswered(JSON.parse(readFileSync(specFile, 'utf8')), JSON.parse(readFileSync(decisionsFile, 'utf8')))
const built = await buildRefusals(page, after)
refuse.push(...built.refuse)
if (built.current.unbuilt?.length) refuse.push(`the build is older than the skills on disk (${built.current.unbuilt.join(', ')}); npm run build first`)
if (refuse.length) {
  console.error(`✗ release batch: not started\n  ${refuse.join('\n  ')}`)
  process.exit(1)
}
console.log(`release batch on brain ${built.current.brainHash}: routing on ${models.join(', ')} (${routingRuns} runs), craft (${craftRuns} runs)`)

const date = new Date().toISOString().slice(0, 10)
const results = join(here, 'results')
const craftOut = join(results, `${date}-craft`)
const env = { ...process.env, [RELEASE_BATCH_ENV]: '1' }
const failed = []
function step(label, script, args) {
  console.log(`\n→ ${label}`)
  const { status } = spawnSync(process.execPath, [join(here, script), ...args], { cwd: repo, env, stdio: 'inherit' })
  if (status !== 0) failed.push(`${label} exited ${status}`)
}

for (const model of models) {
  step(`routing on ${model}`, 'routing.mjs', ['--root', baseline, '--baseline-brain', baselineBrain, '--model', model, '--runs', String(routingRuns)])
}
step('craft briefs, both arms', join('..', 'behaviour-ab', 'run.mjs'), ['--cases-file', join(here, 'craft-cases.json'), '--baseline', baseline, '--baseline-brain', baselineBrain, '--arms', 'baseline,candidate', '--out', craftOut, '--runs', String(craftRuns)])
step('craft scoring and judge', 'craft.mjs', ['--out', craftOut])

const rel = (f) => relative(repo, f).split('\\').join('/')
const routingFiles = models.map((m) => `--routing ${rel(join(results, `${date}-routing-${m}.json`))}`).join(' ')
console.log(`\nnode scripts/brain-review.mjs --approve --spec ${specFile} --decisions ${decisionsFile} --craft ${rel(join(craftOut, 'craft.json'))} ${routingFiles}`)
if (failed.length) {
  console.error(`✗ release batch: ${failed.join('; ')}`)
  process.exit(1)
}
