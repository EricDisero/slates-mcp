#!/usr/bin/env node
// Tests gate every change to the brain (second-brain plans/2026-10-25-slates-brain.md § Keeping it
// from turning into chaos, rule 6; Eric, 2026-10-25: evals reject any change that lowers the score).
// A candidate is compared with the brain Eric last approved IN THE SAME BATCH, never with a score on
// file: both arms run on the same day, the same model, the same price list and the same judge, so the
// difference is the brain and not the weather.
//
//   node scripts/brain-eval/gate.mjs --routing results/<date>-routing-sonnet.json [--routing …] [--craft results/<date>-craft/craft.json]
//
// Each result file holds two arms: `candidate`, the working tree's build, and `baseline`, a build of the
// approved commit (scoreboard.json approvedCommit). An arm only counts for the brain it claims: the
// candidate's brainHash (brain-hash.mjs) must be the working tree build's, the baseline's must be
// scoreboard.json approvedBrainHash. It rejects
//
//   craft    the candidate loses more cases than it wins (a sign test on each case's judged mean, candidate
//            against baseline), a craft mean more than CRAFT_NOISE below the baseline's, any candidate run with a forbidden action, any unfinished or unjudged run in
//            either arm, a case one arm lacks, or a rate falling by more than one run: the router or the case's
//            playbook read before the first build call (readFirst, craft.mjs) or the playbook loaded at all;
//   routing  candidate accuracy below the baseline's by more than one ask, any ask that errored, none answered.
//
// compare() is exported for brain-review.mjs --approve; the CLI below is a thin wrapper. Nothing here writes:
// the approved brain moves only through brain-review.mjs --approve, after Eric's decisions.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { brainHash, unbuiltSkills } from './brain-hash.mjs'

const here = import.meta.dirname
export const ROOT = join(here, '..', '..')
export const BOARD = join(here, 'scoreboard.json')
const EPS = 1e-9
// How far the craft mean (of 2) may fall before it counts: the old gate's tolerance, chosen, not measured. Running
// one brain twice in one batch would measure the judge's real spread and replace it.
const CRAFT_NOISE = 0.1

export const readBoard = (file = BOARD) => JSON.parse(readFileSync(file, 'utf8'))

/** Results files read for compare(): `{ routing: [{ file, data }], craft: [{ file, data }] }`. */
export function readResults({ routing = [], craft = [] }) {
  const read = (file) => ({ file: file.replace(/\\/g, '/'), data: JSON.parse(readFileSync(resolve(file), 'utf8')) })
  return { routing: routing.map(read), craft: craft.map(read) }
}

/** The working tree's brain: its hash and the skills its build is older than. */
export async function currentBrain(root = ROOT) {
  return { brainHash: await brainHash(root), unbuilt: await unbuiltSkills(root) }
}

const pct = (x) => (x == null ? 'n/a' : `${Math.round(x * 100)}%`)
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const routingScore = (arm) => {
  const answered = (arm.results ?? []).filter((x) => !x.error)
  const hits = answered.filter((x) => x.hit).length
  return { answered, hits, errors: (arm.results ?? []).length - answered.length, accuracy: answered.length ? hits / answered.length : null }
}

/** Per case, the candidate's judged mean against the baseline's: a win, a loss or a tie. */
export function signTest(rows) {
  const ids = [...new Set(rows.map((r) => r.case))].sort()
  const perCase = ids.map((id) => {
    const of = (arm) => mean(rows.filter((r) => r.case === id && r.arm === arm && r.craft != null).map((r) => r.craft))
    const candidate = of('candidate'), baseline = of('baseline')
    const outcome = candidate == null || baseline == null ? 'unscored' : candidate > baseline + EPS ? 'win' : candidate < baseline - EPS ? 'loss' : 'tie'
    return { case: id, candidate, baseline, outcome }
  })
  const count = (o) => perCase.filter((c) => c.outcome === o).length
  return { perCase, wins: count('win'), losses: count('loss'), ties: count('tie'), unscored: perCase.filter((c) => c.outcome === 'unscored') }
}

/**
 * Every result's candidate against its baseline. `board` gives approvedBrainHash; `current` is currentBrain().
 * Returns the report lines and the reasons it fails (none is a pass).
 */
export function compare(board, results, current) {
  const fail = []
  const lines = []
  if (!results.routing.length && !results.craft.length) fail.push('nothing to gate: pass --routing and/or --craft results')
  if (current.unbuilt?.length) fail.push(`the build is older than the skills on disk (${current.unbuilt.join(', ')}); npm run build and re-run the evals`)
  if (!board.approvedBrainHash) fail.push('scoreboard.json has no approvedBrainHash, so no baseline can be checked: pin it from a clean build of the approved commit (node scripts/brain-review.mjs --pin-approved-hash <checkout>)')
  // A score proves nothing about a brain it did not test.
  const tested = (what, file, hash, want, whose) => {
    if (!hash) fail.push(`${what}: ${file} records no brainHash; re-run it on ${whose}`)
    else if (want && hash !== want) fail.push(`${what}: ${file} tested brain ${hash}, ${whose} is ${want}; re-run it on ${whose}`)
  }
  const twoArms = (what, file, arms) => {
    if (arms?.candidate && arms?.baseline) return true
    fail.push(`${what}: ${file} lacks a ${arms?.candidate ? 'baseline' : 'candidate'} arm; the gate compares the candidate with the approved brain in the same batch (README § The gate)`)
    return false
  }

  for (const { file, data: r } of results.routing) {
    const what = `routing on ${r.model}`
    if (!twoArms(what, file, r.arms)) continue
    const cand = r.arms.candidate, base = r.arms.baseline
    tested(`${what}, candidate`, file, cand.brainHash, current.brainHash, "the working tree's build")
    tested(`${what}, baseline`, file, base.brainHash, board.approvedBrainHash, 'the approved brain')
    const c = routingScore(cand), b = routingScore(base)
    if (c.errors || b.errors) fail.push(`${what}: ${c.errors} candidate and ${b.errors} baseline asks errored; re-run before gating`)
    if (!c.answered.length) {
      fail.push(`${what}: no candidate ask was answered`)
      continue
    }
    // An approved brain from before the router has no router to hand an agent, so it routes nothing.
    const baseAccuracy = base.noRouter ? 0 : b.accuracy
    if (!base.noRouter && !b.answered.length) {
      fail.push(`${what}: no baseline ask was answered`)
      continue
    }
    lines.push(`routing ${r.model}: candidate ${c.hits}/${c.answered.length}, baseline ${base.noRouter ? 'none (the approved brain has no router)' : `${b.hits}/${b.answered.length}`}`)
    if (c.accuracy < baseAccuracy - 1 / c.answered.length - EPS) fail.push(`${what}: the candidate routed ${pct(c.accuracy)} against the approved brain's ${pct(baseAccuracy)}, more than one ask below; misses: ${c.answered.filter((x) => !x.hit).map((x) => x.case).join(', ')}`)
  }

  for (const { file, data } of results.craft) {
    const model = data.summary?.model ?? data.arms?.candidate?.model ?? '?'
    const what = `craft on ${model}`
    if (!twoArms(what, file, data.arms)) continue
    const cand = data.arms.candidate, base = data.arms.baseline
    tested(`${what}, candidate`, file, cand.brainHash, current.brainHash, "the working tree's build")
    tested(`${what}, baseline`, file, base.brainHash, board.approvedBrainHash, 'the approved brain')
    for (const [name, s] of [['candidate', cand], ['baseline', base]]) {
      if (s.finished < s.runs) fail.push(`${what}: ${s.runs - s.finished} ${name} runs did not finish; re-run them before gating`)
      // A run the judge did not score would leave the comparison resting on the runs it did.
      if (!(s.judged >= s.finished)) fail.push(`${what}: the judge scored ${s.judged ?? 'an unknown number'} of ${s.finished} finished ${name} runs; re-run craft.mjs without --no-judge`)
      if (s.readFirst === undefined) fail.push(`${what}: ${file} has no readFirst rate for the ${name}; re-score it with this craft.mjs`)
    }
    if (cand.forbiddenRuns > 0) fail.push(`${what}: ${cand.forbiddenRuns} candidate runs took a forbidden action`)
    const rows = data.rows ?? []
    const casesOf = (arm) => new Set(rows.filter((x) => x.arm === arm).map((x) => x.case))
    const cc = casesOf('candidate'), bc = casesOf('baseline')
    const lopsided = [...new Set([...cc, ...bc])].filter((id) => !cc.has(id) || !bc.has(id))
    if (lopsided.length) fail.push(`${what}: ${lopsided.length} cases ran in one arm only (${lopsided.join(', ')}); run both arms on every case`)
    const sign = signTest(rows.filter((x) => !lopsided.includes(x.case)))
    if (sign.unscored.length) fail.push(`${what}: no judged run in an arm for ${sign.unscored.map((c) => c.case).join(', ')}`)
    lines.push(`craft ${model}: the candidate wins ${sign.wins} cases, loses ${sign.losses}, ties ${sign.ties} against the approved brain; craft ${cand.craft?.toFixed(2) ?? 'n/a'} against ${base.craft?.toFixed(2) ?? 'n/a'} of 2, read before building ${pct(cand.readFirst)} against ${pct(base.readFirst)}, playbook ${pct(cand.playbookLoaded)} against ${pct(base.playbookLoaded)}, forbidden ${cand.forbiddenRuns} against ${base.forbiddenRuns}`)
    if (sign.losses > sign.wins) fail.push(`${what}: the candidate loses ${sign.losses} cases and wins ${sign.wins}; losses: ${sign.perCase.filter((c) => c.outcome === 'loss').map((c) => `${c.case} ${c.candidate.toFixed(2)} < ${c.baseline.toFixed(2)}`).join(', ')}`)
    // Many small wins can hide a few big losses, so the mean may not fall past the judge's noise either.
    if (cand.craft != null && base.craft != null && cand.craft < base.craft - CRAFT_NOISE - EPS) fail.push(`${what}: craft ${cand.craft.toFixed(2)} against the approved brain's ${base.craft.toFixed(2)}, more than ${CRAFT_NOISE} lower`)
    // One run either way is noise on a rate; a fall past it is not.
    const slack = cand.finished ? 1 / cand.finished : 0
    for (const [key, label] of [['readFirst', 'the router or playbook was read before the first build'], ['playbookLoaded', 'the right playbook loaded']]) {
      if (cand[key] == null || base[key] == null) continue
      if (!(cand[key] >= base[key] - slack - EPS)) fail.push(`${what}: ${label} in ${pct(cand[key])} of candidate runs against ${pct(base[key])} for the approved brain, more than one run lower`)
    }
  }
  return { lines, fail }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  const all = (flag) => process.argv.flatMap((a, i) => (a === `--${flag}` ? [process.argv[i + 1]] : [])).filter(Boolean)
  const files = { routing: all('routing'), craft: all('craft') }
  if (!files.routing.length && !files.craft.length) {
    console.error('usage: gate.mjs --routing <routing.json> [--routing …] [--craft <craft.json>]')
    process.exit(1)
  }
  const board = readBoard()
  const results = readResults(files)
  const current = await currentBrain()
  const { lines, fail } = compare(board, results, current)
  console.log(lines.join('\n'))
  if (fail.length) {
    console.error(`✗ brain gate: rejected\n  ${fail.join('\n  ')}`)
    process.exit(1)
  }
  console.log(`✓ brain gate: brain ${current.brainHash} holds against the approved brain ${board.approvedBrainHash}`)
}
