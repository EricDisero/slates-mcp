// No tracked file in this public repo carries the brain (second-brain plans/2026-10-25-slates-brain.md step 4): the
// playbooks, rules and model guides live in the private slates-api `brain/` and reach an account by its tier. A line
// of 90 characters or more from a brain file (its markdown or a partial only it injects) found in any tracked file
// here fails, so a generated export, a fixture or a pasted excerpt cannot publish one. Lines the public card, router or
// public partials also hold are public already and do not count. Exempt: eval traces recorded before the move (the
// tracked ones under scripts/*/results/*/traces/, kept as they were; new traces are gitignored), and the two code
// files that are the home of text the brain copies (SOURCES).
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strFromU8, unzipSync } from 'fflate'
import { PUBLIC_SKILLS_DIR, brainOrSkip } from './brain-source.mjs'

const MIN = 90
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const brain = brainOrSkip('brain-leak')

const markdownIn = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? markdownIn(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : [])
const linesOf = (text) => text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length >= MIN)

const pub = new Set(markdownIn(PUBLIC_SKILLS_DIR).flatMap((f) => linesOf(readFileSync(f, 'utf8'))))
const secret = new Map()
for (const f of markdownIn(brain)) {
  for (const line of linesOf(readFileSync(f, 'utf8'))) if (!pub.has(line) && !secret.has(line)) secret.set(line, f.slice(brain.length + 1))
}

const EXEMPT = /^scripts\/(behaviour-ab|brain-eval)\/results\/[^/]+\/traces\//
// Code that owns its words and renders them into the brain, so the brain holds the copy: the capability partials
// (numbers from model-capabilities) and the content policy the app sends with every generation.
const SOURCES = new Set(['packages/shared/scripts/render-capability-partials.mjs', 'packages/shared/src/prompts/content-policy.ts'])
const BINARY = /\.(png|jpe?g|gif|webp|ico|mcpb|woff2?|ttf|mp4|mp3|wav|gz)$/i
// A skill archive is a zip: its entries are read, since a compressed line never matches.
const ARCHIVE = /\.(zip|skill)$/i
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)
const leaks = []
for (const path of tracked) {
  if (EXEMPT.test(path) || BINARY.test(path) || SOURCES.has(path)) continue
  let text
  try {
    text = ARCHIVE.test(path)
      ? Object.values(unzipSync(readFileSync(join(root, path)))).map((entry) => strFromU8(entry)).join(String.fromCharCode(10))
      : readFileSync(join(root, path), 'utf8')
  } catch {
    continue // listed but deleted in the working tree
  }
  for (const line of linesOf(text)) {
    if (secret.has(line)) {
      leaks.push(`${path}: a line of brain/${secret.get(line)}`)
      break
    }
  }
}

if (leaks.length) {
  console.error(`[brain-leak] ${leaks.length} tracked public file(s) carry the private brain:\n  ${leaks.join('\n  ')}`)
  console.error('  Generate it into a gitignored folder, or keep it in slates-api. A tracked file here ships to everyone.')
  process.exit(1)
}
console.log(`[brain-leak] no tracked file holds any of ${secret.size} brain lines of ${MIN}+ characters`)
