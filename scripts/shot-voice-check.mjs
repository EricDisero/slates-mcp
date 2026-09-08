// Exercise the published operation functions against a fake desktop transport.
import assert from 'node:assert/strict'
import { createShot, updateShot, duplicateShot, getShot, generateFromShots, TTS_MODEL } from '../packages/shared/dist/operations/index.js'
import { audioCostKey } from '../packages/shared/dist/operations/index.js'
import { mergeShotParams } from '../packages/shared/dist/prompts/shot-spec.js'

const projectId = '11111111-1111-4111-8111-111111111111'
const assetId = '22222222-2222-4222-8222-222222222222'
const requests = []
const desktop = {
  requireCapability: async () => {},
  get: async (path, query) => {
    if (path === '/agent/shots/get') return { shot: { projectId } }
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
desktop.get = async () => ({ shot: { id: 'shot', projectId, name: 'Speech', model: TTS_MODEL,
  rawPrompt: line, composedPrompt: line, line, params: { voiceId: 'preset' }, firesWith: {}, blocked: null } })
ctx.cloud = () => ({ get: async () => ({ models: [{ model: key, cost_credits: 1 }] }) })
const detail = await getShot.run({ shotId: 'shot' }, ctx)
assert.equal(detail.data.cost_key, key, 'TTS Shots must be priceable without a duration')
const quote = await generateFromShots.run({ shotIds: ['shot'] }, ctx)
assert.equal(quote.data.shots[0].cost_key, key)
assert.equal(quote.data.total_credits, 1)
assert.equal(quote.data.blocked_count, 0)
desktop.post = async (path, body) => {
  assert.equal(path, '/agent/shots/batch-generate')
  assert.deepEqual(body.shotIds, ['shot'])
  return { results: [{ id: 'shot', status: 'completed' }], total: 1, succeeded: 1, failed: 0 }
}
const batch = await generateFromShots.run({ shotIds: ['shot'], confirm: true }, ctx)
assert.equal(batch.data.succeeded, 1, 'a priced TTS batch reaches the shared generation route')
console.log('TTS Shot quotes: get and batch use the text bucket without requiring duration.')
