import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SKILLS, ALL_OPERATIONS } from '../packages/shared/dist/index.js'
import { getPromptingGuide, resolveGuideTopic } from '../packages/shared/dist/operations/index.js'
import { SlatesCloudHttpError } from '../packages/shared/dist/clients/cloud.js'

const disconnected = { cloud: () => { throw Object.assign(new Error('no token'), { code: 'CLOUD_TOKEN_MISSING' }) }, desktop: () => { throw new Error('unexpected desktop call') } }
const run = async (input, ctx = disconnected) => getPromptingGuide.run(getPromptingGuide.input.parse(input), ctx)
const names = result => result.data.guides.map(guide => guide.name)

// The catalog is computed from every source skill, not a hand-maintained subset.
const found = new Set()
let offset = 0
for (;;) {
  const result = await run({ offset })
  assert(result.text.length < 12000, 'the whole catalog stays bounded')
  for (const name of names(result)) { assert(!found.has(name)); found.add(name) }
  if (result.data.nextOffset === null) break
  offset = result.data.nextOffset
}
assert.deepEqual([...found].sort(), Object.keys(SKILLS).sort())
for (const name of found) assert.equal(SKILLS[name] === readFileSync(new URL(`../packages/shared/skills/${name}.md`, import.meta.url), 'utf8'), true, `${name}: embedded body differs from source`)

for (const [query, expected] of [
  ['a UGC skincare ad with a creator speaking to camera', 'slates-ugc-influencer-ad'],
  ['animate these photos', 'slates-model-selection'],
  ['same character identity and consistent face across scenes', 'slates-character-identity'],
  ['camera dolly tracking orbit shot movement', 'slates-camera-language'],
  ['two people conversation seating eyelines 180 rule', 'slates-dialogue-blocking'],
  ['screenplay script story dialogue scenes', 'slates-script-craft'],
  ['cinematic lighting lens color grade for a perfume ad', 'slates-cinematic-look'],
]) {
  const result = await run({ query })
  assert(names(result).includes(expected), `${query}: expected ${expected}, got ${names(result)}`)
  assert(result.data.guides.length <= 8)
}
const unfamiliar = await run({ query: 'quux flibbertigibbet' })
assert(unfamiliar.data.fallback && unfamiliar.data.guides.length === Object.keys(SKILLS).length, 'an unmatched brief returns the whole catalog')
// A matched brief still carries every other guide, so the model chooses by meaning, not shared words.
const diner = await run({ query: 'Make a 30 second movie with two friends at a rainy diner' })
assert.equal(diner.data.guides.length + diner.data.rest.length, Object.keys(SKILLS).length)
assert(!names(diner).includes('slates-prompting-seedance-2-5'), 'a clip duration is not a guide match')
assert(!unfamiliar.text.includes('ask the user'))
assert.equal(resolveGuideTopic('constructor'), null)
assert.equal(resolveGuideTopic('seedance-2.5'), 'slates-prompting-seedance-2-5')
assert.equal(resolveGuideTopic('video-edit'), 'slates-prompting-omni-flash')
assert(!('guides' in (await run({ topic: 'camera', query: 'dolly' })).data))
assert((await run({ topic: 'app-manual', query: 'export mp4' })).text.length > 0)

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
console.log(`Guide discovery: ${found.size} source-matched guides, natural briefs, pagination, aliases, sections, manual and private access passed.`)
