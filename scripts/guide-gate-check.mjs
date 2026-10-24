// The guide gate (operations/index.ts `requireGuideRead`): a session that keeps a
// ledger cannot generate on a model until it has fetched that model's guide.
import assert from 'node:assert/strict'
import { generateVideo, generateImage, getPromptingGuide, GuideNotReadError, resolveGuideTopic } from '../packages/shared/dist/operations/index.js'

// A desktop that fails loudly if a refused call ever reaches it.
const reached = []
const desktop = {
  requireCapability: async () => {},
  get: async (path) => { reached.push(path); throw new Error(`reached the desktop: ${path}`) },
  post: async (path) => { reached.push(path); throw new Error(`reached the desktop: ${path}`) },
}
// Past the gate: the op answers (a quote, a question) or fails further on, never with the gate's refusal.
const notGated = (promise) => promise.then(() => true, (err) => { assert.ok(!(err instanceof GuideNotReadError), err.message); return true })
const session = () => ({ desktop: () => desktop, cloud: () => ({ get: async () => ({ models: [] }) }), guidesRead: new Set() })
const video = { prompt: 'A car drifts through a garage.', model: 'seedance-2.5', projectId: '11111111-1111-4111-8111-111111111111' }
const seedanceGuide = resolveGuideTopic('seedance-2.5')
assert.ok(seedanceGuide, 'seedance-2.5 resolves to a guide')

// 1. No fetch: refused, with the card, before the desktop is touched.
const ctx = session()
await assert.rejects(generateVideo.run({ ...video }, ctx), (err) => {
  assert.ok(err instanceof GuideNotReadError)
  assert.equal(err.guide, seedanceGuide)
  assert.match(err.message, new RegExp(`topic "${seedanceGuide}"`))
  assert.ok(err.message.length > 400, 'the refusal carries the guide card')
  return true
})
assert.deepEqual(reached, [], 'a refused generation never reaches the desktop')
assert.equal(ctx.guidesRead.size, 0, 'a refusal does not count as reading the guide')

// 2. Fetch, then the gate opens (the call goes on to the desktop).
await getPromptingGuide.run({ topic: 'seedance-2.5' }, ctx)
assert.ok(ctx.guidesRead.has(seedanceGuide))
await notGated(generateVideo.run({ ...video }, ctx))

// 3. A different model with its own guide is refused again.
const kling = 'kling-v3-pro'
assert.notEqual(resolveGuideTopic(kling), seedanceGuide)
await assert.rejects(generateVideo.run({ ...video, model: kling }, ctx), GuideNotReadError)
await assert.rejects(generateImage.run({ prompt: 'A garage.', aspectRatio: '9:16', resolution: '1k' }, ctx), GuideNotReadError)

// 4. No ledger (the CLI): no gate.
await notGated(generateVideo.run({ ...video }, { desktop: () => desktop, cloud: ctx.cloud }))

console.log('guide-gate: refused with the card before any spend; the guide fetch opens it per model; a new model is refused again; no ledger, no gate')
