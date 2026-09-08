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
console.log('App manual: canonical snapshot matches, search returns whole sections, shared operation serves the same text.')
