import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_MANUAL, appManualIndex, appManualSections, ALL_OPERATIONS, SKILLS } from '../packages/shared/dist/index.js'
import { desktopSource } from './desktop-source.mjs'

// slates-web may pin the docs to a slate commit that buyers have (scripts/llm-docs/desktop-docs-ref.json,
// SLATES_DOCS_REF overrides). Pinned, this package ships that commit's manual, so the copy to match is the
// generator's own output of it, slates-web's public/slates-reference.md, not slate's main.
const web = resolve(dirname(fileURLToPath(import.meta.url)), '../../slates-web')
const pinFile = resolve(web, 'scripts/llm-docs/desktop-docs-ref.json')
const docsRef = process.env.SLATES_DOCS_REF !== undefined
  ? process.env.SLATES_DOCS_REF || null
  : existsSync(pinFile) ? JSON.parse(readFileSync(pinFile, 'utf8')).ref : null
const canonical = docsRef ? resolve(web, 'public/slates-reference.md') : desktopSource('docs/slates-llm-manual.md')
if (docsRef) console.error(`[sources] manual: slates-web reference, pinned to slate ${docsRef.slice(0, 7)}`)
if (existsSync(canonical)) {
  assert.equal(APP_MANUAL, readFileSync(canonical, 'utf8'), 'Manual drift: run npm run build:llm-docs in slates-web')
} else console.warn('Canonical sibling absent; checking the published snapshot only.')
assert.equal(appManualSections(), APP_MANUAL)
assert.match(appManualSections('voice recording'), /Import voice clip/)
assert.match(appManualSections('zzzzunmatched'), /Available headings/)
const op = ALL_OPERATIONS.find(o => o.id === 'slates_get_prompting_guide')
const result = await op.run(op.input.parse({ topic: 'app-manual', query: 'voice recording' }), {})
assert.equal(result.text, appManualSections('voice recording'))
assert.ok(result.text.length < APP_MANUAL.length)
// The body must ride in `data` as well as `text`: the MCP server mirrors `data`
// as structuredContent, and a host that shows only structuredContent (Claude
// Code, 2026-09-14) otherwise hands the model a topic and a byte count.
assert.equal(result.data.guide, result.text, 'app-manual body missing from data.guide')
for (const [topic, depth] of [['slates-prompting-minimax-h3', 'full'], ['slates-prompting-minimax-h3', 'card'], ['slates-one-prompt-film', 'full']]) {
  const r = await op.run(op.input.parse({ topic, depth }), {})
  assert.ok(r.text.length > 500, `${topic} ${depth}: body too short`)
  assert.equal(r.data.guide, r.text, `${topic} ${depth}: body missing from data.guide`)
  assert.equal(r.data.bytes, Buffer.byteLength(r.text, 'utf8'))
}
// The same holds for the price table: Claude Code's model read `{"count":169}` and no prices (2026-10-18).
{
  const models = ALL_OPERATIONS.find(o => o.id === 'slates_list_available_models')
  const fake = { cloud: () => ({ get: async () => ({ models: [{ model: 'kling-v3-standard-5s-audio', cost_credits: 32 }] }) }) }
  const r = await models.run(models.input.parse({}), fake)
  assert.equal(r.data.text, r.text, 'list_available_models: the price table missing from data')
  assert.match(r.data.text, /kling-v3-standard-5s-audio 32/)
}
// Every op the manual names exists. The manual tells an agent which op does what a control does; an
// op name that is not in the registry sends it to call a tool that is not there (1.6.1: a draft cited
// `slates_get_asset` before it was built). `present_plan` is the Studio Agent's loop tool, not an op.
const opIds = new Set([...ALL_OPERATIONS.map((o) => o.id), 'present_plan'])
// `<slates_reference>` is the manual's own wrapper tag, not an op.
const cited = [...new Set(APP_MANUAL.match(/(?<![</])\bslates_[a-z0-9_]+/g) ?? [])].filter((id) => !/_$/.test(id))
const unknownOps = cited.filter((id) => !opIds.has(id))
assert.deepEqual(unknownOps, [], `The manual names op(s) the registry does not have: ${unknownOps.join(', ')}`)

// One question costs one small section (plans/2026-09-30-slates-manual-for-llms-1-6-1-decisions.md § 0):
// a query returns at most ~1.5k tokens, and the map with no query stays small.
for (const q of ['export an mp4', 'where is the timeline', 'use my own voice recording', 'buy credits', 'rename a character']) {
  const r = appManualSections(q)
  assert.ok(r.length <= 6400, `"${q}" returned ${r.length} characters; a question must cost one small section`)
}
assert.ok(appManualIndex().length <= 12000, `the manual map is ${appManualIndex().length} characters`)
console.log(`App manual: canonical snapshot matches, one small section per question, ${cited.length} cited ops all exist, shared operation serves the same text.`)

// The agent-facing text that rides beside the manual. A tool with an empty description gives the model
// a bare name, and a skill that names a tool or a guide the package lacks sends the agent after
// something that is not there (2026-10-17: a GPT Image guide line cited a rule in a skill that no
// longer had it). Skill text is checked where it is written: the shared skills and the plugin-only ones.
const undescribed = ALL_OPERATIONS.filter((o) => !(o.description ?? '').trim()).map((o) => o.id)
assert.deepEqual(undescribed, [], `Op(s) with no description: ${undescribed.join(', ')}`)
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const skillFiles = [
  ...readdirSync(resolve(repo, 'packages/shared/skills')).filter((f) => f.endsWith('.md')).map((f) => resolve(repo, 'packages/shared/skills', f)),
  ...readdirSync(resolve(repo, 'plugins/src/skills')).map((d) => resolve(repo, 'plugins/src/skills', d, 'SKILL.md')).filter((f) => existsSync(f)),
]
const guideNames = new Set([...Object.keys(SKILLS), ...readdirSync(resolve(repo, 'plugins/src/skills'))])
// Backticked `slates-…` names that are repos, packages or files, not guides.
const notGuides = new Set(['slates-mcp', 'slates-web', 'slates-api', 'slates-blender', 'slates-releases', 'slates-video', 'slates-studio'])
const broken = []
for (const file of skillFiles) {
  const text = readFileSync(file, 'utf8')
  const name = file.replace(/\\/g, '/').split('/').slice(-2).join('/')
  for (const id of new Set(text.match(/\bslates_[a-z0-9_]+/g) ?? [])) {
    if (!/_$/.test(id) && !id.startsWith('slates_sk_') && !opIds.has(id)) broken.push(`${name}: tool ${id}`)
  }
  for (const [, guide] of text.matchAll(/`(slates-[a-z0-9-]+)`/g)) {
    if (!notGuides.has(guide) && !guide.endsWith('-') && !guideNames.has(guide)) broken.push(`${name}: guide ${guide}`)
  }
}
assert.deepEqual(broken, [], `Skill text names what the package lacks:\n  ${broken.join('\n  ')}`)
console.log(`Agent text: ${ALL_OPERATIONS.length} ops described; ${skillFiles.length} skill files name only real tools and guides.`)
