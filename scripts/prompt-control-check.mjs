import assert from 'node:assert/strict'
import { findBannedTokens } from '../packages/shared/dist/prompts/banned-tokens.js'
import { composeReferences, cleanPrompt } from '../packages/shared/dist/prompts/reference-composer.js'
import { MODEL_CAPABILITIES, DEFAULT_GPT_QUALITY } from '../packages/shared/dist/prompts/model-capabilities.js'
import { defaultModelFor } from '../packages/shared/dist/prompts/model-facts.js'
import { ALL_OPERATIONS, brainFiles, toolDefinitions, useBrainSource } from '../packages/shared/dist/index.js'
import { brainOrSkip } from './brain-source.mjs'

// The cinematic catalogue is the brain's (slates-api brain/), held as a member's server holds it.
useBrainSource(brainOrSkip('prompt-control'))
const SKILLS = brainFiles()

const op = (id) => ALL_OPERATIONS.find((o) => o.id === `slates_${id}`)
const call = (id, input, ctx) => op(id).run(op(id).input.parse(input), ctx)
// External-host results preserve provenance; ordinary uploads keep their existing payload.
{
  const projectId = '11111111-1111-4111-8111-111111111111'
  const referenceId = '22222222-2222-4222-8222-222222222222'
  const assetId = '33333333-3333-4333-8333-333333333333'
  const posts = []
  const capabilities = []
  const ctx = { desktop: () => ({
    requireCapability: async cap => { capabilities.push(cap) },
    get: async () => ({ assets: [
      { id: referenceId, code: 'IMG-A1', label: 'Reference', type: 'image' },
      { id: assetId, code: 'IMG-A2', label: 'Result', type: 'image' },
    ] }),
    post: async (route, body) => { posts.push({ route, body }); return { asset: { id: assetId } } },
  }) }
  await call('save_external_image', { projectId, assetId: 'IMG-A2', prompt: 'Exact prompt',
    generator: 'External host', referenceAssetIds: ['IMG-A1'] }, ctx)
  assert.deepEqual(capabilities, ['external-image-metadata'])
  assert.equal(posts[0].route, '/agent/assets/external-image')
  assert.equal(posts[0].body.assetId, assetId)
  assert.deepEqual(posts[0].body.referenceAssetIds, [referenceId])
  assert.equal(posts[0].body.model, undefined)
  assert.equal(op('save_external_image').billable, undefined)
  assert.equal(op('save_external_image').input.safeParse({ projectId, prompt: 'p', generator: 'g' }).success, false)
  await call('upload_reference_image', { projectId, filePath: 'C:/fixture/ordinary.png' }, ctx)
  assert.deepEqual(posts[1], { route: '/agent/assets/upload', body: { projectId, filePath: 'C:/fixture/ordinary.png', type: 'image' } })
  assert.ok(!capabilities.includes('asset-naming'), 'an upload with no name asks for no naming capability')
  // A name and a note travel with the upload (trimmed), on a path or a pasted picture, and gate on the desktop that reads them.
  await call('upload_reference_image', { projectId, filePath: 'C:/fixture/shirt.png', label: '  Ref: copper No ', note: 'Pasted shirt' }, ctx)
  assert.deepEqual(posts.at(-1), { route: '/agent/assets/upload', body: { projectId, filePath: 'C:/fixture/shirt.png', type: 'image', label: 'Ref: copper No', note: 'Pasted shirt' } })
  assert.equal(capabilities.at(-1), 'asset-naming')
  await call('upload_reference_image', { projectId, dataUrl: 'data:image/png;base64,AAAA', label: 'Pasted ref' }, ctx)
  assert.deepEqual(posts.at(-1), { route: '/agent/assets/upload-base64', body: { projectId, dataUrl: 'data:image/png;base64,AAAA', label: 'Pasted ref' } })
  for (const bad of [{ label: '  ' }, { label: 'x'.repeat(121) }, { note: '' }, { note: 'n'.repeat(2001) }]) {
    assert.equal(op('upload_reference_image').input.safeParse({ projectId, filePath: 'C:/fixture/a.png', ...bad }).success, false, `refuses ${JSON.stringify(bad).slice(0, 30)}`)
  }
  assert.match(op('upload_reference_image').description, /slates_save_external_image with referenceAssetIds/)
  assert.ok(op('upload_reference_image').description.length < 2048)
  posts.length = 2
  // slates_update_asset resolves a badge code, posts only what was passed, and answers a compact row.
  const renamePosts = []
  const renameCtx = { desktop: () => ({
    requireCapability: async cap => { capabilities.push(cap) },
    get: async () => ({ assets: [{ id: assetId, code: 'IMG-A2', label: 'Result', type: 'image' }] }),
    post: async (route, body) => { renamePosts.push({ route, body }); return { asset: { id: assetId, code: 'IMG-A2', label: 'Ref: shirt', type: 'image', prompt: 'The shirt front', filePath: 'secret.png' } } },
  }) }
  const renamed = await call('update_asset', { projectId, assetId: 'IMG-A2', label: ' Ref: shirt ' }, renameCtx)
  assert.deepEqual(renamePosts[0], { route: '/agent/assets/update', body: { assetId, label: 'Ref: shirt' } })
  assert.equal(capabilities.at(-1), 'asset-naming')
  assert.deepEqual(renamed.data.asset, { id: assetId, code: 'IMG-A2', label: 'Ref: shirt', type: 'image', created_at: undefined, note: 'The shirt front' })
  await call('update_asset', { projectId, assetId, note: 'The shirt front' }, renameCtx)
  assert.deepEqual(renamePosts[1].body, { assetId, note: 'The shirt front' })
  assert.equal(op('update_asset').input.safeParse({ projectId, assetId }).success, false, 'a rename must name something')
  assert.equal(op('update_asset').input.safeParse({ projectId, assetId, label: 'x', extra: 1 }).success, false)
  const requestId = '44444444-4444-4444-8444-444444444444'
  await call('generate_chatgpt_image', { projectId, requestId, prompt: 'Exact\nprompt', referenceAssetIds: ['IMG-A2', 'IMG-A1'], background: true }, ctx)
  assert.deepEqual(posts[2], { route: '/agent/generation/chatgpt-image', body: { projectId, requestId, prompt: 'Exact\nprompt', referenceAssetIds: [assetId, referenceId], background: true } })
  assert.equal(capabilities.at(-1), 'chatgpt-image-generation')
  assert.equal(op('generate_chatgpt_image').billable, undefined)
  assert.ok((await call('load_tools', { names: ['slates_generate_chatgpt_image'] })).data.tools.some(t => t.name === 'slates_generate_chatgpt_image'))
}
const refs = [
  { token: '@Maya', name: 'Maya', kind: 'character', media: [{ path: 'face.png', mediaKind: 'image' }] },
  { token: '#look', name: 'look', kind: 'style', media: [{ path: 'look.png', mediaKind: 'image' }] },
]
assert.equal(composeReferences('@Maya cooks, lit and graded like #look.', refs).prompt, 'Maya (image 1) cooks, lit and graded like image 2.')
for (const phrase of ['in the style of', 'with the style of', 'lit like', 'with only the colors of']) {
  assert.equal(composeReferences(`@Maya cooks ${phrase} #look.`, refs).prompt, `Maya (image 1) cooks ${phrase} image 2.`)
}
const literal = 'The woman from image 1 cooks, lit and graded like image 2.'
assert.equal(composeReferences(literal, refs).prompt, literal)
assert.equal(composeReferences('Combine images 1 and 2.', refs).prompt, 'Combine images 1 and 2.')
assert.match(composeReferences('image 12', refs).prompt, /Image 1 is Maya/)
assert.match(composeReferences('@Maya cooks.', refs).prompt, /Render in the visual style of image 2/)
assert.deepEqual(composeReferences(literal, refs).orderedImagePaths, ['face.png', 'look.png'])
assert.equal(cleanPrompt('Keep  spacing\n\n#fff @unresolved.'), 'Keep  spacing\n\n#fff @unresolved.')

const guide = await call('get_prompting_guide', { topic: 'cinematic' })
assert.equal(guide.text, guide.data.guide)
assert.ok(guide.data.bytes < 4000, `default cinematic guide is ${guide.data.bytes} bytes`)
assert.ok(!guide.text.includes('<!--'))
// These rules disappeared while IDs/tags/examples still passed catalogue parity.
// Exercise the default response agents read, not just the long source guide.
for (const rule of [
  /default to clean, evenly lit and fully exposed/,
  /Look at every reference first/,
  /grade and imperfections/,
  /Never grade cleaner, brighter or higher-contrast/,
  /One physical light system/,
  /Exposure as it looks/,
  /Lens name plus effect, every time/,
  /Name every garment and close the foreground/,
  /Only what the shot needs/,
]) assert.match(guide.text, rule)
const flat = await call('get_prompting_guide', { topic: 'cinematic', query: 'flat-underexposure' })
assert.match(flat.text, /flat-underexposure.*receipt/)
const one = await call('get_prompting_guide', { topic: 'cinematic', query: 'near-silhouette' })
assert.equal((one.text.match(/^\| `/gm) ?? []).length, 1)
assert.match(one.text, /near-silhouette.*receipt/)
const full = await call('get_prompting_guide', { topic: 'cinematic', depth: 'full' })
assert.ok(full.text.length > guide.text.length * 4)
assert.ok(!full.text.includes('<!--'))
const catalogue = SKILLS['slates-cinematic-look'].match(/\| `([a-z0-9-]+)` \|/g)
for (const row of catalogue) {
  const id = /`([^`]+)`/.exec(row)[1]
  const result = await call('get_prompting_guide', { topic: 'cinematic', query: id })
  assert.equal((result.text.match(/^\| `/gm) ?? []).length, 1, id)
}
for (const [id, c] of Object.entries(MODEL_CAPABILITIES)) {
  if (c.imageResolutions) assert.ok(c.imageResolutions.includes(c.defaultImageResolution), id)
}

// Exercise the actual estimate and generation operations with a mocked transport.
// No live credentials or provider calls. Verify the wire request, not source strings.
const model = defaultModelFor('image')
const posts = []
const registry = { models: ['high', 'max'].flatMap((q) => ['2k', '3k', '4k'].map((r) => ({ model: `${model}-${q}-${r}`, cost_credits: 2 }))) }
const ctx = {
  cloud: () => ({ get: async () => registry }),
  desktop: () => ({ requireCapability: async () => {}, post: async (path, body) => {
    posts.push({ path, body }); return { success: true, background: true, generationId: 'mock-generation' }
  } }),
}
const estimate = await call('estimate_generation_cost', { model, aspectRatio: '16:9' }, ctx)
assert.equal(estimate.data.cost_key, `${model}-high-3k`)
assert.match(estimate.data.craft_card, /Inspect every reference first/)
assert.match(estimate.data.craft_card, /Name every garment and close the foreground/)
await call('generate_image', { projectId: '11111111-1111-4111-8111-111111111111', prompt: literal, aspectRatio: '16:9', background: true }, ctx)
assert.deepEqual(posts[0].body, {
  projectId: '11111111-1111-4111-8111-111111111111', prompt: literal, model, resolution: '3k', aspectRatio: '16:9', count: 1,
  gptQuality: DEFAULT_GPT_QUALITY, gptBackground: undefined, background: true,
})
await call('generate_image', { projectId: '11111111-1111-4111-8111-111111111111', prompt: 'photorealistic cinematic room', aspectRatio: '16:9', resolution: '2k', background: true }, ctx)
assert.equal(posts[1].body.resolution, '2k')
const warning = await call('generate_image', { model: 'nano-banana-2-1', prompt: 'photorealistic cinematic' })
assert.match(warning.data.prompt_warning, /nano-banana/)
const allowed = await call('generate_image', { projectId: '11111111-1111-4111-8111-111111111111', prompt: 'photorealistic cinematic' })
assert.equal(allowed.data.prompt_warning, undefined)

const initial = toolDefinitions(ALL_OPERATIONS, { surface: 'desktop' })
assert.ok(!initial.some((t) => t.name === 'slates_generate_image'))
assert.ok(JSON.stringify(initial).length < 16000)
const loaded = await call('load_tools', { names: ['slates_generate_image'] })
assert.deepEqual(loaded.data.tools, toolDefinitions([op('generate_image')], { surface: 'mcp' }))
assert.equal(loaded.data.tools[0].annotations.readOnlyHint, false)
await assert.rejects(() => call('load_tools', { names: ['missing'] }), /Unknown operation/)
assert.match((await call('load_tools', { query: 'generate image' })).text, /slates_generate_image/)
console.log(`prompt-control: inline bindings, ${catalogue.length} selective techniques, defaults, scoped warnings, actual mock payload and discovery passed`)

// The skill's own advice is never a never-use token: Omni Flash says to always end an edit with this
// line, and FLUX's list writes the positive form beside each negative (2026-10-07 review, #5).
assert.equal(findBannedTokens('Keep everything else the same.', 'video', 'slates-prompting-omni-flash').length, 0)
assert.equal(findBannedTokens('a candle-like glow', 'video', 'slates-prompting-omni-flash').length, 1)
assert.equal(findBannedTokens('sharp focus throughout, empty scene, soft, diffused lighting', 'image', 'slates-prompting-flux-3').length, 0)
assert.equal(findBannedTokens('no blur, no people', 'image', 'slates-prompting-flux-3').length, 2)
for (const [id, capability] of Object.entries(MODEL_CAPABILITIES)) {
  if (!capability.imageResolutions) continue
  const result = await call('get_prompting_guide', {topic: id})
  assert.match(result.text, /For a photographic look/, `Missing shared cinematic card: ${id}`)
  for (const rule of [/default to clean, evenly lit and fully exposed/, /grade and imperfections/, /Lens name plus effect/, /Name every garment and close the foreground/]) {
    assert.match(result.text, rule, `Missing cinematic rule on ${id}`)
  }
}

const three = [...refs, {token: '@Peak', name: 'Peak', kind: 'environment', media: [{path: 'peak.png', mediaKind: 'image'}]}]
assert.equal(composeReferences('Combine images 1, 2, and 3.', three).prompt, 'Combine images 1, 2, and 3.')

const override = {model, aspectRatio: '16:9', resolution: '2k', quality: 'max'}
assert.equal((await call('estimate_generation_cost', override, ctx)).data.cost_key, `${model}-max-2k`)
await call('generate_image', {...override, projectId: '11111111-1111-4111-8111-111111111111', prompt: 'Room', background: true}, ctx)
assert.equal(posts.at(-1).body.gptQuality, 'max')
assert.equal(posts.at(-1).body.resolution, '2k')

// GPT Image 2.6 on a desktop that predates it (no image-models-v5, 1.6.8 and older): the 2.5 seat it
// replaced runs at the quoted price and the result says so; a desktop with no GPT Image at all (no v3) refuses.
{
  const projectId = '11111111-1111-4111-8111-111111111111', sourceAssetId = '66666666-6666-4666-8666-666666666666'
  const desktopWithout = (missing) => {
    const sent = []
    return { sent, ctx: { cloud: () => ({ get: async () => registry }), desktop: () => ({
      requireCapability: async (cap) => { if (missing.includes(cap)) throw new Error(`Update Slates: ${cap} required`) },
      post: async (path, body) => { sent.push({ path, body }); return { success: true, background: true, generationId: 'mock-generation' } },
    }) } }
  }
  assert.equal(model, 'gpt-image-2-6-sunburst', 'the default image seat is GPT Image 2.6 Sunburst')
  const older = desktopWithout(['image-models-v5'])
  const made = await call('generate_image', { projectId, prompt: 'Room', aspectRatio: '16:9', background: true }, older.ctx)
  assert.equal(older.sent[0].body.model, 'gpt-image-2-5-sunburst')
  assert.match(made.text, /gpt-image-2-5-sunburst ran in place of gpt-image-2-6-sunburst, at the same price/)
  assert.deepEqual([made.data.model, made.data.ranOn], ['gpt-image-2-6-sunburst', 'gpt-image-2-5-sunburst'])
  const edited = await call('edit_image', { projectId, sourceAssetId, prompt: 'Make the jacket red', editModel: 'gpt-image-2-6-flare', resolution: '2k', background: true }, older.ctx)
  assert.equal(older.sent[1].body.editModel, 'gpt-image-2-5-flare')
  assert.match(edited.text, /gpt-image-2-5-flare ran in place of gpt-image-2-6-flare/)
  const current = desktopWithout([])
  const fresh = await call('generate_image', { projectId, prompt: 'Room', aspectRatio: '16:9', background: true }, current.ctx)
  assert.equal(current.sent[0].body.model, 'gpt-image-2-6-sunburst')
  assert.doesNotMatch(fresh.text, /ran in place of/)
  const ancient = desktopWithout(['image-models-v5', 'image-models-v3'])
  await assert.rejects(() => call('generate_image', { projectId, prompt: 'Room', aspectRatio: '16:9', background: true }, ancient.ctx), /Update Slates: image-models-v3/)
  assert.deepEqual(ancient.sent, [], 'a desktop with no GPT Image refuses before any request')
  console.log('prompt-control: GPT Image 2.6 runs as 2.5 on a desktop without image-models-v5 and says so; without v3 it refuses')
}

// Every other op that hands the desktop a GPT Image id by name (a Shot's model, a draft's model) makes the same
// substitution: a 1.6.8 desktop's draftShot throws on a 2.6 id. Each says so in its result; a current desktop gets 2.6.
{
  const projectId = '11111111-1111-4111-8111-111111111111', shotId = '77777777-7777-4777-8777-777777777777'
  const shotDesktop = (missing) => {
    const sent = []
    const shot = { id: shotId, projectId, code: 'SHOT-A', name: 'A' }
    const quote = { fingerprint: 'fp', items: [{ shotId, name: 'A', code: 'SHOT-A', model: 'gpt-image-2-5-sunburst', prompt: 'Room', cost: 0.1, credits: 3, blocked: null }], total: 3, largest: 3, unpriced: 0 }
    return { sent, ctx: { cloud: () => ({ get: async () => registry }), desktop: () => ({
      requireCapability: async (cap) => { if (missing.includes(cap)) throw new Error(`Update Slates: ${cap} required`) },
      get: async (path, query) => {
        if (path === '/agent/shots/quote') { sent.push({ path, body: JSON.parse(query.input) }); return quote }
        if (path === '/agent/shots/get') return { shot }
        return { storyboards: [], shots: [], variety: null }
      },
      post: async (path, body) => { sent.push({ path, body }); return path === '/agent/shots/batch-generate' ? { started: 1 } : { shot } },
    }) } }
  }
  for (const [missing, sentModel] of [[['image-models-v5'], 'gpt-image-2-5-sunburst'], [[], 'gpt-image-2-6-sunburst']]) {
    const said = (text) => missing.length
      ? assert.match(text, /gpt-image-2-5-sunburst ran in place of gpt-image-2-6-sunburst, at the same price/)
      : assert.doesNotMatch(text, /ran in place of/)
    const d = shotDesktop(missing)
    said((await call('create_shot', { projectId, prompt: 'Room', model: 'gpt-image-2-6-sunburst' }, d.ctx)).text)
    assert.deepEqual([d.sent.at(-1).path, d.sent.at(-1).body.spec.model, d.sent.at(-1).body.spec.authoredFor], ['/agent/shots', sentModel, sentModel])
    said((await call('update_shot', { projectId, shotId, model: 'gpt-image-2-6-sunburst' }, d.ctx)).text)
    assert.deepEqual([d.sent.at(-1).path, d.sent.at(-1).body.data.spec.model], ['/agent/shots/update', sentModel])
    said((await call('duplicate_shot', { shotId, model: 'gpt-image-2-6-sunburst' }, d.ctx)).text)
    assert.deepEqual([d.sent.at(-1).path, d.sent.at(-1).body.spec.model], ['/agent/shots/duplicate', sentModel])
    said((await call('get_board_quote', { projectId, shotIds: [shotId], draft: { model: 'gpt-image-2-6-sunburst' } }, d.ctx)).text)
    assert.equal(d.sent.at(-1).body.draft.model, sentModel)
    said((await call('generate_from_shots', { shotIds: [shotId], draft: { model: 'gpt-image-2-6-sunburst' } }, d.ctx)).text)
    assert.equal(d.sent.at(-1).body.draft.model, sentModel)
    said((await call('generate_from_shots', { shotIds: [shotId], draft: { model: 'gpt-image-2-6-sunburst' }, confirm: true, fingerprint: 'fp' }, d.ctx)).text)
    assert.deepEqual([d.sent.at(-1).path, d.sent.at(-1).body.draft.model], ['/agent/shots/batch-generate', sentModel])
  }
  // Another model passes untouched and asks for no GPT Image token.
  const d = shotDesktop(['image-models-v5', 'image-models-v3'])
  await call('create_shot', { projectId, prompt: 'Room', model: 'nano-banana-2-1' }, d.ctx)
  assert.equal(d.sent.at(-1).body.spec.model, 'nano-banana-2-1')
  await call('get_board_quote', { projectId, shotIds: [shotId], draft: {} }, d.ctx)
  assert.deepEqual(d.sent.at(-1).body.draft, {})
  await assert.rejects(() => call('create_shot', { projectId, prompt: 'Room', model: 'gpt-image-2-6-flare' }, d.ctx), /Update Slates: image-models-v3/)
  console.log('prompt-control: Shots and drafts name GPT Image 2.6 as 2.5 to a desktop without image-models-v5 and say so')
}

// Gemini Omni Flash 1.2 on a desktop that predates it (no video-models-v2, 1.6.8 and older): the 1.1 seat it
// replaced runs at the quoted price when the request fits 1.1 (10s or less) and the result says so, on every op
// that hands the desktop a model id; a longer clip, or a desktop before 1.1 (no image-models-v4), refuses before
// any request. Google's request-shaped reference limits refuse before any request on every desktop.
{
  const projectId = '11111111-1111-4111-8111-111111111111', shotId = '77777777-7777-4777-8777-777777777777'
  const sourceId = '88888888-8888-4888-8888-888888888888', frameA = '99999999-9999-4999-8999-999999999991', frameB = '99999999-9999-4999-8999-999999999992'
  const clips = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3']
  const pics = Array.from({ length: 7 }, (_, i) => `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${i}`)
  const keys = [3, 8, 10, 12, 15].flatMap((n) => [`omni-flash-1-2-720p-${n}s`, `omni-flash-1-2-edit-720p-${n}s`])
  const omniRegistry = { models: keys.map((model) => ({ model, cost_credits: 5 * Number(/-(\d+)s$/.exec(model)[1]) })) }
  const omniDesktop = (missing, clipSeconds = 8) => {
    const sent = []
    const shot = { id: shotId, projectId, code: 'SHOT-A', name: 'A' }
    return { sent, ctx: { cloud: () => ({ get: async () => omniRegistry }), desktop: () => ({
      requireCapability: async (cap) => { if (missing.includes(cap)) throw new Error(`Update Slates: ${cap} required`) },
      get: async (path) => {
        if (path === '/agent/assets') return { assets: [{ id: sourceId, type: 'video', duration: clipSeconds }] }
        if (path === '/agent/shots/get') return { shot }
        return { storyboards: [], shots: [], variety: null }
      },
      post: async (path, body) => {
        sent.push({ path, body })
        if (path === '/agent/composer') return { report: null, reason: 'mock' }
        return path.startsWith('/agent/generation') ? { success: true, background: true, generationId: 'mock-generation' } : { shot }
      },
    }) } }
  }
  const gen = (extra) => ({ projectId, model: 'omni-flash-1-2', prompt: 'A lighthouse at dusk, one continuous shot.', aspectRatio: '16:9', duration: 8, confirm: true, background: true, ...extra })
  const edit = { projectId, sourceVideoAssetId: sourceId, model: 'omni-flash-1-2-edit', prompt: 'Make it snow. Keep everything else the same.', confirm: true, background: true }
  for (const [missing, genSeat, editSeat] of [[['video-models-v2'], 'omni-flash', 'omni-flash-edit'], [[], 'omni-flash-1-2', 'omni-flash-1-2-edit']]) {
    const said = (text, seat, asked) => missing.length
      ? assert.match(text, new RegExp(`${seat} ran in place of ${asked}, at the same price: this Slates desktop predates Gemini Omni Flash 1\\.2`))
      : assert.doesNotMatch(text, /ran in place of/)
    const d = omniDesktop(missing)
    const made = await call('generate_video', gen(), d.ctx)
    assert.deepEqual([d.sent.at(-1).path, d.sent.at(-1).body.model], ['/agent/generation/video', genSeat])
    assert.equal(made.data.variant, 'omni-flash-1-2-720p-8s', 'the quote is the 1.2 key whichever seat runs')
    said(made.text, genSeat, 'omni-flash-1-2')
    const edited = await call('edit_video', edit, d.ctx)
    assert.deepEqual([d.sent.at(-1).path, d.sent.at(-1).body.model], ['/agent/generation/edit-video', editSeat])
    assert.equal(edited.data.variant, 'omni-flash-1-2-edit-720p-8s')
    said(edited.text, editSeat, 'omni-flash-1-2-edit')
    said((await call('create_shot', { projectId, prompt: 'Room', model: 'omni-flash-1-2', params: { duration: 8 } }, d.ctx)).text, genSeat, 'omni-flash-1-2')
    assert.deepEqual([d.sent.at(-1).path, d.sent.at(-1).body.spec.model], ['/agent/shots', genSeat])
    said((await call('update_shot', { projectId, shotId, model: 'omni-flash-1-2' }, d.ctx)).text, genSeat, 'omni-flash-1-2')
    assert.deepEqual([d.sent.at(-1).path, d.sent.at(-1).body.data.spec.model], ['/agent/shots/update', genSeat])
    said((await call('duplicate_shot', { shotId, model: 'omni-flash-1-2' }, d.ctx)).text, genSeat, 'omni-flash-1-2')
    assert.deepEqual([d.sent.at(-1).path, d.sent.at(-1).body.spec.model], ['/agent/shots/duplicate', genSeat])
    await call('set_composer', { model: 'omni-flash-1-2' }, d.ctx)
    assert.deepEqual([d.sent.at(-1).path, d.sent.at(-1).body.model], ['/agent/composer', genSeat])
  }
  // Past 1.1's 10 seconds a desktop without 1.2 refuses before any request, generation, edit and Shot alike.
  const longer = omniDesktop(['video-models-v2'], 12)
  await assert.rejects(() => call('generate_video', gen({ duration: 12 }), longer.ctx), /runs Gemini Omni Flash 1\.1, which stops at 10s/)
  await assert.rejects(() => call('edit_video', edit, longer.ctx), /stops at 10s/)
  await assert.rejects(() => call('create_shot', { projectId, prompt: 'Room', model: 'omni-flash-1-2', params: { duration: 12 } }, longer.ctx), /stops at 10s/)
  assert.deepEqual(longer.sent, [], 'nothing reaches the desktop')
  // A desktop current with 1.2 runs 12s.
  const current = omniDesktop([], 12)
  await call('generate_video', gen({ duration: 12 }), current.ctx)
  assert.equal(current.sent.at(-1).body.duration, 12)
  // A desktop before 1.1 would bill 1.0's keys: it refuses.
  const ancient = omniDesktop(['video-models-v2', 'image-models-v4'])
  await assert.rejects(() => call('generate_video', gen(), ancient.ctx), /Update Slates: image-models-v4/)
  assert.deepEqual(ancient.sent, [])
  // Google's request-shaped limits, refused before any request on a current desktop.
  const shape = async (extra) => {
    const d = omniDesktop([])
    const r = await call('generate_video', gen(extra), d.ctx)
    return { message: r.data?.requires_clarification ? r.data.message : null, sent: d.sent.length }
  }
  const frames = await shape({ duration: 12, firstFrameAssetId: frameA, lastFrameAssetId: frameB })
  assert.match(frames.message, /takes 3-10s with a last frame, and 12s is longer/)
  assert.equal(frames.sent, 0)
  assert.equal((await shape({ duration: 10, firstFrameAssetId: frameA, lastFrameAssetId: frameB })).message, null)
  const longRefs = await shape({ duration: 12, videoReferenceAssetIds: clips.slice(0, 2), videoReferenceSecondsEach: [2, 2] })
  assert.match(longRefs.message, /takes 1 reference video on a clip over 10s \(up to 3 at 10s or less\), and this has 2/)
  assert.equal((await shape({ duration: 12, videoReferenceAssetIds: clips.slice(0, 1), videoReferenceSecondsEach: [3] })).message, null)
  assert.equal((await shape({ duration: 10, videoReferenceAssetIds: clips, videoReferenceSecondsEach: [2, 3, 2.5] })).message, null)
  assert.match((await shape({ duration: 8, videoReferenceAssetIds: clips.slice(0, 1), videoReferenceSecondsEach: [4] })).message, /must be 1-3s long\. Trim it first with slates_trim_video/)
  assert.match((await shape({ duration: 8, ingredientAssetIds: pics })).message, /at most 6 reference images combined/)
  assert.equal((await shape({ duration: 8, ingredientAssetIds: pics.slice(0, 6) })).message, null)
  assert.match((await shape({ duration: 8, firstFrameAssetId: frameA, ingredientAssetIds: pics.slice(0, 6) })).message, /a start frame included \(you passed 7\)/)
  console.log('prompt-control: Omni Flash 1.2 runs as 1.1 on a desktop without video-models-v2 up to 10s and says so; Google\'s reference limits refuse before any request')
}

// The plain text style came with text-fonts: alone it still asks for the token, so a desktop without it
// refuses in words before any request, on add, update and captions; another style asks for nothing new.
{
  const projectId = '11111111-1111-4111-8111-111111111111', timelineId = '22222222-2222-4222-8222-222222222222'
  const clipId = '33333333-3333-4333-8333-333333333333'
  const fake = (refuse) => {
    const seen = { gates: [], posts: [] }
    const ctx = { desktop: () => ({
      requireCapability: async (cap) => { seen.gates.push(cap); if (cap === refuse) throw new Error(`Update Slates: ${cap} required`) },
      get: async () => ({}),
      post: async (path) => { seen.posts.push(path); throw new Error(`posted ${path}`) },
    }) }
    return { seen, ctx }
  }
  const cases = [
    ['add_text_clip', (style) => ({ projectId, items: [{ text: 'Hi', startSec: 0, style }] })],
    ['update_overlay_clip', (style) => ({ projectId, items: [{ clipId, style }] })],
    ['add_captions', (style) => ({ projectId, timelineId, style })],
  ]
  for (const [id, input] of cases) {
    const older = fake('text-fonts')
    await assert.rejects(() => call(id, input('plain'), older.ctx), /Update Slates: text-fonts/, `${id}: plain alone asks for text-fonts`)
    assert.deepEqual(older.seen.posts, [], `${id}: the refusal comes before any request`)
    const other = fake('text-fonts')
    await assert.rejects(() => call(id, input('subtitle'), other.ctx), /posted/, `${id}: another style reaches the desktop`)
    assert.ok(!other.seen.gates.includes('text-fonts'), `${id}: another style asks for nothing new`)
  }
  console.log(`prompt-control: the plain style asks for text-fonts before any request on ${cases.map(([id]) => id).join(', ')} passed`)
}

// slates_set_selection names each row so an agent can act on it: a Media or Board row without a code keeps
// its id (its label alone would lose it), a timeline row its label and then its id; and the description
// says what the desktop refuses (no project open; all, or replace with no ids, with no timeline open).
{
  const projectId = '11111111-1111-4111-8111-111111111111', assetId = '44444444-4444-4444-8444-444444444444'
  const clipId = '55555555-5555-4555-8555-555555555555'
  const answering = (selection) => ({ desktop: () => ({ requireCapability: async () => {}, post: async () => ({ selection, notes: [] }) }) })
  const media = await call('set_selection', { surface: 'media', mode: 'replace', ids: [assetId] },
    answering({ surface: 'media', projectId, ids: [assetId], items: [{ id: assetId, code: null, label: 'Shirt' }, { id: 'a2', code: 'IMG-A2', label: 'Hat' }] }))
  assert.equal(media.text, `2 selected on Media: ${assetId}, IMG-A2 — Hat.`)
  const timeline = await call('set_selection', { surface: 'timeline', mode: 'replace', ids: [clipId] },
    answering({ surface: 'timeline', projectId, ids: [clipId], items: [{ id: clipId, code: null, label: 'Opening', track: 'V1', start: { frame: 0, timecode: '00:00:00:00' } }] }))
  assert.equal(timeline.text, `1 selected on the timeline: Opening (V1, 00:00:00:00, ${clipId}).`)
  const description = op('set_selection').description
  assert.ok(description.length <= 2048, `slates_set_selection: description ${description.length} > 2048`)
  assert.doesNotMatch(description, /needs nothing open/)
  assert.match(description, /Every surface needs a project open/)
  assert.match(description, /all, or replace with no ids, needs a timeline open/)
  console.log('prompt-control: selection rows keep their ids, and the selection description names what needs a project or timeline open, passed')
}
