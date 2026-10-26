// No tracked file in this public repo carries the brain (second-brain plans/2026-10-25-slates-brain.md step 4): the
// playbooks, rules and model guides live in the private slates-api `brain/` and reach an account by its tier. Each
// brain line of 90 characters or more (its markdown, or a partial only it injects) is cut into 70-character windows,
// one every 20 characters and one at its end, and a window found anywhere in a tracked file here fails: a substring
// match, so an excerpt quoted inside a longer line, a generated export or a fixture cannot publish one either. Escaped
// text is read unescaped as well (twice, for JSON inside a JSON string), since a trace or a result quotes the brain as
// "…\n…\"…\"". A zip is read by its entries.
//
// Public already, so never counted: a window the public card, router or public partials also hold; a file's
// `description:` line (every account is served it, locked or not, and the pack's catalog prints it); the partials
// packages/shared/scripts/render-capability-partials.mjs renders from public constants (its `files`, read from its
// source); and a brain line brain-leak-pins.json pins to a public file, because that file is its home and the brain
// restates it (an op description, a prompting tip, a provider's own example). Exempt from the scan: the two code files
// that are the home of text the brain copies (SOURCES).
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strFromU8, unzipSync } from 'fflate'
import { PUBLIC_SKILLS_DIR, brainOrSkip } from './brain-source.mjs'

const MIN = 90
const WINDOW = 70
const STRIDE = 20
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const brain = brainOrSkip('brain-leak')

const markdownIn = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? markdownIn(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : [])
const linesOf = (text) => text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length >= MIN)
const lineId = (line) => createHash('sha256').update(line).digest('hex').slice(0, 12)
/** Window → the brain line it was cut from: its file and id. */
const secret = new Map()
let brainLines = 0
for (const f of markdownIn(brain)) {
  const file = relative(brain, f).split(sep).join('/')
  for (const line of linesOf(readFileSync(f, 'utf8'))) {
    if (line.startsWith('description:')) continue
    brainLines++
    const offsets = new Set([line.length - WINDOW])
    for (let i = 0; i + WINDOW <= line.length; i += STRIDE) offsets.add(i)
    for (const i of offsets) {
      const w = line.slice(i, i + WINDOW)
      if (!secret.has(w)) secret.set(w, { file, id: lineId(line) })
    }
  }
}

// Every offset of every file is tried, so the windows are found by a rolling hash and compared only on a hash match.
const BASE = 0x01000193
let BASE_POW = 1
for (let i = 0; i < WINDOW; i++) BASE_POW = Math.imul(BASE_POW, BASE)
const hashOf = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, BASE) + s.charCodeAt(i)) | 0; return h }
const hashes = new Set([...secret.keys()].map(hashOf))
/** Each brain window `text` holds, at any offset. */
function* windowsIn(text) {
  let h = 0
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(h, BASE) + text.charCodeAt(i)) | 0
    if (i >= WINDOW) h = (h - Math.imul(text.charCodeAt(i - WINDOW), BASE_POW)) | 0
    if (i >= WINDOW - 1 && hashes.has(h)) {
      const w = text.slice(i - WINDOW + 1, i + 1)
      if (secret.has(w)) yield w
    }
  }
}

const RENDERER = join(root, 'packages', 'shared', 'scripts', 'render-capability-partials.mjs')
const rendered = [...(/const files = \{([^}]*)\}/.exec(readFileSync(RENDERER, 'utf8'))?.[1] ?? '').matchAll(/'([^']+\.md)'/g)].map((m) => join(brain, '_partials', m[1]))
if (!rendered.length) {
  console.error(`[brain-leak] could not read which partials ${RENDERER} renders (its \`const files = { … }\`)`)
  process.exit(1)
}
// Public text: the card, router and public partials, and each rendered partial, which stays public wherever
// sync-partials injects it into a brain file.
for (const f of [...markdownIn(PUBLIC_SKILLS_DIR), ...rendered]) for (const w of [...windowsIn(readFileSync(f, 'utf8'))]) secret.delete(w)
const pins = JSON.parse(readFileSync(join(root, 'scripts', 'brain-leak-pins.json'), 'utf8')).pins

const ESCAPE = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '"': '"', "'": "'", '\\': '\\', '/': '/', '`': '`' }
const unescape = (text) => text.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (m, c) => (c.length === 5 ? String.fromCharCode(parseInt(c.slice(1), 16)) : ESCAPE[c] ?? m))
/** The text, and the text unescaped while it still holds escapes (up to twice). */
function readings(text) {
  const out = [text]
  for (let t = text, k = 0; k < 2 && t.includes('\\'); k++) out.push((t = unescape(t)))
  return out
}

// Code that owns its words and renders them into the brain, so the brain holds the copy: the capability partials
// (numbers from model-capabilities) and the content policy the app sends with every generation.
const SOURCES = new Set(['packages/shared/scripts/render-capability-partials.mjs', 'packages/shared/src/prompts/content-policy.ts'])
const BINARY = /\.(png|jpe?g|gif|webp|ico|mcpb|woff2?|ttf|mp4|mp3|wav|gz)$/i
// A skill archive is a zip: its entries are read, since a compressed line never matches.
const ARCHIVE = /\.(zip|skill)$/i
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)
const leaks = []
const pinsUsed = new Set()
for (const path of tracked) {
  if (BINARY.test(path) || SOURCES.has(path)) continue
  let text
  try {
    text = ARCHIVE.test(path)
      ? Object.values(unzipSync(readFileSync(join(root, path)))).map((entry) => strFromU8(entry)).join(String.fromCharCode(10))
      : readFileSync(join(root, path), 'utf8')
  } catch {
    continue // listed but deleted in the working tree
  }
  const allowed = new Set(pins[path] ?? [])
  scan: for (const reading of readings(text)) {
    for (const w of windowsIn(reading)) {
      const hit = secret.get(w)
      if (allowed.has(hit.id)) {
        pinsUsed.add(`${path} ${hit.id}`)
        continue
      }
      leaks.push(`${path}: "${w.slice(0, 40)}…" from brain/${hit.file} (line ${hit.id})`)
      break scan
    }
  }
}
const stale = Object.entries(pins).flatMap(([path, ids]) => ids.filter((id) => !pinsUsed.has(`${path} ${id}`)).map((id) => `${path} ${id}`))
if (stale.length) console.warn(`[brain-leak] ${stale.length} pins in brain-leak-pins.json no longer match; drop them: ${stale.join(', ')}`)

if (leaks.length) {
  console.error(`[brain-leak] ${leaks.length} tracked public file(s) carry the private brain:\n  ${leaks.join('\n  ')}`)
  console.error('  Generate it into a gitignored folder, or keep it in slates-api. A tracked file here ships to everyone. Pin a line in')
  console.error('  brain-leak-pins.json only when the public file is its home and the brain restates it, never for text pasted from the brain.')
  process.exit(1)
}
console.log(`[brain-leak] no tracked file holds any ${WINDOW}-character stretch of ${brainLines} brain lines of ${MIN}+ characters (${secret.size} windows)`)
