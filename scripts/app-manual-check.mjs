import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { APP_MANUAL, appManualIndex, appManualSections, ALL_OPERATIONS } from '../packages/shared/dist/index.js'
import { desktopSource } from './desktop-source.mjs'

const canonical = desktopSource('docs/slates-llm-manual.md')
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
