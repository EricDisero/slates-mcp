// The guide gate (operations/index.ts `requireGuideRead`): a session that keeps a
// ledger cannot generate on a model until it has fetched that model's guide.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateVideo, generateImage, generateCharacterIdentity, generateEnvironmentPlate, extractGridCells, generateChatGptImage, getPromptingGuide, GuideNotReadError, resolveGuideTopic } from '../packages/shared/dist/operations/index.js'
import { toolModelFor } from '../packages/shared/dist/prompts/model-facts.js'
import { refreshServedBrain, useBrainSource } from '../packages/shared/dist/skills/served.js'
import { brainOrSkip } from './brain-source.mjs'

const emptyHome = process.argv[2] === '--empty-home'
// The guides are the brain's (slates-api brain/), held as a member's server holds them, here and in any server this
// spawns. The empty-home run has none: it starts as a machine nothing has brought the brain to.
const brain = emptyHome ? null : brainOrSkip('guide-gate')
if (brain) {
  process.env.SLATES_BRAIN_DIR = brain
  useBrainSource(brain)
}

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

if (emptyHome) {
  // No cloud login here, as on an MCP server the desktop connected: the brain comes only from the cache.
  const noLogin = () => ({ get: async () => { throw Object.assign(new Error('No Slates cloud token found.'), { code: 'CLOUD_TOKEN_MISSING' }) } })
  const fresh = () => ({ desktop: () => desktop, cloud: noLogin, guidesRead: new Set() })
  const kling = 'kling-v3-pro'
  const klingGuide = resolveGuideTopic(kling)

  // Unreachable: nothing cached. By exact name or alias, the answer says how to get the brain, never the catalog,
  // and does not count as read; the gate's refusal says the same, so the agent is never sent round in a loop.
  for (const topic of [klingGuide, kling]) {
    const s = fresh()
    const answer = await getPromptingGuide.run({ topic }, s)
    assert.ok(answer.data.unavailable, `${topic}: answered as a guide not on this machine, not with the catalog`)
    assert.match(answer.text, /slates login/, `${topic}: the answer says how to get the brain`)
    assert.equal(s.guidesRead.size, 0, `${topic}: a guide that never arrived is not read`)
    await assert.rejects(generateVideo.run({ ...video, model: kling }, s), (err) =>
      err instanceof GuideNotReadError && /not on this machine/.test(err.message) && /slates login/.test(err.message))
  }

  // Locked: the cache (written by the desktop app, no login here) holds the guide locked, its notice carrying the card.
  const notice = 'LOCKED NOTICE. Its craft card, to write the prompt to: name the lens.'
  mkdirSync(join(homedir(), '.slates'), { recursive: true })
  writeFileSync(join(homedir(), '.slates', 'brain-cache.json'), JSON.stringify({
    version: 'test.0', tiers: [], account: 'u1', files: {}, locked: [{ name: seedanceGuide, tier: 'license', description: 'Seedance', notice }],
  }))
  useBrainSource()
  for (const topic of [seedanceGuide, 'seedance-2.5']) {
    const s = fresh()
    await assert.rejects(generateVideo.run({ ...video }, s), (err) => err instanceof GuideNotReadError && err.message.includes(`topic "${seedanceGuide}"`))
    const answer = await getPromptingGuide.run({ topic }, s)
    assert.equal(answer.text, notice, `${topic}: a locked guide answers with its notice, card and all`)
    assert.ok(answer.data.locked && s.guidesRead.has(seedanceGuide), `${topic}: a locked guide counts as read`)
    await notGated(generateVideo.run({ ...video }, s))
  }

  // Another login's cache waits until the server names the same account, and a 401 clears the brain and the cache.
  const cacheFile = join(homedir(), '.slates', 'brain-cache.json')
  const cached = JSON.parse(readFileSync(cacheFile, 'utf8'))
  writeFileSync(join(homedir(), '.slates', 'agent-connection.json'), JSON.stringify({ cloud: { token: 'slates_sk_test' }, desktop: { enabled: false } }))
  writeFileSync(cacheFile, JSON.stringify({ ...cached, token: 'another-login' }))
  assert.equal(useBrainSource().locked.length, 0, 'a cache another login received is not served at start')
  const answers = (index, bundle) => () => ({ get: async (path) => (path === '/brain' ? index : bundle) })
  const same = await refreshServedBrain(answers({ version: 'test.0', tiers: [], account: 'u1' }, null), { force: true })
  assert.equal(same.locked.length, 1, 'the server naming the same account adopts it without a new download')
  useBrainSource()
  const other = await refreshServedBrain(answers({ version: 'test.0', tiers: [], account: 'u2' }, { version: 'test.0', tiers: [], account: 'u2', files: {}, locked: [] }), { force: true })
  assert.ok(other.account === 'u2' && other.locked.length === 0, 'another account downloads its own brain')
  if (process.platform !== 'win32') assert.equal(statSync(cacheFile).mode & 0o777, 0o600, 'the cache is owner-only')
  const revoked = () => ({ get: async () => { throw Object.assign(new Error('Unauthorized'), { status: 401 }) } })
  const cleared = await refreshServedBrain(revoked, { force: true })
  assert.ok(cleared.source === 'none' && !existsSync(cacheFile), 'a 401 clears the served brain and its cache')
  process.exit(0)
}

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

// 6. The exact name a refusal gives is a guide, not an unknown topic.
const klingGuide = resolveGuideTopic('kling-v3-pro')
const byName = session()
await getPromptingGuide.run({ topic: klingGuide }, byName)
assert.ok(byName.guidesRead.has(klingGuide), `${klingGuide} by its exact name is read`)

// 7. A machine with no brain or with a locked guide, in an empty home folder (below, in a child process).
const home = mkdtempSync(join(tmpdir(), 'slates-guide-gate-home-'))
const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--empty-home'], {
  env: { ...process.env, HOME: home, USERPROFILE: home, SLATES_BRAIN_DIR: '' },
  stdio: 'inherit',
})
rmSync(home, { recursive: true, force: true })
assert.equal(child.status, 0, 'the empty-home cases pass')

console.log('guide-gate: refused with the card before any spend; the guide fetch opens it per model; a new model is refused again; the tool seats and ChatGPT images gate the same way; no ledger, no gate; an exact guide name is read; with no brain or a locked guide on the machine, the gate holds and says what opens it')
