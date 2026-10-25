import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SKILLS, ALL_OPERATIONS } from '../packages/shared/dist/index.js'
import { getPromptingGuide, resolveGuideTopic } from '../packages/shared/dist/operations/index.js'
import { SlatesCloudHttpError } from '../packages/shared/dist/clients/cloud.js'
import { HYPERFRAMES_FILES, HYPERFRAMES_SKILL_NAMES } from '../packages/shared/dist/skills/hyperframes-content.js'
import { publicGuideName, whiteLabel } from '../packages/shared/dist/skills/hyperframes.js'

const disconnected = { cloud: () => { throw Object.assign(new Error('no token'), { code: 'CLOUD_TOKEN_MISSING' }) }, desktop: () => { throw new Error('unexpected desktop call') } }
const run = async (input, ctx = disconnected) => getPromptingGuide.run(getPromptingGuide.input.parse(input), ctx)
const names = result => result.data.guides.map(guide => guide.name)
// The motion engine's guides are served under public names (`motion-core`), white-labelled (engine-test item 8).
const PUBLIC = HYPERFRAMES_SKILL_NAMES.map(publicGuideName)
const upstreamOf = Object.fromEntries(HYPERFRAMES_SKILL_NAMES.map(name => [publicGuideName(name), name]))
const hf = name => PUBLIC.includes(name)
const everyGuide = Object.keys(SKILLS).length + HYPERFRAMES_SKILL_NAMES.length

// The catalog is computed from every source skill, not a hand-maintained subset: Slates' own and
// HyperFrames' copied folders (skills/hyperframes/, its NOTICE).
const found = new Set()
let offset = 0
for (;;) {
  const result = await run({ offset })
  // 12,000 until the 21 HyperFrames guides joined it (12,452 on 2026-10-18); their catalog line is
  // the first sentence of the upstream description, capped at 160 characters.
  assert(result.text.length < 14000, `the whole catalog stays bounded (${result.text.length})`)
  for (const name of names(result)) { assert(!found.has(name)); found.add(name) }
  if (result.data.nextOffset === null) break
  offset = result.data.nextOffset
}
assert.deepEqual([...found].sort(), [...Object.keys(SKILLS), ...PUBLIC].sort())
for (const name of found) {
  const source = hf(name) ? `../packages/shared/skills/hyperframes/${upstreamOf[name]}/SKILL.md` : `../packages/shared/skills/${name}.md`
  const body = hf(name) ? HYPERFRAMES_FILES[upstreamOf[name]] : SKILLS[name]
  assert.equal(body === readFileSync(new URL(source, import.meta.url), 'utf8'), true, `${name}: embedded body differs from source`)
}
for (const name of HYPERFRAMES_SKILL_NAMES) assert(!Object.hasOwn(SKILLS, name), `${name}: a HyperFrames guide must not enter SKILLS (prompts, install-skills)`)

for (const [query, expected] of [
  ['a UGC skincare ad with a creator speaking to camera', 'slates-ugc-influencer-ad'],
  ['animate these photos', 'slates-model-selection'],
  ['same character identity and consistent face across scenes', 'slates-character-identity'],
  ['camera dolly tracking orbit shot movement', 'slates-camera-language'],
  ['two people conversation seating eyelines 180 rule', 'slates-dialogue-blocking'],
  ['screenplay script story dialogue scenes', 'slates-script-craft'],
  ['cinematic lighting lens color grade for a perfume ad', 'slates-cinematic-look'],
  ['transcribe the founder video and caption it with word highlights', 'slates-captions'],
  ['a lower third and an end card as motion layers on the cut', 'slates-motion'],
  ['remake this winning ad with my product', 'slates-storyboard-from-script'],
]) {
  const result = await run({ query })
  assert(names(result).includes(expected), `${query}: expected ${expected}, got ${names(result)}`)
  assert(result.data.guides.length <= 8)
}
const unfamiliar = await run({ query: 'quux flibbertigibbet' })
assert(unfamiliar.data.fallback && unfamiliar.data.guides.length === everyGuide, 'an unmatched brief returns the whole catalog')
// A matched brief still carries every other guide, so the model chooses by meaning, not shared words.
const diner = await run({ query: 'Make a 30 second movie with two friends at a rainy diner' })
assert.equal(diner.data.guides.length + diner.data.rest.length, everyGuide)
assert(!names(diner).includes('slates-prompting-seedance-2-5'), 'a clip duration is not a guide match')
assert(!unfamiliar.text.includes('ask the user'))
assert.equal(resolveGuideTopic('constructor'), null)
assert.equal(resolveGuideTopic('seedance-2.5'), 'slates-prompting-seedance-2-5')
assert.equal(resolveGuideTopic('video-edit'), 'slates-prompting-omni-flash')
assert.equal(resolveGuideTopic('subtitles'), 'slates-captions')
assert.equal(resolveGuideTopic('lower third'), 'slates-motion')
assert.equal(resolveGuideTopic('remake'), 'slates-storyboard-from-script')
assert(!('guides' in (await run({ topic: 'camera', query: 'dolly' })).data))
assert((await run({ topic: 'app-manual', query: 'export mp4' })).text.length > 0)

// HyperFrames guides carry the craft for layers; for an ad, every Slates match ranks above every one of them.
for (const query of ['a UGC skincare ad with captions and a lower third', 'a 30 second ad for my app with an end card and captions', 'commercial for a sneaker campaign with kinetic type', 'Facebook ads for my skincare app with captions']) {
  const ranked = names(await run({ query }))
  const firstHf = ranked.findIndex(hf)
  assert(ranked.some(name => !hf(name)), `${query}: no Slates guide matched (${ranked})`)
  assert(firstHf === -1 || ranked.slice(firstHf).every(hf), `${query}: a HyperFrames guide outranks a Slates guide (${ranked})`)
}
assert(names(await run({ query: 'animated lower third GSAP composition for a talking head' })).some(hf), 'a layer brief reaches HyperFrames craft')
// A paged browse lists Slates' guides first, as the unpaged one does.
assert(!names(await run({ limit: 8 })).some(hf), `a browse's first page is Slates' guides (${names(await run({ limit: 8 }))})`)
// A topic retrieves a HyperFrames skill, any of its markdown files or the mapping; an exact name beats an alias.
// The upstream names are still accepted, and answer under the public one.
for (const [topic, key] of [['motion-core', 'motion-core'], ['hyperframes-core', 'motion-core'], ['motion/motion-animation', 'motion-animation'], ['hyperframes/hyperframes-animation', 'motion-animation'], ['MOTION-REGISTRY', 'motion-registry'], ['motion-audio', 'motion-audio'], ['motion-overview', 'motion-overview'], ['motion-animation/transitions/overview.md', 'motion-animation/transitions/overview.md'], ['motion/SLATES-MAPPING.md', 'SLATES-MAPPING.md'], ['hyperframes-mapping', 'SLATES-MAPPING.md']]) {
  const result = await run({ topic }, { ...disconnected, cloud: () => { throw new Error('a HyperFrames guide must not reach the cloud') } })
  assert.equal(result.data.topic, key, topic)
  assert.equal(result.data.source, 'motion')
  assert(!/\bHyper[Ff]rames\b/.test(result.text), `${topic}: the vendor's name is served`)
  assert(result.text.length > 0 && result.text.length < 9000, `${topic}: card is bounded (${result.text.length})`)
  if (key !== 'SLATES-MAPPING.md') assert(result.text.startsWith(`Motion guide ${key} (Apache-2.0)`), `${topic}: licence header`)
}
const fullCore = await run({ topic: 'motion-core', depth: 'full' })
assert(fullCore.text.endsWith(whiteLabel(HYPERFRAMES_FILES['hyperframes-core']).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim().split(/\r?\n/).at(-1).trim()), 'full depth serves the whole upstream file')
assert.equal(resolveGuideTopic('audio'), 'slates-prompting-seed-audio')
assert.equal((await run({ topic: 'audio' })).data.topic, 'slates-prompting-seed-audio', 'a Slates alias is not captured by a HyperFrames name')

// Private metadata/body only arrive over the authorized cloud client, with no URLs or keys exposed.
const privateName = 'slates-fixture-ad'
const privateDescription = 'Proven perfume advertising workflow for a product campaign.'
const privateBody = `<!-- licensed member private-watermark -->\n---\nname: ${privateName}\ndescription: ${privateDescription}\n---\n# Private playbook\nFixture-only craft.\n## Hook\nLead with the product.`
const calls = []
const member = { ...disconnected, cloud: () => ({ get: async path => {
  calls.push(path)
  if (path === '/members/manifest.json') return { skills: [{ name: privateName, description: privateDescription, tier: 'paid', url: 'https://untrusted.example/?key=never-return-me' }] }
  assert.equal(path, `/members/skills/${privateName}.md?format=json`)
  return { markdown: privateBody }
} }) }
const privateSearch = await run({ query: 'perfume advertising campaign' }, member)
assert(names(privateSearch).includes(privateName))
assert(!JSON.stringify(privateSearch).includes('never-return-me'))
const privateGuide = await run({ topic: privateName, depth: 'full' }, member)
assert.equal(privateGuide.data.tier, 'paid')
assert(privateGuide.text.includes('Lead with the product.'))
assert(!privateGuide.text.includes('private-watermark') && !privateGuide.text.includes('description:'))
for (const status of [401, 402, 404, 503]) {
  const denied = { ...disconnected, cloud: () => ({ get: async () => { throw new SlatesCloudHttpError('sensitive upstream response', status) } }) }
  const result = await run({ query: 'perfume advertising campaign' }, denied)
  assert(!names(result).includes(privateName))
  assert(!JSON.stringify(result).includes('sensitive upstream'))
  assert.notEqual(result.data.memberAccess, 'available')
}
// Entitlement can be revoked after discovery. A failed leaf returns no private content.
const revoked = { ...disconnected, cloud: () => ({ get: async path => {
  if (path === '/members/manifest.json') return { skills: [{ name: privateName, description: privateDescription, tier: 'paid' }] }
  throw new SlatesCloudHttpError('no active skills entitlement', 402)
} }) }
await assert.rejects(run({ topic: privateName, depth: 'full' }, revoked), error => error instanceof SlatesCloudHttpError && error.status === 402)
await assert.rejects(run({ topic: privateName, depth: 'full' }, revoked), error => !error.message.includes('no active skills entitlement') && error.message.includes(privateName))
// A malformed manifest entry is skipped without hiding valid playbooks.
const mixed = { ...disconnected, cloud: () => ({ get: async () => ({ skills: [{ name: '../escape', description: 'x', tier: 'paid' }, { name: privateName, description: privateDescription, tier: 'paid' }] }) }) }
assert(names(await run({ query: 'perfume advertising campaign' }, mixed)).includes(privateName))
// The member check is cached per connection and bounded, so discovery never waits on it twice.
let manifestReads = 0
const counted = { ...disconnected, cloud: () => ({ get: async () => { manifestReads++; throw new SlatesCloudHttpError('no entitlement', 402) } }) }
await run({ query: 'rainy diner' }, counted); await run({ query: 'skincare ad' }, counted)
assert.equal(manifestReads, 1)
// A resolved free guide never reaches the network.
const offline = { ...disconnected, cloud: () => { throw new Error('a free guide must not reach the cloud') } }
assert((await run({ topic: 'seedance-2.5' }, offline)).text.length > 0)
assert(!Object.hasOwn(SKILLS, privateName))
assert(ALL_OPERATIONS.some(op => op.id === getPromptingGuide.id))
console.log(`Guide discovery: ${found.size} source-matched guides (${HYPERFRAMES_SKILL_NAMES.length} HyperFrames), natural briefs, ad ranking, pagination, aliases, sections, manual and private access passed.`)
