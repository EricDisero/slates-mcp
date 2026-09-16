import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate'
import assert from 'node:assert/strict'

const source = new URL('../skills/slates-chatgpt-images.md', import.meta.url)
const output = new URL('../exports/slates-chatgpt-images/generated/', import.meta.url)
const markdown = readFileSync(source, 'utf8')
const archive = zipSync({ 'slates-chatgpt-images/SKILL.md': [strToU8(markdown), { mtime: new Date(2026, 8, 15, 12, 0, 0) }] })
const files = { 'SKILL.md': Buffer.from(markdown), 'slates-chatgpt-images.skill': Buffer.from(archive) }
assert.equal(strFromU8(unzipSync(archive)['slates-chatgpt-images/SKILL.md']), markdown)
if (process.argv.includes('--check')) {
  for (const [name, content] of Object.entries(files)) assert.deepEqual(readFileSync(new URL(name, output)), content, `Rebuild ChatGPT skill: ${name}`)
} else {
  mkdirSync(output, { recursive: true })
  for (const [name, content] of Object.entries(files)) writeFileSync(new URL(name, output), content)
}
console.log(`ChatGPT desktop skill verified: ${fileURLToPath(output)}`)
