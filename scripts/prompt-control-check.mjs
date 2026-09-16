import assert from 'node:assert/strict'
import { findBannedTokens } from '../packages/shared/dist/prompts/banned-tokens.js'
import { composeReferences, cleanPrompt } from '../packages/shared/dist/prompts/reference-composer.js'
import { MODEL_CAPABILITIES, DEFAULT_GPT_QUALITY } from '../packages/shared/dist/prompts/model-capabilities.js'
import { defaultModelFor } from '../packages/shared/dist/prompts/model-facts.js'
import { ALL_OPERATIONS, SKILLS, toolDefinitions } from '../packages/shared/dist/index.js'

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
  await call('upload_reference_image', { projectId, filePath: 'ordinary.png' }, ctx)
  assert.deepEqual(posts[1], { route: '/agent/assets/upload', body: { projectId, filePath: 'ordinary.png', type: 'image' } })
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
const warning = await call('generate_image', { model: 'nano-banana-2', prompt: 'photorealistic cinematic' })
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

assert.ok(findBannedTokens('Keep everything else the same.', 'video', 'slates-prompting-omni-flash').length > 0)
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
