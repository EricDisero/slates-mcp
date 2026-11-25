// The image ops refuse what they cannot deliver, before anything is spent, and a
// paid headless result is never lost. Each block is one behaviour that cost money
// or a misleading answer before 2026-11-24:
//   1. every image seat x every ratio and rung the schemas accept: generate,
//      estimate, edit and a saved Shot refuse exactly what MODEL_CAPABILITIES
//      refuses (GPT Image rendered a 4:5 ask as 16:9 and billed it);
//   2. a param a call would drop is refused (reference URLs beside a projectId,
//      a transparent background on a seat without one, a folder with no project);
//   3. the headless poller names the job and stops on a status that cannot change;
//   4. a headless result URL that does not answer with an image keeps its link;
//   5. a blank asset ref gets the teaching error, and no op reaches a bare
//      `.get(ref)!.id` again (static);
//   6. the upscale quote hands back the requestId the confirmed call and its
//      retries reuse.
// Reads the built package: run after `npm run build -w packages/shared`.
// `--self-test` proves the static half goes red.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── 5 (static): one resolver accessor, never a non-null assertion on a lookup ──
const BANG_LOOKUP = /\.get\([^()]*\)!\.id\b/
const bangLines = (text) => text.split('\n').flatMap((line, i) => (BANG_LOOKUP.test(line) ? [i + 1] : []))
if (process.argv.includes('--self-test')) {
  assert.equal(bangLines('const id = (await resolveAssetRefs(ctx, p, [a])).get(a)!.id').length, 1, 'self-test: missed .get(a)!.id')
  assert.equal(bangLines('assetIds.map((r) => resolved.get(r)!.id)').length, 1, 'self-test: missed resolved.get(r)!.id')
  assert.equal(bangLines('const id = refs.id(input.assetId)').length, 0, 'self-test: flagged refs.id()')
}
const opsFile = 'packages/shared/src/operations/index.ts'
const bang = bangLines(readFileSync(join(root, opsFile), 'utf8'))
if (bang.length) {
  console.error(`${opsFile}:${bang.join(',')}: \`.get(ref)!.id\` throws a bare TypeError when the ref is not in the map. Use the resolver's \`.id(ref)\` or \`.row(ref)\`, which throw the teaching error.`)
  process.exit(1)
}

const shared = await import(new URL('../packages/shared/dist/index.js', import.meta.url))
const { ALL_OPERATIONS, IMAGE_MODELS, MODEL_CAPABILITIES, AGENT_ROUTE_PROVIDER, aspectRatiosFor, aspectRatioUnion, CONFIRM_CREDITS } = shared
const op = (id) => ALL_OPERATIONS.find((o) => o.id === id)
const call = (id, input, ctx) => op(id).run(op(id).input.parse(input), ctx)
const projectId = '11111111-1111-4111-8111-111111111111'
const assetId = '22222222-2222-4222-8222-222222222222'
const RUNGS = ['1k', '2k', '3k', '4k']

// A price list that knows every key, priced above the confirm gate so nothing runs.
const pricedCloud = (credits) => ({
  get: async (path) => {
    const key = new URL(path, 'http://x').searchParams.get('costKey')
    return { models: key ? [{ model: key, cost_credits: credits }] : [] }
  },
  post: async (path) => assert.fail(`unexpected cloud write ${path}`),
})
const desktop = {
  requireCapability: async () => {},
  get: async (path) => assert.fail(`unexpected desktop read ${path}`),
  post: async (path) => assert.fail(`unexpected desktop write ${path}`),
}
const ctx = { cloud: () => pricedCloud(CONFIRM_CREDITS * 1000), desktop: () => desktop }
const refused = (r, field) => r.data?.requires_clarification === true && r.data.missing.includes(field)

// ── 1: the capability sweep, against MODEL_CAPABILITIES read directly ──
let cells = 0
for (const model of IMAGE_MODELS) {
  const ratios = aspectRatiosFor(model, AGENT_ROUTE_PROVIDER)
  const rungs = MODEL_CAPABILITIES[model].imageResolutions
  const rung = MODEL_CAPABILITIES[model].defaultImageResolution
  for (const aspectRatio of aspectRatioUnion(IMAGE_MODELS)) {
    const legal = ratios.includes(aspectRatio)
    const gen = await call('slates_generate_image', { prompt: 'a lighthouse', model, projectId, aspectRatio, resolution: rung }, ctx)
    assert.equal(refused(gen, 'aspectRatio'), !legal, `generate ${model} ${aspectRatio}: ${JSON.stringify(gen.data)}`)
    if (legal) assert.equal(gen.data.requires_confirm, true, `generate ${model} ${aspectRatio} should reach the confirm gate`)
    const est = await call('slates_estimate_generation_cost', { model, aspectRatio, resolution: rung }, ctx)
    assert.equal(refused(est, 'aspectRatio'), !legal, `estimate ${model} ${aspectRatio}`)
    const edit = await call('slates_edit_image', { projectId, sourceAssetId: assetId, prompt: 'red jacket', editModel: model, aspectRatio, resolution: rung }, ctx)
    assert.equal(refused(edit, 'aspectRatio'), !legal, `edit ${model} ${aspectRatio}`)
    const shot = await call('slates_create_shot', { projectId, model, prompt: 'a lighthouse', params: { aspectRatio } }, {
      cloud: ctx.cloud, desktop: () => ({ ...desktop, requireCapability: async () => { throw new Error('reached the desktop') } }),
    }).catch((e) => ({ error: e.message }))
    assert.equal(refused(shot, 'aspectRatio'), !legal, `shot ${model} ${aspectRatio}: ${JSON.stringify(shot)}`)
    cells += 4
  }
  for (const resolution of RUNGS) {
    const legal = rungs.includes(resolution)
    const gen = await call('slates_generate_image', { prompt: 'a lighthouse', model, projectId, aspectRatio: '16:9', resolution }, ctx)
    assert.equal(refused(gen, 'resolution'), !legal, `generate ${model} ${resolution}`)
    const est = await call('slates_estimate_generation_cost', { model, resolution }, ctx)
    assert.equal(refused(est, 'resolution'), !legal, `estimate ${model} ${resolution}: ${JSON.stringify(est.data)}`)
    const edit = await call('slates_edit_image', { projectId, sourceAssetId: assetId, prompt: 'red jacket', editModel: model, resolution }, ctx)
    assert.equal(refused(edit, 'resolution'), !legal, `edit ${model} ${resolution}`)
    cells += 3
  }
}
// The Kling edit window, and a known model whose parameters miss the price list.
assert.ok(refused(await call('slates_estimate_generation_cost', { model: 'kling-v3.0-omni-edit', duration: 40 }, ctx), 'duration'))
await assert.rejects(
  call('slates_estimate_generation_cost', { model: 'nano-banana-2-1', resolution: '2k' }, { cloud: () => ({ get: async () => ({ models: [] }) }) }),
  /No price for nano-banana-2-1-2k/
)

// ── 2: a dropped param is refused, before any desktop write ──
const gen = (input) => call('slates_generate_image', { prompt: 'a lighthouse', aspectRatio: '1:1', ...input }, ctx)
assert.ok(refused(await gen({ model: 'nano-banana-2-1', projectId, referenceImageUrls: ['https://example.com/face.jpg'] }), 'referenceImageUrls'))
for (const model of IMAGE_MODELS.filter((m) => !shared.operations.takesBackgroundMode(m))) {
  assert.ok(refused(await gen({ model, projectId, backgroundMode: 'transparent' }), 'backgroundMode'), `${model} transparent`)
  assert.ok(refused(await call('slates_edit_image', { projectId, sourceAssetId: assetId, prompt: 'x', editModel: model, backgroundMode: 'transparent' }, ctx), 'backgroundMode'))
}
assert.ok(refused(await gen({ folderId: assetId }), 'folderId'))

// ── 3: the poller names the job, and stops on a status that cannot change ──
const { pollProxyJob } = shared.operations
const gone = Object.assign(new Error('slates-api /proxy/jobs/job-9 failed (404): Job not found'), { status: 404 })
let polls = 0
await assert.rejects(pollProxyJob({ get: async () => { polls++; throw gone } }, 'job-9', { intervalMs: 1, timeoutMs: 60_000 }), /job-9.*Do not call/s)
assert.equal(polls, 1, 'a 404 is final: one poll, not five minutes of them')
await assert.rejects(pollProxyJob({ get: async () => ({ status: 'processing' }) }, 'job-7', { intervalMs: 1, timeoutMs: 20 }), /Job job-7 was submitted/)

// ── 4: a result URL answering with an error page keeps its link, and inlines nothing ──
const realFetch = globalThis.fetch
globalThis.fetch = async () => new Response('<html>expired</html>', { status: 403, headers: { 'content-type': 'text/html' } })
try {
  const url = 'https://cdn.example.com/out.png'
  const headless = await call('slates_generate_image', { prompt: 'a lighthouse', aspectRatio: '1:1' }, {
    desktop,
    cloud: () => ({ ...pricedCloud(1), post: async () => ({ success: true, data: { images: [{ url }] } }) }),
  })
  assert.equal(headless.images.length, 0, 'an error page is never inlined as an image')
  assert.deepEqual(headless.data.urls, [url])
  assert.match(headless.text, /could not be attached/)
} finally {
  globalThis.fetch = realFetch
}

// ── 5 (runtime): a blank ref is the teaching error, not a TypeError ──
await assert.rejects(call('slates_get_asset', { projectId, assetId: ' ' }, ctx), /asset reference is blank/)

// ── 6: the upscale quote carries the requestId the confirmed call reuses ──
let sentId
const upscaleDesktop = {
  ...desktop,
  get: async () => ({ assetId, code: 'IMG-A1', factor: 2, width: 1000, height: 1000, outWidth: 2000, outHeight: 2000, credits: CONFIRM_CREDITS + 1 }),
  post: async (_path, body) => { sentId = body.requestId; return { asset: { id: 'new', code: 'IMG-A2', filePath: 'x', width: 2000, height: 2000 } } },
}
const quote = await call('slates_upscale_image', { projectId, assetId, factor: 2 }, { cloud: ctx.cloud, desktop: () => upscaleDesktop })
assert.match(quote.data.requestId ?? '', /^[0-9a-f-]{36}$/, 'the confirm gate hands back a requestId')
await call('slates_upscale_image', { projectId, assetId, factor: 2, confirm: true, requestId: quote.data.requestId }, { cloud: ctx.cloud, desktop: () => upscaleDesktop })
assert.equal(sentId, quote.data.requestId)

console.log(`image-op-guards: ${cells} seat x ratio/rung cells agree with MODEL_CAPABILITIES; dropped params, the poller, headless downloads, blank refs and the upscale id hold`)
