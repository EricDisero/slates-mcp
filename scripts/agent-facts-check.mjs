// Facts the agent needs at the moment it decides, carried on the op RESULT so a
// model cannot skip them. Each assertion is a call that failed in the 2026-10-07
// GLM-5.3-Flash eval run (slate/scripts/agent-eval/evidence/2026-10-07/), driven
// offline against fake transports: nothing reaches a desktop, the API or a provider.
import assert from 'node:assert/strict'
import { ALL_OPERATIONS, bannedTokensForSkill, findBannedTokens, refusableBannedTokens } from '../packages/shared/dist/index.js'

const op = (id) => ALL_OPERATIONS.find((o) => o.id === `slates_${id}`)
const call = (id, input, ctx) => op(id).run(op(id).input.parse(input), ctx)

// The eval's registry prices for the image roster (credits per image).
const prices = new Map([
  ['seedream-5-lite', 2], ['nano-banana-2-lite', 2],
  ['nano-banana-2-1k', 4], ['nano-banana-2-2k', 6], ['nano-banana-2-4k', 8],
  ['nano-banana-pro-1k', 8], ['nano-banana-pro-2k', 8], ['nano-banana-pro-4k', 15],
  ['flux-2-max', 4], ['flux-2-max-2k', 5], ['flux-2-max-4k', 8],
  ['seedance-2-1080p-8s', 148],
])
for (const seat of ['gpt-image-2-5-flare', 'gpt-image-2-5-sunburst']) {
  for (const [tier, row] of Object.entries({ low: [1, 1, 1], med: [1, 1, 2], high: [2, 3, 5], xhigh: [4, 5, 9], max: [8, 11, 20] })) {
    ;['2k', '3k', '4k'].forEach((res, i) => prices.set(`${seat}-${tier}-${res}`, row[i]))
  }
}
const cloud = { get: async (path) => {
  const key = /[?&]costKey=([^&]+)/.exec(path)
  const rows = key ? [decodeURIComponent(key[1])].filter((k) => prices.has(k)) : [...prices.keys()]
  return { models: rows.map((model) => ({ model, cost_credits: prices.get(model) })) }
} }
const quoteCtx = { cloud: () => cloud, desktop: () => { throw new Error('an estimate must not reach the desktop') } }

// ── 1. The estimate names cheaper image seats (cheap-image.0) ───────
// Asked for "the cheapest and best version", the agent priced Nano Banana 2
// alone (6 credits) and called it the cheapest; 1- and 2-credit seats existed.
const nb2 = await call('estimate_generation_cost', { model: 'nano-banana-2' }, quoteCtx)
// The quoted seat's own cheaper setting first (Nano Banana 2 at 1k), then the cheapest others.
assert.deepEqual(nb2.data.cheaper_options.map((o) => [o.model, o.credits]), [
  ['nano-banana-2', 4], ['gpt-image-2-5-flare', 1], ['gpt-image-2-5-sunburst', 1], ['nano-banana-2-lite', 2],
])
// Ties go to the seat's default resolution, then the higher tier: medium costs what low does.
assert.deepEqual(nb2.data.cheaper_options[2], { model: 'gpt-image-2-5-sunburst', credits: 1, resolution: '3k', quality: 'medium' })
assert.equal(nb2.text.split('\n')[1], 'Cheaper per image on the price list at 16:9 (4 of 6): nano-banana-2 4 credits (1k); gpt-image-2-5-flare 1 credits (quality medium); gpt-image-2-5-sunburst 1 credits (quality medium); nano-banana-2-lite 2 credits.')
// It survives the desktop's repeated-card strip (loop.ts cuts at the card header).
assert.match(nb2.text.split('\n\n--- HOW TO PROMPT')[0], /Cheaper per image/)
// Priced at the asked framing: GPT Image prices a square frame higher, and a key the list
// lacks is named as unpriced, never quoted at the 16:9 rate.
const square = await call('estimate_generation_cost', { model: 'nano-banana-2', aspectRatio: '1:1' }, quoteCtx)
assert.deepEqual(square.data.cheaper_options.map((o) => o.model), ['nano-banana-2', 'nano-banana-2-lite', 'seedream-5-lite', 'flux-2-max'])
assert.match(square.text.split('\n')[1], /^Cheaper per image on the price list at 1:1: .*\. Not on the price list at 1:1: gpt-image-2-5-flare, gpt-image-2-5-sunburst; estimate one directly to price it\.$/)
// Nothing cheaper, nothing said; and video estimates never carry the line.
const cheapest = await call('estimate_generation_cost', { model: 'gpt-image-2-5-flare', quality: 'low' }, quoteCtx)
assert.equal(cheapest.data.cheaper_options, undefined)
assert.doesNotMatch(cheapest.text, /Cheaper per image|Not on the price list/)
const video = await call('estimate_generation_cost', { model: 'seedance-2', duration: 8, videoResolution: '1080p' }, quoteCtx)
assert.doesNotMatch(video.text, /Cheaper per image/)
console.log(`agent-facts: an image estimate lists ${nb2.data.cheaper_options.length} of the 6 cheaper settings under Nano Banana 2's 6 credits, its own 1k first, priced at the asked framing; none under the cheapest, none on video`)

// ── 2. The shot list carries its rows (batch-over-budget.0 and .2) ──
// The desktop agent reads only `text`, which was the totals alone: it listed the
// same board six times and guessed `slates_get_shot("SHOT-1")`.
const projectId = '127b2dcb-2684-43a9-9878-2e51c6cd07eb'
const shots = [
  { id: 'ff2a3300-8ebc-4403-b50f-cdba85486e8a', code: 'SHOT-A', place: '1A', name: 'Canyon wide', model: 'seedance-2' },
  { id: 'cbba23f2-5d4d-472c-bbca-a83145b4fc0f', code: 'SHOT-B', place: '1B', name: 'Rim light', model: 'seedance-2' },
  { id: '55565a63-8c57-461d-b2e3-089e766d20b6', code: null, name: 'Pull back', model: null },
]
const desktop = {
  requireCapability: async () => {},
  get: async (route) => route === '/agent/shots'
    ? { shots: shots.map((s) => ({ referenceCount: 0, cuts: 1, runtimeSeconds: 8, sceneName: 'Scene 1', position: 0, continues: false, ...s })), variety: null, varietySummary: '' }
    : { items: shots.map((s) => ({ shotId: s.id, name: s.name, code: s.code, model: s.model, credits: s.model ? 148 : null })) },
}
const listed = await call('list_shots', { projectId }, { desktop: () => desktop, cloud: () => cloud })
assert.match(listed.text, /^3 shot\(s\), at least 296 credits to fire them all \(1 could not be priced/)
assert.match(listed.text, /\n1A SHOT-A · "Canyon wide" · seedance-2 · 148 credits · id ff2a3300-8ebc-4403-b50f-cdba85486e8a\n/)
assert.match(listed.text, /\n— · "Pull back" · no model · unpriced · id 55565a63-8c57-461d-b2e3-089e766d20b6$/)
// A long board: the variety report comes before the rows and the rows stop well inside the
// desktop's 12,000-character result cap, saying how many were left out and how to get them.
const many = Array.from({ length: 150 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, code: `SHOT-${i}`, place: `${i}A`, name: `A long descriptive shot name number ${i}`, model: 'seedance-2' }))
const bigDesktop = {
  requireCapability: async () => {},
  get: async (route) => route === '/agent/shots'
    ? { shots: many.map((s) => ({ referenceCount: 0, cuts: 1, runtimeSeconds: 8, sceneName: 'Scene 1', position: 0, continues: false, ...s })),
        variety: { cuts: 150, generations: 150, runtimeSeconds: 1200, cutsWithoutDuration: 0, shotSizes: [{ bucket: 'wide', count: 90 }], cameraMoves: [], runs: [], overLongLines: [], words: 40, wordBudget: 3180 },
        varietySummary: '' }
    : { items: many.map((s) => ({ shotId: s.id, name: s.name, code: s.code, model: s.model, credits: 148 })) },
}
const big = await call('list_shots', { projectId }, { desktop: () => bigDesktop, cloud: () => cloud })
assert.ok(big.text.length < 10_000, `the listing is ${big.text.length} characters`)
const firstRow = big.text.indexOf('\n0A SHOT-0 ')
for (const part of ['150 generation(s) · 150 cut(s)', 'VARIETY: 90/150 wide', 'WORDS: 40 written']) {
  const at = big.text.indexOf(part)
  assert.ok(at > -1 && at < firstRow, `"${part}" comes before the rows`)
}
assert.match(big.text, /\n…and \d+ more Shot\(s\) not listed here: pass storyboardId or frameId to list part of the board, or read one with slates_get_shot\.$/)
assert.equal(big.data.shots.length, 150, 'data keeps every row')
console.log(`agent-facts: the shot list text carries one row per Shot (place, code, name, model, price, id); a 150-Shot board stays at ${big.text.length} characters and says what it left out`)

// ── 3. A guessed tool name points at the real ones (batch-over-budget) ──
await assert.rejects(call('load_tools', { names: ['slates_generate_shot'] }), /Unknown operation\(s\): slates_generate_shot\. Closest real tools: .*slates_generate_from_shots/)
await assert.rejects(call('load_tools', { names: ['slates_get_shots'] }), /Closest real tools: .*slates_(get_shot|list_shots)/)
console.log('agent-facts: an unknown tool name answers with the closest real tools')

// ── 4. The image review names the framing check (fix-after-review.2 and .6) ──
// Twice the agent had the pixels of a lighthouse cut off at the top and called it on brief.
const imageDesktop = {
  requireCapability: async () => {},
  post: async (route) => { assert.equal(route, '/agent/generation/image'); return { success: true, asset: { id: 'a1', code: 'IMG-A21' } } },
  get: async (route) => { assert.equal(route, '/agent/assets/image'); return { data: 'AAAA', mimeType: 'image/jpeg', bytes: 3 } },
}
const made = await call('generate_image', { prompt: 'A lighthouse at dusk', model: 'nano-banana-2', projectId, aspectRatio: '16:9', confirm: true },
  { desktop: () => imageDesktop, cloud: () => cloud })
assert.equal(made.images.length, 1)
assert.match(made.text, /first the frame edges \(is every subject whole, or is one cut off where the brief did not ask for a crop\?\), then each thing the brief named/)
console.log('agent-facts: an inline image result names the frame-edge check before the brief')

// ── 5. A never-use list holds only what the call can be checked against (review #5) ──
// Every backticked string in a @banned block used to be a token, so FLUX's positive forms and
// Omni Flash's recommended closing line were "banned", and the desktop loop refused them.
const tokens = (skill) => bannedTokensForSkill(skill).map((t) => t.token)
assert.ok(!tokens('slates-prompting-flux-2-max').some((t) => ['sharp focus throughout', 'empty scene', 'soft, diffused lighting'].includes(t)))
assert.ok(tokens('slates-prompting-flux-2-max').includes('no blur'))
assert.ok(!tokens('slates-prompting-omni-flash').some((t) => ['Keep everything else the same.', 'when he snaps his fingers'].includes(t)))
// Seedance 2.5 reclassifies on "edit" only with a reference video: refused then, never without.
const s25 = 'One continuous drone climb, no cuts, no edit.'
assert.deepEqual(refusableBannedTokens(s25, 'video', 'slates-prompting-seedance-2-5').map((t) => t.token), [])
assert.deepEqual(refusableBannedTokens(s25, 'video', 'slates-prompting-seedance-2-5', { referenceVideo: true }).map((t) => t.token), ['edit'])
assert.equal(findBannedTokens(s25, 'video', 'slates-prompting-seedance-2-5').length, 1, 'still a warning')
// Kling's pronoun rule needs to know the speaker was introduced: a warning, never a refusal.
assert.deepEqual(refusableBannedTokens('He walks to the door.', 'video', 'slates-prompting-kling-v3'), [])
assert.equal(findBannedTokens('He walks to the door.', 'video', 'slates-prompting-kling-v3').length, 1)
// The plain ones refuse, and carry the skill's own line for the refusal to quote.
const [cin] = refusableBannedTokens('quiet cinematic mood', 'image', 'slates-prompting-nano-banana-2')
assert.equal(cin.token, 'cinematic')
assert.match(cin.note, /standing alone — always specify \*which cinema\*/)
console.log('agent-facts: never-use lists drop the skills\' positive forms; "edit" refuses only with a reference video; context-only rules stay warnings')
