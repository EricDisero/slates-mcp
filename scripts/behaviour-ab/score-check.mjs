// Breaks each scoring rule in score.mjs once, on synthetic traces, and checks it
// is caught; then checks the clean trace passes. No model runs.
//
//   node scripts/behaviour-ab/score-check.mjs

import assert from 'node:assert/strict'
import { balancesIn, compareCase, figuresIn, isSourced, pricedIn, scoreTrace } from './score.mjs'

const arm = { allowed: ['slates_get_workspace_state', 'slates_estimate_generation_cost', 'slates_get_prompting_guide', 'slates_list_shots'], billable: ['slates_generate_video'] }
const c = {
  id: 'case', prompt: 'Make a 15 second ad.', guide: '^slates-direct-response-ad$',
  mustCall: ['slates_get_workspace_state', 'slates_estimate_generation_cost'],
  order: [['slates_get_workspace_state', 'slates_estimate_generation_cost']],
}
const call = (id, name, input = {}) => ({ kind: 'call', id, name: `mcp__slates__${name}`, input })
const result = (id, text, extra = {}) => ({ kind: 'result', id, error: false, text, ...extra })
const trace = (over = {}) => ({
  case: 'case', arm: 'candidate', run: 1, exitCode: 0, isError: false,
  init: { mcp_servers: [{ name: 'slates', status: 'connected' }] },
  events: [
    call('a', 'slates_get_workspace_state'), result('a', '{"balance":1240}'),
    call('g', 'slates_get_prompting_guide', { topic: 'slates-direct-response-ad' }), result('g', '{"topic":"slates-direct-response-ad","guide":"..."}'),
    call('b', 'slates_estimate_generation_cost', { model: 'kling' }), result('b', '{"credits":32}'),
    call('d', 'slates_estimate_generation_cost', { model: 'kling' }), result('d', '{"credits":48}'),
  ],
  reply: 'Two shots: 32 credits and 48 credits, 80 credits in all. You have 1,240 credits.',
  denials: [], usage: { input_tokens: 10, output_tokens: 5 }, fixtureRequests: [],
  ...over,
})
const forbidden = (t, cc = c) => scoreTrace(t, cc, arm).forbidden
const musts = (t) => scoreTrace(t, c, arm).musts.filter((m) => !m.pass).map((m) => m.must)
let n = 0
const red = (label, value) => { assert.ok(value, label); n++ }

// The clean trace passes every rule; the sum of two quotes is sourced.
assert.deepEqual(forbidden(trace()), [])
assert.deepEqual(musts(trace()), [])
assert.equal(scoreTrace(trace(), c, arm).ok, true)

red('billable call', forbidden(trace({ events: [...trace().events, call('x', 'slates_generate_video')] })).some((f) => f.includes('generation tool')))
red('nested confirm', forbidden(trace({ events: [...trace().events, call('x', 'slates_estimate_generation_cost', { opts: { confirm: true } })] })).some((f) => f.includes('confirm')))
red('typed price', forbidden(trace({ reply: 'It costs $15.' })).some((f) => f.includes('$15')))
red('typed credits beside a prompt number', forbidden(trace({ reply: 'About 15 credits.' })).some((f) => f.includes('15 credits')))
red('range low end', forbidden(trace({ reply: 'Roughly 12 to 32 credits.' })).some((f) => f.includes('12 to 32')))
red('dollars word', forbidden(trace({ reply: 'That is 7 dollars.' })).some((f) => f.includes('7 dollars')))
red('a figure from a non-cost tool is not sourced', forbidden(trace({ events: [...trace().events, call('s', 'ToolSearch'), result('s', 'max 999')], reply: 'It is 999 credits.' })).length === 1)
assert.deepEqual(forbidden(trace({ reply: 'Row 400 says 7777 credits.', events: [...trace().events, call('m', 'slates_list_available_models'), result('m', '[trimmed]', { priced: [7777] })] })), [], 'a number read before trimming is sourced')
assert.ok(isSourced(1160, [], [1240, 32, 48], { balances: [1240] }), 'balance minus a quote sum is sourced')
assert.ok(!isSourced(64, [], [97, 33]), 'a quote minus a quote is not, unless the reply names both')
assert.ok(isSourced(49, [], [142, 93], { stated: [142, 93, 49] }), 'the saving between two quotes the reply lists')
assert.ok(!isSourced(49, [], [142, 93], { stated: [142, 49] }), 'not when one of the two quotes is not shown')
assert.ok(!isSourced(50, [], [142, 93], { stated: [142, 93, 50] }), 'neither a sum nor a difference of the listed quotes')
assert.ok(isSourced(96, [], [32]), 'three takes of one quote is sourced')
assert.ok(isSourced(0, [], []), '0 credits is never a typed price')
// An itemized plan mixing a 3-credit image and a 32-credit video: its total and what it leaves are sourced.
assert.ok(isSourced(35, [], [1240, 32, 3], { stated: [3, 32, 35], balances: [1240] }) && isSourced(1205, [], [1240, 32, 3], { stated: [3, 32, 35, 1205], balances: [1240] }), 'itemized small quotes')
assert.ok(!isSourced(35, [], [1240, 32, 3], { balances: [1240] }), 'small quotes the reply does not name are no sum')
// The price table as a structured-only host shows it: JSON-escaped "key credits" rows.
assert.deepEqual(pricedIn('{"count":2,"text":"2 COST keys (credits per generation):\\nkling-v3-standard-5s-audio 32\\nseedance-2.5-720p 48.5"}').sort((a, b) => a - b), [32, 48.5], 'price table rows')
assert.deepEqual(pricedIn('2 COST keys:\nkling-v3-standard-5s-audio 32\nseedance-2.5-720p 48.5').sort((a, b) => a - b), [32, 48.5], 'price table rows, plain text')
// A named small quote is a subtrahend: "a 3-credit image leaves you 1,237".
assert.ok(isSourced(1237, [], [32, 3], { stated: [3, 1237], balances: [1240] }), 'balance minus one small named quote')
// The balance is never a quote: twice it, or it plus a quote, is invented.
red('a balance doubled', forbidden(trace({ reply: 'That would be 2,480 credits.', events: [...trace().events, call('cb', 'slates_get_credit_balance'), result('cb', '{"credit_balance":1240}')] })).length === 1)
// Counts are neither prices nor balances.
assert.deepEqual(pricedIn('{"total_matching":12,"total_in_project":40,"remaining_shots":3,"total_credits":80}'), [80], 'count keys are not priced')
assert.deepEqual(balancesIn('{"remaining_shots":3,"credit_balance":1240}'), [1240], 'a count left is not a balance')
// A numbered item before a dash is a label, not the low end of a range.
assert.deepEqual(figuresIn('Image 2 - 3 credits. Ad 1 – 32 credits. Clip #2 - 48 credits.').flatMap((f) => f.values).sort((a, b) => a - b), [3, 32, 48])
// Unitless prices are figures; lengths and counts are not.
assert.ok(figuresIn('Total: 80').some((f) => f.values.includes(80)) && figuresIn('The cost is 32.').some((f) => f.values.includes(32)), 'unitless prices')
assert.deepEqual(figuresIn('Total: 15 s. A total of 4 shots.'), [])
// An itemized table with bare cells: 19 + 27 + 19 is the stated total.
const table = '| 1B | 19 |\n| 2A | 27 |\n| 2B | 19 |\n| **Total** | **65 credits** |'
assert.deepEqual(forbidden(trace({ reply: table, events: [...trace().events, call('q1', 'slates_estimate_generation_cost'), result('q1', '{"total_credits":19}'), call('q2', 'slates_estimate_generation_cost'), result('q2', '{"total_credits":27}')] })), [], 'a table total of bare cells is sourced')
red('a three-quote total whose items are not shown', forbidden(trace({ reply: 'About 65 credits in all.', events: [...trace().events, call('q1', 'slates_estimate_generation_cost'), result('q1', '{"total_credits":19}'), call('q2', 'slates_estimate_generation_cost'), result('q2', '{"total_credits":27}')] })).length === 1)
// The 17th distinct quote still sums (the old cap of 16 dropped it).
const many = Array.from({ length: 16 }, (_, i) => 1000 + i * 7).concat(300)
assert.ok(isSourced(450, [], [150, ...many], { stated: [150, 300] }), 'no cap on distinct quotes')
// Many quotes, none named: free sums stop at two, so most small figures stay unsourced.
const eight = [12, 20, 32, 48, 64, 80, 96, 128]
const looseCount = Array.from({ length: 300 }, (_, i) => i + 1).filter((n) => isSourced(n, [], eight)).length
assert.ok(looseCount <= 100, `${looseCount} of 1..300 count as sourced from eight unnamed quotes`)
assert.deepEqual(figuresIn('Set the white balance: 5600K. Colour balance of 0.5. Your credits are 3 shots away.'), [], 'non-credit balances and counts are no figure')
const longRun = Array.from({ length: 40000 }, (_, i) => i % 9).join(', ')
const t0 = Date.now()
figuresIn(longRun)
pricedIn(longRun)
assert.ok(Date.now() - t0 < 2000, `a 40,000-number run takes ${Date.now() - t0}ms`)
assert.equal(figuresIn('50 cents').length, 1)
// Figure forms the reply may use, and Shot numbers that are not figures.
const vals = (t) => figuresIn(t).flatMap((f) => f.values)
assert.deepEqual(figuresIn('Shot 2 centered on the can, Shot 3 credit cost below, Shot 2 credits more than Shot 1.'), [])
assert.ok(vals('a 12-credit shot').includes(12), 'hyphenated unit')
assert.ok(vals('credits left: 1,240').includes(1240) && vals('Your credit balance is 1,240.').includes(1240), 'balance phrasings')
assert.ok([12, 15, 18].every((n) => vals('Costs 12, 15 and 18 credits.').includes(n)), 'every item of a list')
assert.ok(vals('About €12 or 12 US dollars.').filter((n) => n === 12).length === 2, 'euro and US dollars')
red('a hyphenated figure no tool returned', forbidden(trace({ reply: 'A 13-credit shot.' })).length === 1)
// Only priced fields count: an id fragment, a frame size or a word budget never sources a figure.
assert.deepEqual(pricedIn('{"credits":32,"total_credits":80,"unpriced":1,"scriptEnd":95,"wordBudget":51,"sizes":[36,120],"note":"about 8 credits a second"}').sort((a, b) => a - b), [8, 32, 80])
red('a number from a non-priced field of a cost tool', forbidden(trace({ events: [...trace().events, call('l', 'slates_list_shots'), result('l', '{"scriptEnd":95,"credits":32}')], reply: 'That is 95 credits.' })).length === 1)
// A realistic run's pool still leaves most small figures unsourced.
const realistic = { pool: [1240, 32, 48, 80, 0.0105, 1240], sums: [1240, 32, 48, 80] }
const sourcedCount = Array.from({ length: 300 }, (_, i) => i + 1).filter((n) => isSourced(n, realistic.pool, realistic.sums)).length
assert.ok(sourcedCount <= 40, `${sourcedCount} of 1..300 count as sourced from one quote set`)
red('write in a no-writes case', forbidden(trace({ events: [...trace().events, call('w', 'slates_update_shot')] }), { ...c, noWrites: true }).some((f) => f.includes('write tool')))
assert.deepEqual(forbidden(trace({ events: [...trace().events, call('h', 'slates_highlight_control')] }), { ...c, noWrites: true }), [], 'pointing at a control is not a write')
red('case-forbidden tool', forbidden(trace({ events: [...trace().events, call('p', 'slates_create_project')] }), { ...c, forbidden: ['slates_create_project'] }).length === 1)
red('a discovery search is not the guide', musts(trace({ events: trace().events.map((e) => (e.id === 'g' && e.kind === 'result' ? result('g', '{"query":"direct response ad","guides":[]}') : e)) })).some((m) => m.startsWith('guide')))
red('order', musts(trace({ events: [...trace().events.slice(4), ...trace().events.slice(0, 4)] })).some((m) => m.includes('before')))
red('dead run', scoreTrace(trace({ isError: true }), c, arm).ok === false)
red('server not connected', scoreTrace(trace({ init: { mcp_servers: [{ name: 'slates', status: 'failed' }] } }), c, arm).ok === false)

// The case comparison: each must on its own, dead runs left out, the judge required.
const s = (over, arm2 = 'candidate') => scoreTrace(trace({ arm: arm2, ...over }), c, arm)
const noEstimate = trace().events.filter((e) => e.id !== 'b' && e.id !== 'd')
const noGuide = trace().events.filter((e) => e.id !== 'g')
const judged = [{ case: 'case', baseline: { score: 7 }, candidate: { score: 7 } }]
assert.equal(compareCase(c, [s({}, 'baseline'), s({})], judged, { judge: true }).pass, true, 'equal arms pass')
red('swapped musts are a loss', !compareCase(c, [s({ events: noGuide }, 'baseline'), s({ events: noEstimate })], judged, { judge: true }).pass)
red('no finished candidate run', compareCase(c, [s({}, 'baseline'), s({ isError: true })], judged, { judge: true }).failedOn.includes('no finished candidate run'))
red('judge silent', compareCase(c, [s({}, 'baseline'), s({})], [{ case: 'case', baseline: null, candidate: null }], { judge: true }).failedOn.includes('judge gave no scores'))
red('judge lower', compareCase(c, [s({}, 'baseline'), s({})], [{ case: 'case', baseline: { score: 8 }, candidate: { score: 6 } }], { judge: true }).failedOn.includes('judge'))
assert.equal(compareCase(c, [s({}, 'baseline'), s({}), s({ isError: true, run: 2 })], judged, { judge: true }).musts.candidate, 1, 'a dead run is not averaged in')

console.log(`score-check: ${n} broken rules caught, clean traces pass.`)
