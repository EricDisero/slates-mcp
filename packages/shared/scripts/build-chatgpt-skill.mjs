import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { loadTypeScriptModule } from '../../../scripts/load-typescript.mjs'
import { brainDir, unpublishedProblems } from '../../../scripts/brain-source.mjs'

const { parseSkillMetadata } = loadTypeScriptModule(new URL('../src/skills/metadata.ts', import.meta.url))

// The skill is the brain's (slates-api brain/); single-repo CI has none and skips.
const brain = brainDir()
if (!brain) process.exit(0)
const source = join(brain, 'slates-chatgpt-images.md')
const output = new URL('../exports/slates-chatgpt-images/generated/', import.meta.url)
const markdown = readFileSync(source, 'utf8')
parseSkillMetadata(markdown, 'slates-chatgpt-images')
// The operative summary leads the file (the brain lint); its first bullet must be the prerequisite.
const summary = /<!--\s*@operative:start\s*-->([\s\S]*?)<!--\s*@operative:end\s*-->/.exec(markdown)
const firstBullet = summary?.[1].split(/\r?\n/).find((line) => line.startsWith('- ')) ?? ''
assert.ok(!summary || /\(§ Prerequisites\)\s*$/.test(firstBullet), 'The operative summary must open on the Connected Slates prerequisites')
const body = summary ? markdown.replace(summary[0], '') : markdown
const prerequisite = body.indexOf('## Prerequisites')
const firstTool = body.indexOf('`slates_')
assert.ok(prerequisite >= 0 && prerequisite < firstTool, 'Connected Slates prerequisites must precede tool calls')
assert.match(body.slice(prerequisite, firstTool), /https:\/\/slates\.video\/docs\//, 'Prerequisites need a setup pointer')
const archive = zipSync({ 'slates-chatgpt-images/SKILL.md': [strToU8(markdown), { mtime: new Date(2026, 8, 15, 12, 0, 0) }] })
const files = { 'SKILL.md': Buffer.from(markdown), 'slates-chatgpt-images.skill': Buffer.from(archive) }
assert.equal(strFromU8(unzipSync(archive)['slates-chatgpt-images/SKILL.md']), markdown)
if (process.argv.includes('--validate')) {
  console.log('ChatGPT desktop skill source and deterministic archive validated without writing')
} else if (process.argv.includes('--check')) {
  // The skill is a license-tier brain file: generated/ is private (gitignored, untracked, outside the npm package).
  const leaks = unpublishedProblems(fileURLToPath(output))
  assert.equal(leaks.length, 0, `The ChatGPT skill export would publish the private brain: ${leaks.join('; ')}`)
} else {
  mkdirSync(output, { recursive: true })
  for (const [name, content] of Object.entries(files)) writeFileSync(new URL(name, output), content)
}
console.log(`ChatGPT desktop skill verified: ${fileURLToPath(output)}`)
