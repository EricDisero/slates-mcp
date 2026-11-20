import assert from 'node:assert/strict'
import { ALL_OPERATIONS } from '../packages/shared/dist/index.js'
import { normalizeShotSpec } from '../packages/shared/dist/prompts/shot-spec.js'

const projectId = '11111111-1111-4111-8111-111111111111'
const assetId = '22222222-2222-4222-8222-222222222222'
const timelineId = '33333333-3333-4333-8333-333333333333'
const model = 'seedance-2.5'
const take = { projectId, assetId: 'VID-A1', resolution: '4k' }
const cut = { projectId, timelineId }
const confirm = { confirm: true, maxCredits: 18 }
function call(name, input, ctx) {
  const op = ALL_OPERATIONS.find(op => op.id === 'slates_' + name)
  return op.run(op.input.parse(input), ctx)
}

const cloud = { get: async () => ({ models: [
  { model: model + '-480p-5s', cost_credits: 5 },
  { model: model + '-4k-5s', cost_credits: 18 },
] }) }
for (const [options, cost_key, total_credits] of [
  [{ seedanceDraft: true }, model + '-480p-5s', 5],
  [{ videoResolution: '4k' }, model + '-4k-5s', 18],
  [{ model: model + '-4k-5s', videoResolution: '480p', seedanceDraft: true }, model + '-480p-5s', 5],
]) {
  const { data } = await call('estimate_generation_cost', { model, duration: 5, ...options }, { cloud: () => cloud })
  assert.equal(data.cost_key, cost_key)
  assert.equal(data.total_credits, total_credits)
}
await assert.rejects(call('estimate_generation_cost', { model, duration: 5, seedanceDraft: true, videoResolution: '4k' }, {}), /480p/)
assert.equal(normalizeShotSpec({ params: { seedanceDraft: true } }).params.videoResolution, '480p')

let params = { videoResolution: '480p' }
const oldDesktop = {
  requireCapability: async cap => { if (cap === 'seedance-drafts') throw new Error('Older desktop lacks seedance-drafts') },
  get: async path => {
    assert.equal(path, '/agent/shots/get')
    return { shot: { id: 'shot', projectId, model, params } }
  },
  post: async path => assert.fail('unexpected write ' + path),
}
const old = { desktop: () => oldDesktop }
for (const options of [{ seedanceDraft: true }, { videoResolution: '4k' }]) {
  await assert.rejects(call('generate_video', { model, prompt: 'Scene', projectId, ...options }, old), /Older desktop/)
}
await assert.rejects(call('create_shot', { model, projectId, prompt: 'Scene', params: { seedanceDraft: true } }, old), /Older desktop/)
await assert.rejects(call('update_shot', { projectId, shotId: 'shot', params: { videoResolution: '4k' } }, old), /Older desktop/)
await assert.rejects(call('duplicate_shot', { shotId: 'shot', params: { seedanceDraft: true } }, old), /Older desktop/)
for (params of [{ seedanceDraft: true }, { videoResolution: '480p' }, { videoResolution: '4k' }]) {
  await assert.rejects(call('generate_from_shots', { shotIds: ['shot'], confirm: true, fingerprint: 'current' }, old), /Older desktop/)
}
await assert.rejects(call('quote_draft_finish', take, old), /Older desktop/)
await assert.rejects(call('finish_cut_drafts', { ...cut, quoteId: 'quote', ...confirm }, old), /Older desktop/)

let charged = 13
let acceptedCost = 18
let terminalReads = 0
const desktop = {
  requireCapability: async cap => assert.equal(cap, 'seedance-drafts'),
  get: async (path, query) => {
    if (path === '/agent/assets') return { assets: [{ id: assetId, code: take.assetId, type: 'video' }] }
    if (path === '/agent/assets/quote-draft-finish') {
      assert.deepEqual(query, { ...take, assetId })
      return { duration: 5, credits: 18 }
    }
    terminalReads++
    if (path === '/agent/generation/status') {
      assert.deepEqual(query, { id: 'finish' })
      return { generation: { status: 'completed', draftFinishCredits: charged }, asset: { id: 'final' } }
    }
    assert.equal(path, '/agent/timeline/draft-finish')
    assert.deepEqual(query, { ...cut, quoteId: 'quote' })
    return { status: 'completed', cost_credits: charged }
  },
  post: async (path, body) => {
    if (body.action === 'quoteDrafts') {
      assert.deepEqual(body, { ...cut, action: 'quoteDrafts' })
      return { quoteId: 'quote', credits: 18 }
    }
    assert.equal(body.confirm, true)
    assert.equal(body.background, true)
    if (body.maxCredits < 18) throw new Error('Finish exceeds approved quote.')
    assert.equal(body.maxCredits, 18)
    if (path === '/agent/assets/finish-draft') {
      assert.equal(body.assetId, assetId)
      return { generationId: 'finish', status: 'processing', cost_credits: acceptedCost }
    }
    assert.equal(path, '/agent/timeline/cut')
    assert.equal(body.action, 'finishDrafts')
    assert.equal(body.quoteId, 'quote')
    return { status: 'running', cost_credits: 0 }
  },
}
const external = { desktop: () => desktop }
const studio = { ...external, waitForCutFinish: true }
assert.equal((await call('quote_draft_finish', take, external)).data.credits, 18)
assert.equal((await call('quote_cut_drafts', cut, external)).data.quoteId, 'quote')
for (const [name, target] of [['finish_draft', take], ['finish_cut_drafts', { ...cut, quoteId: 'quote' }]]) {
  assert.throws(() => call(name, { ...target, maxCredits: 18 }, external))
  await assert.rejects(call(name, { ...target, confirm: true, maxCredits: 17 }, studio), /exceeds approved/)
  await call(name, { ...target, ...confirm }, external)
}
assert.equal(terminalReads, 0, 'external clients receive a job before polling')
for (const [submitted, actual, expected] of [[18, 13, 13], [18, 0, 0], [0, 13, 0]]) {
  acceptedCost = submitted
  charged = actual
  const { data } = await call('finish_draft', { ...take, ...confirm }, studio)
  assert.deepEqual(data, { status: 'completed', generationId: 'finish', assetId: 'final', cost_credits: expected })
}
charged = 7
assert.deepEqual((await call('finish_cut_drafts', { ...cut, quoteId: 'quote', ...confirm }, studio)).data, { status: 'completed', cost_credits: 7 })
charged = 0
assert.equal((await call('get_cut_draft_status', { ...cut, quoteId: 'quote' }, external)).data.cost_credits, 0)
assert.equal(terminalReads, 5)
console.log('Seedance draft operations passed for estimates, old desktops, spend ceilings and finish receipts.')
