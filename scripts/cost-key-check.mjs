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
