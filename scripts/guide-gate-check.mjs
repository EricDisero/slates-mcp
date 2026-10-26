// The guide gate (operations/index.ts `requireGuideRead`): a session that keeps a
// ledger cannot generate on a model until it has fetched that model's guide.
import assert from 'node:assert/strict'
import { generateVideo, generateImage, generateCharacterIdentity, generateEnvironmentPlate, extractGridCells, generateChatGptImage, getPromptingGuide, GuideNotReadError, resolveGuideTopic } from '../packages/shared/dist/operations/index.js'
import { toolModelFor } from '../packages/shared/dist/prompts/model-facts.js'
import { useBrainSource } from '../packages/shared/dist/skills/served.js'
import { brainOrSkip } from './brain-source.mjs'

// The guides are the brain's (slates-api brain/), held as a member's server holds them, here and in any server this spawns.
const brain = brainOrSkip('guide-gate')
process.env.SLATES_BRAIN_DIR = brain
useBrainSource(brain)

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

// 5. The tool seats gate on the guide of the seat they render on; ChatGPT images on its own guide.
const id = '22222222-2222-4222-8222-222222222222'
const seats = [
  [generateCharacterIdentity, { characterId: id, projectId: id, baseAssetId: id }, resolveGuideTopic(toolModelFor('character-sheet'))],
  [generateCharacterIdentity, { characterId: id, projectId: id, baseAssetId: id, model: 'nano-banana-2-1' }, resolveGuideTopic('nano-banana-2-1')],
  [generateEnvironmentPlate, { environmentId: id, projectId: id }, resolveGuideTopic(toolModelFor('environment-plate'))],
  [extractGridCells, { projectId: id, assetId: id, cells: ['1A'] }, resolveGuideTopic(toolModelFor('grid-extract'))],
  [extractGridCells, { projectId: id, assetId: id, cells: ['1A'], model: 'flux-3' }, resolveGuideTopic('flux-3')],
  [generateChatGptImage, { projectId: id, requestId: id, prompt: 'A garage.' }, 'slates-chatgpt-images'],
]
for (const [op, input, guide] of seats) {
  assert.ok(guide, `${op.id} resolves a guide`)
  const fresh = session()
  await assert.rejects(op.run({ ...input }, fresh), (err) => err instanceof GuideNotReadError && err.guide === guide, `${op.id} is refused until ${guide} is read`)
  await getPromptingGuide.run({ topic: guide }, fresh)
  await notGated(op.run({ ...input }, fresh))
}

console.log('guide-gate: refused with the card before any spend; the guide fetch opens it per model; a new model is refused again; the tool seats and ChatGPT images gate the same way; no ledger, no gate')
