// Breaks the craft gate's case count and mean floor on synthetic results and checks each is caught, then checks a
// passing batch passes. No model runs, no build read.
//
//   node scripts/brain-eval/gate-check.mjs

import assert from 'node:assert/strict'
import { compare, signTestP } from './gate.mjs'

const board = { approvedBrainHash: 'base' }
const current = { brainHash: 'cand', unbuilt: [] }
const arm = (brainHash, craft) => ({ model: 'm', brainHash, runs: 50, finished: 50, judged: 50, routerOpened: 1, playbookLoaded: 0.9, readFirst: 0.9, forbiddenRuns: 0, craft })
/** A craft result whose cases the candidate loses, wins and ties as asked, with each arm's mean as given. */
function craft({ losses, wins, ties = 0, candidateMean = 1.5, baselineMean = 1.5 }) {
  const rows = []
  const add = (id, cand, base) => rows.push({ case: id, arm: 'candidate', run: 1, craft: cand }, { case: id, arm: 'baseline', run: 1, craft: base })
  for (let i = 0; i < losses; i++) add(`loss-${i}`, 1, 1.5)
  for (let i = 0; i < wins; i++) add(`win-${i}`, 1.5, 1)
  for (let i = 0; i < ties; i++) add(`tie-${i}`, 1.5, 1.5)
  return { routing: [], craft: [{ file: 'craft.json', data: { summary: arm('cand', candidateMean), arms: { candidate: arm('cand', candidateMean), baseline: arm('base', baselineMean) }, rows } }] }
}
const fails = (spec) => compare(board, craft(spec), current).fail
let n = 0
const red = (label, value) => { assert.ok(value, label); n++ }

assert.equal(signTestP(0, 0), 1, 'no decided case is no evidence')
assert.ok(Math.abs(signTestP(10, 7) - 41226 / 131072) < 1e-12, 'the exact tail of 10 losses in 17')
assert.deepEqual(fails({ losses: 10, wins: 7, ties: 8 }), [], '10 losses and 7 wins pass')
assert.deepEqual(fails({ losses: 8, wins: 4, ties: 13 }), [], '8 losses and 4 wins pass')
red('12 losses and 4 wins reject', fails({ losses: 12, wins: 4, ties: 9 }).some((f) => f.includes('loses 12 cases and wins 4')))
red('a mean drop past 0.1 rejects at a winning count', fails({ losses: 2, wins: 10, ties: 13, candidateMean: 1.35, baselineMean: 1.5 }).some((f) => f.includes('more than 0.1 lower')))
red('a mean drop past 0.1 rejects at an even count', fails({ losses: 5, wins: 5, ties: 15, candidateMean: 1.39, baselineMean: 1.5 }).some((f) => f.includes('more than 0.1 lower')))
assert.deepEqual(fails({ losses: 5, wins: 5, ties: 15, candidateMean: 1.41, baselineMean: 1.5 }), [], 'a drop inside 0.1 passes')

console.log(`gate-check: ${n} broken batches caught, passing batches pass.`)
