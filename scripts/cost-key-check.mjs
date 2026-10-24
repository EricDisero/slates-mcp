import assert from 'node:assert/strict'
import { ALL_OPERATIONS } from '../packages/shared/dist/index.js'

// The estimate op is driven offline: the mock registry prices whatever key it
// is asked for, so the check sees exactly which key a request would be quoted on.
const estimate = ALL_OPERATIONS.find(op => op.id === 'slates_estimate_generation_cost')
const ctx = {
  desktop: () => { throw new Error('the estimate must not reach the desktop') },
  cloud: () => ({ get: async path => {
    const key = /[?&]costKey=([^&]+)/.exec(path)
    return { models: key ? [{ model: decodeURIComponent(key[1]), cost_credits: 1 }] : [] }
  } }),
}
const quotedKey = async input => (await estimate.run(estimate.input.parse(input), ctx)).data.cost_key

// The desktop agent route sends `sound ?? true` and bills the audio key, so an
// omitted sound must be quoted with audio (2026-10-02: 21 quoted, 32 billed).
assert.equal(await quotedKey({ model: 'kling-v3.0-std', duration: 5, videoResolution: '720p' }), 'kling-v3-standard-5s-audio')
assert.equal(await quotedKey({ model: 'kling-v3.0-std', duration: 5, videoResolution: '720p', sound: false }), 'kling-v3-standard-5s')
assert.equal(await quotedKey({ model: 'kling-v3.0-std', duration: 5, videoResolution: '720p', sound: true }), 'kling-v3-standard-5s-audio')

// A pasted MiniMax key carries K paid references past the row's own free
// allowance: H3 has five free, H3 Max four. The total must follow the row.
const h3 = await quotedKey({ model: 'minimax-h3-768p-10s-ref2' })
const h3Max = await quotedKey({ model: 'minimax-h3-max-768p-10s-ref2' })
assert.match(h3, /-ref2$/, `base H3 keeps its two paid references: ${h3}`)
const h3MaxSix = await quotedKey({ model: 'minimax-h3-max', duration: 10, videoResolution: '768p', referenceImages: 6 })
assert.equal(h3Max, h3MaxSix, 'a pasted H3 Max key with two paid references prices four free plus two')

console.log(`cost-key: Kling quotes omitted sound with audio; MiniMax paid references follow each row's free allowance (${h3}, ${h3Max})`)

// Retired seats (2026-10-23 swap and GPT Image 2). The server keeps their keys so older desktops bill;
// the ops never offer or quote them. `nano-banana-2-1k` is the retired Nano Banana 2 at 1K (4 credits),
// `nano-banana-2-1-1k` is Nano Banana 2.1 at 1K (3): an agent meaning the second must never get the first.
const REGISTRY = {
  'nano-banana-2-1k': 4, 'nano-banana-2-2k': 4, 'nano-banana-2-lite': 2, 'nano-banana-pro-4k': 15,
  'flux-2-max-4k-edit': 8, 'gpt-image-2-med-4k': 9,
  'nano-banana-2-1-1k': 3, 'nano-banana-2-1-2k': 4, 'flux-3-1k': 3, 'gpt-image-2-5-flare-high-2k': 2,
}
const RETIRED_KEYS = ['nano-banana-2-1k', 'nano-banana-2-2k', 'nano-banana-2-lite', 'nano-banana-pro-4k', 'flux-2-max-4k-edit', 'gpt-image-2-med-4k']
const full = {
  desktop: ctx.desktop,
  cloud: () => ({ get: async path => {
    const key = /[?&]costKey=([^&]+)/.exec(path)
    const rows = Object.entries(REGISTRY).map(([model, cost_credits]) => ({ model, cost_credits }))
    return { models: key ? rows.filter(r => r.model === decodeURIComponent(key[1])) : rows }
  } }),
}
const quote = async input => (await estimate.run(estimate.input.parse(input), full)).data
assert.deepEqual([(await quote({ model: 'nano-banana-2-1-1k' })).cost_key, (await quote({ model: 'nano-banana-2-1-1k' })).total_credits], ['nano-banana-2-1-1k', 3])
assert.equal((await quote({ model: 'nano-banana-2-1', resolution: '1k' })).cost_key, 'nano-banana-2-1-1k')
const REPLACED = { 'nano-banana-2': 'nano-banana-2-1', 'nano-banana-2-lite': 'nano-banana-2-1', 'nano-banana-pro': 'nano-banana-2-1', 'flux-2-max': 'flux-3', 'gpt-image-2': 'gpt-image-2-5-sunburst' }
for (const [id, replacement] of Object.entries({ ...REPLACED, 'nano-banana-2-1k': 'nano-banana-2-1', 'nano-banana-pro-4k': 'nano-banana-2-1', 'flux-2-max-4k-edit': 'flux-3', 'gpt-image-2-med-4k': 'gpt-image-2-5-sunburst' })) {
  await assert.rejects(quote({ model: id, resolution: '2k' }), new RegExp(`was retired and ${replacement} replaced it`), `${id} is refused and names ${replacement}`)
}
const list = ALL_OPERATIONS.find(op => op.id === 'slates_list_available_models')
const listed = async filter => (await list.run(list.input.parse(filter ? { filter } : {}), full)).text.split('\n').slice(1).map(line => line.split(' ')[0])
const all = await listed()
for (const key of RETIRED_KEYS) assert.ok(!all.includes(key), `${key} is not listed`)
assert.deepEqual(all, Object.keys(REGISTRY).filter(k => !RETIRED_KEYS.includes(k)), 'every current key is listed')
assert.deepEqual(await listed('nano-banana-2-1'), ['nano-banana-2-1-1k', 'nano-banana-2-1-2k'], 'the 2.1 filter lists 2.1 alone')
console.log(`cost-key: retired seats are never listed or quoted (${RETIRED_KEYS.length} keys hidden); an estimate for one names its replacement; nano-banana-2-1-1k quotes 2.1 at 1K`)
