import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { APP_MANUAL, appManualSections, ALL_OPERATIONS } from '../packages/shared/dist/index.js'

const canonical = new URL('../../slate/docs/slates-llm-manual.md', import.meta.url)
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
console.log('App manual: canonical snapshot matches, search returns whole sections, shared operation serves the same text.')
