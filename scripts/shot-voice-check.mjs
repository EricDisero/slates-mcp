// Exercise the published operation functions against a fake desktop transport.
import assert from 'node:assert/strict'
import { createShot, updateShot, duplicateShot, getShot, splitShot, mergeShots, generateFromShots, TTS_MODEL } from '../packages/shared/dist/operations/index.js'
import { audioCostKey } from '../packages/shared/dist/operations/index.js'
import { mergeShotParams } from '../packages/shared/dist/prompts/shot-spec.js'

const projectId = '11111111-1111-4111-8111-111111111111'
const assetId = '22222222-2222-4222-8222-222222222222'
const requests = []
const desktop = {
  requireCapability: async () => {},
  get: async (path, query) => {
    if (path === '/agent/shots/get') return { shot: { id: 'shot-a1', projectId } }
    assert.equal(path, '/agent/assets')
    assert.equal(query.projectId, projectId)
    return { assets: [{ id: assetId, projectId, code: 'AUD-S1', type: 'audio', label: 'Voice' }] }
  },
  post: async (path, body) => { requests.push({ path, body }); return { shot: { code: 'SHOT-A1' } } },
}
const ctx = { desktop: () => desktop }
const params = { voiceReferenceAssetId: 'AUD-S1' }
await createShot.run({ projectId, prompt: 'Hello', params }, ctx)
assert.equal(requests.at(-1).body.spec.params.voiceReferenceAssetId, assetId)
await updateShot.run({ projectId, shotId: 'SHOT-A1', params }, ctx)
const patch = requests.at(-1).body.data.spec.params
assert.deepEqual(mergeShotParams({ voiceId: 'old-preset', audioLoop: true }, patch),
  { voiceReferenceAssetId: assetId, audioLoop: true })
await duplicateShot.run({ shotId: 'SHOT-A1', params }, ctx)
assert.equal(requests.at(-1).body.spec.params.voiceReferenceAssetId, assetId)
await assert.rejects(createShot.run({ projectId, prompt: 'Hello', params: { voiceReferenceAssetId: 'AUD-S9' } }, ctx),
  /No asset matching/)
console.log('Shot voice ops: asset codes resolve for create/update/duplicate; source changes replace previous choices.')

const line = 'Only the words to speak.'
const key = audioCostKey({ model: TTS_MODEL, characters: line.length })
desktop.get = async (path) => path === '/agent/shots/quote'
  ? { fingerprint: 'voice-quote', items: [{ shotId: 'shot', name: 'Speech', model: TTS_MODEL, credits: 1, blocked: null }], total: 0.03, largest: 0.03, unpriced: 0 }
  : { shot: { id: 'shot', projectId, name: 'Speech', model: TTS_MODEL,
  rawPrompt: line, composedPrompt: line, line, params: { voiceId: 'preset' }, firesWith: {}, blocked: null } }
ctx.cloud = () => ({ get: async () => ({ models: [{ model: key, cost_credits: 1 }] }) })
const detail = await getShot.run({ shotId: 'shot' }, ctx)
assert.equal(detail.data.credits, 1, 'TTS Shots must be priceable without a duration')
const quote = await generateFromShots.run({ shotIds: ['shot'] }, ctx)
assert.equal(quote.data.items[0].credits, 1)
assert.equal(quote.data.fingerprint, 'voice-quote')
assert.equal(quote.data.total_credits, 1)
assert.equal(quote.data.items[0].blocked, null)
desktop.post = async (path, body) => {
  assert.equal(path, '/agent/shots/batch-generate')
  assert.deepEqual(body.shotIds, ['shot'])
  return { results: [{ id: 'shot', status: 'completed' }], total: 1, succeeded: 1, failed: 0 }
}
const batch = await generateFromShots.run({ shotIds: ['shot'], confirm: true, fingerprint: 'voice-quote' }, ctx)
assert.equal(batch.data.succeeded, 1, 'a priced TTS batch reaches the shared generation route')
const stale = await generateFromShots.run({ shotIds: ['shot'], confirm: true, fingerprint: 'stale' }, ctx)
assert.equal(stale.data.requires_confirm, true, 'changed quote never reaches generation')
console.log('TTS Shot quotes: get and batch use the text bucket without requiring duration.')

// Shot refs: a SHOT-A code is unique per project only. Project B's SHOT-A1 is the
// newest, so a lookup without a project lands there; every op must scope to A.
const otherProject = '33333333-3333-4333-8333-333333333333'
const shotsByProject = {
  [projectId]: { id: 'a-shot', code: 'SHOT-A1', projectId, model: 'seedance-2.5', params: {} },
  [otherProject]: { id: 'b-shot', code: 'SHOT-A1', projectId: otherProject, model: 'seedance-2.5', params: {} },
}
const sent = []
const twoProjects = {
  requireCapability: async () => {},
  get: async (path, query) => {
    if (path === '/agent/shots/get') return { shot: shotsByProject[query.projectId ?? otherProject] }
    if (path === '/agent/shots/quote') return { fingerprint: 'f', items: JSON.parse(query.input).shotIds.map((shotId) => ({ shotId, credits: 1 })) }
    if (path === '/agent/assets') return { assets: [{ id: assetId, projectId, code: 'IMG-A8', type: 'image', label: 'Poster' }] }
    if (path === '/agent/shots') return { shots: [] }
    throw new Error('unexpected GET ' + path)
  },
  post: async (path, body) => { sent.push({ path, body }); return { shot: { id: 'a-shot' }, first: {}, second: {} } },
}
const scoped = { desktop: () => twoProjects }
await updateShot.run({ projectId, shotId: 'SHOT-A1', name: 'Renamed', posterAssetId: 'IMG-A8' }, scoped)
assert.equal(sent.at(-1).body.id, 'a-shot', 'update_shot resolves a code inside its own project')
assert.equal(sent.at(-1).body.data.posterAssetId, assetId, 'a poster badge code resolves to its asset id')
await duplicateShot.run({ projectId, shotId: 'SHOT-A1' }, scoped)
assert.equal(sent.at(-1).body.id, 'a-shot')
await splitShot.run({ projectId, shotId: 'SHOT-A1' }, scoped)
assert.equal(sent.at(-1).body.id, 'a-shot')
await mergeShots.run({ projectId, firstId: 'SHOT-A1', secondId: 'SHOT-A1' }, scoped)
assert.deepEqual([sent.at(-1).body.firstId, sent.at(-1).body.secondId], ['a-shot', 'a-shot'])
assert.equal((await getShot.run({ projectId, shotId: 'SHOT-A1' }, scoped)).data.id, 'a-shot')
assert.equal((await generateFromShots.run({ projectId, shotIds: ['SHOT-A1'] }, scoped)).data.items[0].shotId, 'a-shot')
// A Shot the desktop finds in another project is refused, never written or billed.
const leaky = { desktop: () => ({ ...twoProjects, get: async (path, query) => path === '/agent/shots/get' ? { shot: shotsByProject[otherProject] } : twoProjects.get(path, query) }) }
await assert.rejects(updateShot.run({ projectId, shotId: 'SHOT-A1', name: 'x' }, leaky), /another project/)
await assert.rejects(generateFromShots.run({ shotIds: ['a-shot', 'SHOT-A1'] }, {
  desktop: () => ({ ...twoProjects, get: async (path, query) => path === '/agent/shots/get'
    ? { shot: query.id === 'a-shot' ? shotsByProject[projectId] : shotsByProject[otherProject] } : twoProjects.get(path, query) }),
}), /2 projects/)
console.log('Shot refs: codes resolve in their own project for update, duplicate, split, merge, get and generate; a mixed batch is refused.')

// An edit that names no model is gated against the stored Shot's model, as create is.
sent.length = 0
for (const run of [
  () => createShot.run({ projectId, prompt: 'Hello', model: 'seedance-2.5', params: { aspectRatio: '4:5' } }, scoped),
  () => updateShot.run({ projectId, shotId: 'SHOT-A1', params: { aspectRatio: '4:5' } }, scoped),
  () => duplicateShot.run({ projectId, shotId: 'SHOT-A1', params: { aspectRatio: '4:5' } }, scoped),
]) assert.equal((await run()).data.requires_clarification, true, 'seedance-2.5 refuses 4:5 on create, update and duplicate')
assert.equal(sent.length, 0, 'a refused recipe is never saved')

// Switching a Seedance draft off returns the Shot to its model's default resolution.
const drafted = mergeShotParams({}, { seedanceDraft: true })
assert.equal(drafted.videoResolution, '480p')
assert.equal(mergeShotParams(drafted, { seedanceDraft: false }).videoResolution, undefined, 'draft off drops the implied 480p')
assert.equal(mergeShotParams(drafted, { seedanceDraft: false, videoResolution: '480p' }).videoResolution, '480p', 'a named 480p stays')
console.log('Shot capability gate on stored models, and draft off restores the resolution.')
