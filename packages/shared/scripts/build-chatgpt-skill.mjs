import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate'
import assert from 'node:assert/strict'
import { loadTypeScriptModule } from '../../../scripts/load-typescript.mjs'

const { parseSkillMetadata } = loadTypeScriptModule(new URL('../src/skills/metadata.ts', import.meta.url))

const source = new URL('../skills/slates-chatgpt-images.md', import.meta.url)
const output = new URL('../exports/slates-chatgpt-images/generated/', import.meta.url)
const markdown = readFileSync(source, 'utf8')
parseSkillMetadata(markdown, 'slates-chatgpt-images')
const prerequisite = markdown.indexOf('## Prerequisites')
const firstTool = markdown.indexOf('`slates_')
assert.ok(prerequisite >= 0 && prerequisite < firstTool, 'Connected Slates prerequisites must precede tool calls')
assert.match(markdown.slice(prerequisite, firstTool), /https:\/\/slates\.video\/docs\//, 'Prerequisites need a setup pointer')
const archive = zipSync({ 'slates-chatgpt-images/SKILL.md': [strToU8(markdown), { mtime: new Date(2026, 8, 15, 12, 0, 0) }] })
const files = { 'SKILL.md': Buffer.from(markdown), 'slates-chatgpt-images.skill': Buffer.from(archive) }
assert.equal(strFromU8(unzipSync(archive)['slates-chatgpt-images/SKILL.md']), markdown)
if (process.argv.includes('--validate')) {
  console.log('ChatGPT desktop skill source and deterministic archive validated without writing')
} else if (process.argv.includes('--check')) {
  for (const [name, content] of Object.entries(files)) assert.ok(readFileSync(new URL(name, output)).equals(content), `Rebuild ChatGPT skill: ${name}`)
} else {
  mkdirSync(output, { recursive: true })
  for (const [name, content] of Object.entries(files)) writeFileSync(new URL(name, output), content)
}
console.log(`ChatGPT desktop skill verified: ${fileURLToPath(output)}`)
