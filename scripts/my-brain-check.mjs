#!/usr/bin/env node
// My brain, the user's local layer, is read as a second root beside the bundled skills
// (packages/shared/src/skills/my-brain.ts; second-brain plans/2026-10-25-slates-brain.md § My brain):
// a local file named like a bundled skill is served over it (their file first, then the shared guide),
// a new name is added and found by search, the router is never replaced, a file the shape refuses is
// skipped with its reason (the same checks brain-lint.mjs --mine runs), the router's answer and the
// my-brain topic carry the preload, the estimate and the guide gate carry the user's own card, every
// way a file is served dates it, and a file unused for 60 days is archived whole, at most once a day
// from a server start. Runs against the built package, and a real stdio server, in throwaway folders.
//
//   node scripts/my-brain-check.mjs     (part of npm run build)
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { mcpFixture } from './ad-variant-export-check.mjs'
import { lintMyBrain, readSkills } from './brain-lint.mjs'
import { brainOrSkip } from './brain-source.mjs'

// The shared brain a file is laid over: slates-api brain/, every tier, here and in the servers this spawns.
const sharedBrain = brainOrSkip('my-brain')
process.env.SLATES_BRAIN_DIR = sharedBrain

const dir = mkdtempSync(join(tmpdir(), 'slates-my-brain-'))
const scratch = mkdtempSync(join(tmpdir(), 'slates-my-brain-more-'))
process.env.SLATES_MY_BRAIN_DIR = dir
const summary = (bullet) => `<!-- @operative:start -->\n**Operative summary.**\n- ${bullet} (§ Notes)\n- Keep it short. (§ Notes)\n<!-- @operative:end -->`
const skill = (name, description, title, body, lead = summary(`${title}.`)) => `---\nname: ${name}\ndescription: "${description}"\n---\n\n# ${title}\n\n${lead}\n\n## Notes\n\n${body}\n`
const put = (folder, name, text) => writeFileSync(join(folder, `${name}.md`), text)
put(dir, 'slates-cuts', skill('slates-cuts', 'My cuts: every hook cut to its first word.', 'My cuts', 'Cut every hook to its first word.'))
put(dir, 'tight-hooks-preset', skill('tight-hooks-preset', 'A saved preset for tight hooks.', 'Tight hooks', 'Kling, 5 s, first word on frame one.'))
put(dir, 'slates-start-here', skill('slates-start-here', 'A replacement router.', 'Mine', 'Mine.'))
writeFileSync(join(dir, 'no-frontmatter.md'), '# Nothing above me\n')
put(dir, 'router', skill('router', 'A router by another name.', 'Mine too', 'Mine.'))
put(dir, 'my-brain', skill('my-brain', 'A file named for the topic that serves this folder.', 'Mine three', 'Mine.'))
put(dir, 'slates-prompting-kling-v3', skill('slates-prompting-kling-v3', 'My Kling notes.', 'My Kling', 'Detail.', '<!-- @card:start -->\nMy own Kling card: one move per shot.\n<!-- @card:end -->'))
put(dir, 'slates-cost-discipline', skill('slates-cost-discipline', 'My spending rule.', 'My spending', 'Detail.', summary('My own spending rule: one quote per scene.')))

const fail = []
const check = (ok, what) => { if (!ok) fail.push(what) }
let server = null
try {
  const shared = await import(pathToFileURL(join(import.meta.dirname, '..', 'packages', 'shared', 'dist', 'index.js')).href)
  const { operativeSummary, OVERLAY_LEAD } = await import(pathToFileURL(join(import.meta.dirname, '..', 'packages', 'shared', 'dist', 'prompts', 'brain.js')).href)
  const { BRAIN_SHAPE } = shared
  shared.useBrainSource(sharedBrain)
  const SKILLS = shared.brainFiles()
  const op = shared.ALL_OPERATIONS.find((o) => o.id === 'slates_get_prompting_guide')
  const ctx = { guidesRead: new Set(), cloud: () => ({ get: async () => ({ skills: [] }) }) }
  const brain = shared.brainSkills()
  check(brain.mine.has('slates-cuts') && brain.mine.has('tight-hooks-preset'), 'both local files load')
  check(!brain.mine.has('slates-start-here') && brain.skipped.some((s) => s.file === 'slates-start-here.md'), 'a local router is refused and named')
  check(brain.skipped.some((s) => s.file === 'no-frontmatter.md'), 'a file with no frontmatter is skipped and named')
  check(!brain.mine.has('router') && brain.skipped.some((s) => s.file === 'router.md'), "a local file named for one of the router's aliases is refused")
  check(!brain.mine.has('my-brain') && brain.skipped.some((s) => s.file === 'my-brain.md'), 'a local file named for the my-brain topic is refused')
  check(shared.myBrainPreload().includes('router.md:'), 'the preload names the files that did not load')

  // ── A same-name file adds to the shared guide: theirs first, then the shared one (fix: overlay) ──
  check(brain.skills['tight-hooks-preset'] === readFileSync(join(dir, 'tight-hooks-preset.md'), 'utf8'), 'a brand-new name is served as the plain file')
  const cutsWhole = brain.skills['slates-cuts']
  const sharedHeading = /^## .+$/m.exec(SKILLS['slates-cuts'])[0]
  check(cutsWhole.indexOf('first word') > 0 && cutsWhole.indexOf('first word') < cutsWhole.indexOf(sharedHeading), 'the guide prompts and resources serve is their file, then the shared one')
  check(shared.parseSkillMetadata(cutsWhole, 'slates-cuts').description === shared.parseSkillMetadata(SKILLS['slates-cuts'], 'slates-cuts').description, 'a guide laid over keeps the shared description')
  // slates-cuts is a playbook, so its default depth is the whole guide: both bodies.
  const cuts = await op.run({ topic: 'slates-cuts' }, ctx)
  check(cuts.data.source === 'my-brain' && cuts.text.includes(OVERLAY_LEAD) && cuts.text.indexOf('first word') < cuts.text.indexOf(sharedHeading.replace(/^## /, '')), 'the guide op serves their file first, said so, then the shared guide')
  const rule = await op.run({ topic: 'slates-cost-discipline' }, ctx)
  const sharedRule = operativeSummary(SKILLS['slates-cost-discipline']).split('\n').find((l) => l.startsWith('- ')).slice(0, 40)
  check(rule.text.indexOf('My own spending rule') > 0 && rule.text.indexOf('My own spending rule') < rule.text.indexOf(sharedRule), 'at card depth a rule laid over gives their summary, then the shared one')
  check(rule.text.length < (await op.run({ topic: 'slates-cost-discipline', depth: 'full' }, ctx)).text.length, 'and a rule stays at its card')
  const kling = await op.run({ topic: 'slates-prompting-kling-v3' }, ctx)
  const sharedCard = shared.craftCard('slates-prompting-kling-v3').slice(0, 60)
  check(kling.text.indexOf('My own Kling card') > 0 && kling.text.indexOf('My own Kling card') < kling.text.indexOf(sharedCard), 'a local model guide gives its own card first at the default depth, then the shared card')

  // ── The estimate and the guide gate carry the user's card (fix: describeCraftCard over their brain) ──
  const estimate = shared.ALL_OPERATIONS.find((o) => o.id === 'slates_estimate_generation_cost')
  const quote = await estimate.run({ model: 'kling-v3-fixture' }, { cloud: () => ({ get: async () => ({ models: [{ model: 'kling-v3-fixture', cost_credits: 10 }] }) }) })
  check(quote.data.craft_card_skill === 'slates-prompting-kling-v3' && quote.data.craft_card.includes('My own Kling card') && quote.data.craft_card.includes(sharedCard), "the estimate's card is the user's brain's: their Kling card, then the shared one")
  const video = shared.ALL_OPERATIONS.find((o) => o.id === 'slates_generate_video')
  const desktop = { requireCapability: async () => {}, get: async () => { throw new Error('reached the desktop') }, post: async () => { throw new Error('reached the desktop') } }
  const refusal = await video.run({ prompt: 'A car.', model: 'kling-v3-pro', projectId: '11111111-1111-4111-8111-111111111111' }, { desktop: () => desktop, cloud: ctx.cloud, guidesRead: new Set() }).then(() => '', (error) => error.message)
  check(/^Refused: this session has not read/.test(refusal) && refusal.includes('My own Kling card'), "the guide gate's refusal carries the user's card")

  const router = await op.run({ topic: 'start-here' }, ctx)
  check(router.data.topic === 'slates-start-here' && router.text.includes('Playbooks') && !router.text.includes('# Mine'), 'the router stays the shared one')
  check((await op.run({ topic: 'brain' }, ctx)).data.topic === 'slates-start-here', '"brain" still opens the router')
  const preset = await op.run({ topic: 'tight-hooks-preset' }, ctx)
  check(preset.data.topic === 'tight-hooks-preset' && preset.data.source === 'my-brain' && preset.text.startsWith("From the user's own brain (My brain)."), 'a new local name is served by name, and says whose it is')
  const found = await op.run({ query: 'tight hooks preset' }, ctx)
  check(/tight-hooks-preset \(yours\)/.test(found.text), 'search finds the local file, marked as theirs')
  check(ctx.guidesRead.has('slates-cuts'), 'a local guide counts as read for the guide gate')

  // ── The preload: the profile whole, a line per file; it reaches an agent that opens the router itself ──
  put(dir, 'profile', skill('profile', 'Who I am and what I make.', 'Profile', 'I make 15 second cold brew ads for Meta, punchy and dry.'))
  rmSync(join(dir, '.usage.json'), { force: true })
  const preload = shared.myBrainPreload()
  check(preload.indexOf('15 second cold brew ads') > 0 && preload.indexOf('15 second cold brew ads') < preload.indexOf('`tight-hooks-preset`'), 'the preload leads with the profile, then names each file')
  check(/`slates-cuts` \(adds to the shared guide of this name, and wins where they differ\)/.test(preload), 'the preload says which files add to a shared guide')
  const usage = () => { try { return JSON.parse(readFileSync(join(dir, '.usage.json'), 'utf8')) } catch { return {} } }
  check(JSON.stringify(Object.keys(usage())) === '["profile"]', 'the preload dates the profile it reads whole, and no file it only names')
  const opened = await op.run({ topic: 'slates-start-here' }, ctx)
  check(opened.text.startsWith(preload) && opened.text.includes('Playbooks') && opened.data.guide === opened.text, "the router's own answer carries the preload in front, in text and data")
  const mine = await op.run({ topic: 'my-brain' }, ctx)
  check(mine.data.topic === 'my-brain' && mine.text === preload && mine.data.guide === preload, 'the my-brain topic serves the preload')
  process.env.SLATES_MY_BRAIN_DIR = join(scratch, 'none')
  const empty = await op.run({ topic: 'my-brain' }, ctx)
  process.env.SLATES_MY_BRAIN_DIR = dir
  check(empty.text.includes('is empty') && empty.text.includes(join(scratch, 'none')), 'the my-brain topic says an empty folder is empty, and where it lives')
  put(dir, 'long-notes', skill('long-notes', 'x'.repeat(14_000), 'Long', 'Long.'))
  check(shared.myBrainPreload().length <= shared.MY_BRAIN_PRELOAD_CHARS + 80, 'the preload stays under its cap')
  rmSync(join(dir, 'long-notes.md'))

  // ── Over a real stdio server: the router answer carries the preload; prompts and resources date their file ──
  const fixture = await mcpFixture()
  const transport = new StdioClientTransport({ command: process.execPath, args: fixture.args, env: { ...fixture.env, SLATES_MY_BRAIN_DIR: dir }, stderr: 'pipe' })
  const client = new Client({ name: 'my-brain-check', version: '1.0.0' })
  server = { close: async () => { await client.close(); await transport.close(); await fixture.close() } }
  await client.connect(transport)
  const wire = await client.callTool({ name: 'slates_get_prompting_guide', arguments: { topic: 'slates-start-here' } })
  check(wire.content[0].text.includes('15 second cold brew ads') && wire.content.length === 1, 'over MCP, an agent that opens the router itself gets the preload with it, and no second router')
  rmSync(join(dir, '.usage.json'), { force: true })
  await client.getPrompt({ name: 'tight-hooks-preset' })
  await client.readResource({ uri: 'slates://skill/slates-cost-discipline' })
  await client.getPrompt({ name: 'slates-camera-language' })
  const dated = usage()
  check(dated['tight-hooks-preset'] && dated['slates-cost-discipline'] && !dated['slates-camera-language'], 'a My brain file served as a prompt or a resource is dated; a bundled one is not')
  check(existsSync(join(dir, '.archive-run')), 'the server ran the daily archive at start')
  await server.close()
  server = null

  // ── The shape, checked on load the way brain-lint.mjs --mine checks it (brain-check.ts) ──
  const cap = BRAIN_SHAPE.caps.mine.fileWords
  const passage = 'Every winning hook names its viewer, promises one concrete payoff and says what the ad is about inside two seconds flat, always.'
  const fromBundled = operativeSummary(SKILLS['slates-camera-language']).split('\n').filter((l) => l.startsWith('- ')).join('\n')
  const shape = join(scratch, 'shape')
  mkdirSync(shape)
  put(shape, 'no-summary', skill('no-summary', 'No summary.', 'No summary', 'Body.', ''))
  put(shape, 'empty-summary', skill('empty-summary', 'Empty summary.', 'Empty summary', 'Body.', '<!-- @operative:start -->\n<!-- @operative:end -->'))
  put(shape, 'too-long', skill('too-long', 'Too long.', 'Too long', ' word'.repeat(cap + 1)))
  put(shape, 'long-comments', skill('long-comments', 'Short, with long notes to myself.', 'Long comments', `Short.<!--${' word'.repeat(cap * 2)} -->`))
  put(shape, 'copy-a', skill('copy-a', 'A lesson.', 'Copy a', passage))
  put(shape, 'copy-b', skill('copy-b', 'The same lesson.', 'Copy b', passage))
  put(shape, 'from-bundled', skill('from-bundled', 'A lesson the shared brain already has.', 'From bundled', fromBundled))
  const held = shared.brainSkills(shape)
  const why = (name) => held.skipped.find((s) => s.file === `${name}.md`)?.reason ?? ''
  check(/no <!-- @operative:start --> summary/.test(why('no-summary')), 'a file with no summary is not loaded, and named')
  check(/operative summary is empty/.test(why('empty-summary')), 'a file with an empty summary is not loaded, and named')
  check(new RegExp(`over My brain's file cap of ${cap}`).test(why('too-long')), "a file over the shape's file cap is not loaded, and named")
  check(held.mine.has('long-comments'), 'words in comments and frontmatter do not count, as in the lint')
  check(held.mine.has('copy-a') && /shares \d+ \d+-word runs with their copy-a/.test(why('copy-b')), 'of two files sharing a lesson, the later one is not loaded, and named')
  check(/with the shared slates-camera-language/.test(why('from-bundled')), 'a file repeating a bundled skill is not loaded, and named')
  const linted = lintMyBrain(readSkills(shape), { bundled: readSkills() }).join('\n')
  for (const name of ['no-summary', 'empty-summary', 'too-long', 'copy-b', 'from-bundled']) check(linted.includes(`${name}: ${why(name)}`), `brain-lint --mine names ${name} for the same reason the loader does`)
  check(!/long-comments: .*cap/.test(linted), 'and counts words the same way')
  // The folder's cap: the profile is checked first, so the files past the cap are the ones left out.
  const full = join(scratch, 'full')
  mkdirSync(full)
  const each = cap - 30
  const count = Math.ceil(BRAIN_SHAPE.caps.mine.layerWords / each) + 1
  for (let i = 0; i < count; i++) put(full, `a-${i}`, skill(`a-${i}`, `Notes ${i}.`, `Notes ${i}`, Array.from({ length: each - 20 }, (_, j) => `n${i}w${j}`).join(' ')))
  // A profile as long as the others, so it fits only when it is checked before them.
  put(full, 'profile', skill('profile', 'Who I am.', 'Profile', Array.from({ length: each - 20 }, (_, j) => `me${j}`).join(' ')))
  const capped = shared.brainSkills(full)
  check(capped.mine.has('profile') && capped.skipped.some((s) => /over its cap of \d+; consolidate first/.test(s.reason)), "past the folder's cap the last files are left out and named, never the profile")

  // ── What goes unused leaves: a served file is dated, and only past 60 days unused moves to archive/ ──
  const day = 24 * 60 * 60 * 1000
  check(shared.archiveUnused(dir, new Date(Date.now() + 30 * day)).length === 0, 'nothing used within 60 days is archived')
  // A usage record that will not parse archives nothing, and an edit counts as use even with an old load date.
  writeFileSync(join(dir, '.usage.json'), '{ half a file')
  check(shared.archiveUnused(dir, new Date(Date.now() + 61 * day)).length === 0, 'an unreadable usage record archives nothing')
  writeFileSync(join(dir, '.usage.json'), JSON.stringify({ 'tight-hooks-preset': new Date(Date.now() - 90 * day).toISOString(), 'slates-cuts': 'not a date' }))
  check(shared.archiveUnused(dir, new Date(Date.now() + 30 * day)).length === 0, 'a file edited recently stays, whatever its last load date says')
  const moved = shared.archiveUnused(dir, new Date(Date.now() + 61 * day))
  check(moved.includes('slates-cuts') && existsSync(join(dir, 'archive', 'slates-cuts.md')) && !shared.brainSkills().mine.has('slates-cuts'), 'a file unused for 60 days moves whole to archive/ and stops loading')
  // At most once a day from a start, and never fatal.
  const daily = join(scratch, 'daily')
  mkdirSync(daily)
  const stale = (name) => { put(daily, name, skill(name, 'Old.', 'Old', 'Old.')); const then = new Date(Date.now() - 90 * day); utimesSync(join(daily, `${name}.md`), then, then) }
  stale('old-one')
  check(shared.archiveUnusedDaily(daily).includes('old-one'), 'the first start of the day archives')
  stale('old-two')
  check(shared.archiveUnusedDaily(daily).length === 0 && existsSync(join(daily, 'old-two.md')), 'a second start the same day does not')
  check(shared.archiveUnusedDaily(daily, new Date(Date.now() + 25 * 60 * 60 * 1000)).includes('old-two'), 'a start the next day does')
  // A My brain path that is not a folder leaves the shared brain serving.
  const notAFolder = join(dir, 'a-file')
  writeFileSync(notAFolder, 'x')
  const broken = shared.brainSkills(notAFolder)
  check(broken.mine.size === 0 && broken.skipped.length === 1 && Object.hasOwn(broken.skills, 'slates-cuts'), 'an unreadable My brain folder is named and the shared brain still serves')
  check(Array.isArray(shared.archiveUnusedDaily(notAFolder)), 'the daily archive on a path that is not a folder does not throw')
} finally {
  if (server) await server.close()
  rmSync(dir, { recursive: true, force: true })
  rmSync(scratch, { recursive: true, force: true })
}
if (fail.length) {
  console.error(`✗ my-brain check:\n  ${fail.join('\n  ')}`)
  process.exit(1)
}
console.log("✓ my-brain check: a same-name file is served over the shared guide (theirs first), new ones are served and found, the router stays shared and its answer carries the preload, the estimate and the gate carry their card, the shape is held on load as the lint holds it, every serve dates the file, unused files archive at 60 days at most once a day")
