// A retired family stays gone. The families and the words that name them come
// from the one retired list, `packages/shared/src/prompts/retired-models.ts`
// (each entry's `terms`; an entry with none is a version swap inside a family
// that lives on, which a word match cannot tell apart from the live seat).
//
//   - This repo must hold no mention of a retired family outside the list itself.
//   - slate, slates-api and slates-web may never hold more than the per-file
//     counts in `retired-model-baseline.json`, per family. The baseline is a
//     ratchet: it holds what a retirement keeps on purpose (labels on old takes,
//     dated comparisons, server keys guarded until older desktops age out) plus
//     rows not yet removed, and it only ever shrinks. A count above the
//     baseline, or a hit in a file the baseline does not list, fails. A count
//     below it prints the command that tightens it.
//
// Never counted, in any repo: the list file, CHANGELOG.md, docs/design-reviews/,
// any file or folder named with a YYYY-MM-DD date, recorded eval evidence and
// results, DB migrations, and the server-key files an entry names while its keys
// still bill (`keysBilledUntil`).
//
// The siblings sit next to this repo, or next to SLATES_DESKTOP_DIR in a
// worktree. Single-repo CI skips them with a warning. Run after the shared build
// (`npm run build` does): the list is read from its compiled module.
//
//   node scripts/retired-model-check.mjs           check
//   node scripts/retired-model-check.mjs --write   rewrite the baseline from the siblings as they are

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = resolve(root, 'scripts', 'retired-model-baseline.json')
const LIST_FILE = 'packages/shared/src/prompts/retired-models.ts'
const { RETIRED_SEATS } = await import(pathToFileURL(resolve(root, 'packages/shared/dist/prompts/retired-models.js')).href)

// One family per distinct set of terms, named by its first id: Veo's two seats share theirs.
const families = new Map()
for (const [id, seat] of Object.entries(RETIRED_SEATS)) {
  if (!seat.terms.length) continue
  const signature = seat.terms.map(String).join(' ')
  const family = [...families.values()].find(f => f.signature === signature)
  if (family) family.seats.push([id, seat])
  else families.set(id, { name: id, signature, terms: seat.terms, seats: [[id, seat]] })
}

// Binary and lock files; HyperFrames' generated fonts.css is base64 font files, which spell words by chance.
const SKIP = /(^|\/)(package-lock\.json|.*\.(png|jpe?g|webp|gif|ico|bmp|mp3|wav|mp4|mov|webm|woff2?|ttf|zip|tgz|mcpb|pdf))$|^packages\/shared\/skills\/hyperframes\/.*\/fonts\.css$/i
// History a retirement keeps, in every repo.
const HISTORY = /(^|\/)CHANGELOG\.md$|(^|\/)docs\/design-reviews\/|(^|\/)[^/]*\d{4}-\d{2}-\d{2}[^/]*(\/|$)|^scripts\/(agent-eval\/evidence|behaviour-ab\/results|brain-eval\/results)\/|^drizzle\//
// A family's word that names something else in one place, keyed by the family's first id. LTX: HyperFrames'
// own local video provider, which its bundled guides describe; it is not our seat.
const NOT_OURS = { 'ltx-2-5': /^packages\/shared\/skills\/hyperframes\// }
const SELF = new Set(['scripts/retired-model-check.mjs', 'scripts/retired-model-baseline.json', LIST_FILE])
const MAX_BYTES = 2_000_000

/** Paths a family's server keeps while its keys bill, as `repo/path`. */
function keptServerFiles(family) {
  return new Set(family.seats.flatMap(([, seat]) => (seat.keysBilledUntil === 'update-floor' ? seat.serverFiles ?? [] : [])))
}

function countHits(text, terms) {
  return terms.reduce((sum, term) => sum + (text.match(new RegExp(term.source, term.flags.includes('g') ? term.flags : `${term.flags}g`))?.length ?? 0), 0)
}

function scan(repo, name) {
  const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const hits = Object.fromEntries([...families.keys()].map(key => [key, {}]))
  for (const path of listed.split('\0')) {
    if (!path || SKIP.test(path) || HISTORY.test(path)) continue
    if (name === 'slates-mcp' && SELF.has(path)) continue
    const file = resolve(repo, path)
    if (!existsSync(file)) continue
    const stat = statSync(file)
    if (!stat.isFile() || stat.size > MAX_BYTES) continue
    const buffer = readFileSync(file)
    if (buffer.includes(0)) continue
    const text = buffer.toString('utf8')
    for (const family of families.values()) {
      if (NOT_OURS[family.name]?.test(path) || keptServerFiles(family).has(`${name}/${path}`)) continue
      const n = countHits(text, family.terms)
      if (n) hits[family.name][path] = n
    }
  }
  return hits
}

function siblingRoot() {
  const explicit = process.env.SLATES_DESKTOP_DIR
  if (explicit) return dirname(resolve(root, explicit))
  if (basename(root) !== 'slates-mcp') return null
  return dirname(root)
}

const SIBLINGS = ['slate', 'slates-api', 'slates-web']
const failures = []
const warnings = []
const label = key => families.get(key).seats.map(([, seat]) => seat.label).join(' / ')

const own = scan(root, 'slates-mcp')
for (const [key, files] of Object.entries(own)) {
  for (const [path, n] of Object.entries(files)) failures.push(`slates-mcp/${path}: ${n} ${label(key)} reference(s); this repo allows none outside ${LIST_FILE}`)
}

const parent = siblingRoot()
const present = parent ? SIBLINGS.filter(name => existsSync(resolve(parent, name, '.git'))) : []
if (present.length < SIBLINGS.length) {
  const missing = SIBLINGS.filter(name => !present.includes(name))
  const message = `sibling repos not found (${missing.join(', ')})${parent ? ` next to ${parent}` : '; set SLATES_DESKTOP_DIR in a worktree'}`
  if (process.env.CI) warnings.push(`${message}; skipped them`)
  else failures.push(`${message}. A local check cannot skip.`)
}

const current = Object.fromEntries(present.map(name => [name, scan(resolve(parent, name), name)]))
const sortedFiles = files => Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))

if (process.argv.includes('--write')) {
  if (present.length < SIBLINGS.length) {
    console.error('retired-model-check: --write needs all three sibling repos.')
    process.exit(1)
  }
  const written = Object.fromEntries([...families.keys()].map(key => [key, Object.fromEntries(SIBLINGS.map(name => [name, sortedFiles(current[name][key])]))]))
  writeFileSync(BASELINE, JSON.stringify(written, null, 2) + '\n')
  for (const key of families.keys()) {
    const total = SIBLINGS.reduce((sum, name) => sum + Object.values(written[key][name]).reduce((a, b) => a + b, 0), 0)
    console.log(`retired-model-check: baseline written for ${label(key)}, ${total} references in ${SIBLINGS.map(name => `${name} ${Object.keys(written[key][name]).length} files`).join(', ')}`)
  }
  process.exit(0)
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
for (const key of Object.keys(baseline)) {
  if (!families.has(key)) failures.push(`the baseline names ${key}, which the retired list gives no terms; rewrite it with node scripts/retired-model-check.mjs --write`)
}
for (const key of families.keys()) {
  for (const name of present) {
    const allowed = baseline[key]?.[name] ?? {}
    for (const [path, n] of Object.entries(current[name][key])) {
      const cap = allowed[path] ?? 0
      if (n > cap) failures.push(`${name}/${path}: ${n} ${label(key)} reference(s), baseline allows ${cap}`)
    }
    for (const [path, cap] of Object.entries(allowed)) {
      const n = current[name][key][path] ?? 0
      if (n < cap) warnings.push(`${name}/${path}: ${n} ${label(key)} below the baseline's ${cap}; tighten with node scripts/retired-model-check.mjs --write`)
    }
  }
}

for (const warning of warnings) console.warn(`retired-model-check: warning: ${warning}`)
if (failures.length) {
  console.error(`retired-model-check: FAILED. A retired family came back (${LIST_FILE}); remove the reference, or if it is a kept receipt, raise the baseline in review.`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}
const totals = [...families.keys()].map(key => `${label(key)} ${present.reduce((sum, name) => sum + Object.values(current[name][key]).reduce((a, b) => a + b, 0), 0)}`)
console.log(`retired-model-check: ok. slates-mcp holds none; ${present.join(', ') || 'no siblings'} hold ${totals.join(', ')}, within the baseline.`)
