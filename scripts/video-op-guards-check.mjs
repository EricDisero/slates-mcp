// The video ops refuse a malformed call before any desktop or cloud request.
// Runs against the built package (npm run build -w packages/shared first).
import assert from 'node:assert/strict'
import { generateVideo, editVideo, createShot } from '../packages/shared/dist/operations/index.js'

const projectId = '11111111-1111-4111-8111-111111111111'
const noTransport = { desktop: () => { throw new Error('no desktop call expected') }, cloud: () => { throw new Error('no cloud call expected') } }

// audioReferenceSpokenText pairs by position on EVERY model: one line for two clips
// would send clip A with clip B's words. It was enforced only inside the MiniMax block.
for (const model of ['seedance-2.5', 'wan-3.0', 'minimax-h3']) {
  const r = await generateVideo.run(generateVideo.input.parse({
    model, projectId, prompt: 'Two people talk.', aspectRatio: '16:9', duration: 5,
    ingredientAssetIds: ['IMG-A1'], audioReferenceAssetIds: ['AUD-S1', 'AUD-S2'], audioReferenceSpokenText: ['the words in clip two'],
  }), noTransport)
  assert.equal(r.data?.requires_clarification, true, `${model}: a misaligned spoken-text array is refused`)
  assert.match(r.data.message, /pairs by position/)
}
// The Shot path pairs through the same rule.
const shot = await createShot.run(createShot.input.parse({
  projectId, prompt: 'Two people talk.', refs: { 'audio-reference': ['AUD-S1', 'AUD-S2'] }, audioRefSpokenText: ['one line'],
}), noTransport)
assert.match(shot.data?.message ?? '', /pairs by position/)

// edit_video takes the union of its engines' resolutions; each engine's own row decides.
const editDesktop = { desktop: () => ({ requireCapability: async () => {}, get: async (path) => { throw new Error('unexpected GET ' + path) } }), cloud: noTransport.cloud }
const edit = await editVideo.run(editVideo.input.parse({
  projectId, sourceVideoAssetId: 'VID-V1', prompt: 'Make it night.', model: 'omni-flash-1-2-edit', videoResolution: '480p',
}), editDesktop)
assert.equal(edit.data?.requires_clarification, true, 'omni-flash-1-2-edit at 480p is a capability refusal, not a registry miss')
assert.match(edit.data.message, /omni-flash-1-2-edit does not render at 480p/)

console.log('Video op guards: spoken-text pairing on every model and the Shot path; edit resolution per engine.')
