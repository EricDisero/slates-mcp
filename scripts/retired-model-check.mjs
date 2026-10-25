// Veo left Slates on 2026-10-02. This check stops it coming back.
//
//   - This repo must hold no Veo reference at all.
//   - slate, slates-api and slates-web may never hold more than the per-file
//     counts in `retired-model-baseline.json`. The baseline is a ratchet: it holds what
//     the retirement keeps on purpose (labels on old takes, dated comparisons,
//     the /models/veo-3-1 page, server keys guarded until older desktops age
//     out) plus rows not yet removed, and it only ever shrinks. A count above
//     the baseline, or a hit in a file the baseline does not list, fails.
//     A count below it prints the command that tightens it.
//
// A Veo reference is `veo` at the start of a word in any case (`veo-3.1`,
// `VEO_RATES`, `veo3`) or `Veo` inside a camelCase name (`isVeoModel`).
// Lowercase letters before `veo` (`activeObject`, `curveOut`) do not count.
//
// The siblings sit next to this repo, or next to SLATES_DESKTOP_DIR in a
// worktree. Single-repo CI skips them with a warning.
//
//   node scripts/retired-model-check.mjs           check
//   node scripts/retired-model-check.mjs --write   rewrite the baseline from the siblings as they are
//
// The retirement plan: second-brain plans/2026-10-03-slates-veo-final-retirement.md

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = resolve(root, 'scripts', 'retired-model-baseline.json')
// Two expressions, because only the first may ignore case: `/i` on the second
// would let lowercase `veo` inside `curveOut` match.
const START = /(?<![A-Za-z])veo/gi
const CAMEL = /(?<=[a-z])Veo/g
// The behaviour A/B's and the brain eval's results are recorded sessions: their random tool-call ids spell `4veo7` now and then, and
// what they quote from the guides is checked at its source. HyperFrames' generated fonts.css is the same: base64
// font files, which spell `Veo` by chance.
const SKIP = /(^|\/)(package-lock\.json|.*\.(png|jpe?g|webp|gif|ico|mp4|mov|webm|woff2?|ttf|zip|tgz|mcpb|pdf))$|^scripts\/(behaviour-ab|brain-eval)\/results\/|^packages\/shared\/skills\/hyperframes\/.*\/fonts\.css$/i
const MAX_BYTES = 2_000_000
// This file and its baseline have to name Veo.
const SELF = new Set(['scripts/retired-model-check.mjs', 'scripts/retired-model-baseline.json'])

function countHits(text) {
  return (text.match(START)?.length ?? 0) + (text.match(CAMEL)?.length ?? 0)
}

function scan(repo) {
  const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const hits = {}
  for (const path of listed.split('\0')) {
    if (!path || SKIP.test(path)) continue
    const file = resolve(repo, path)
    if (!existsSync(file)) continue
    const stat = statSync(file)
    if (!stat.isFile() || stat.size > MAX_BYTES) continue
    const buffer = readFileSync(file)
    if (buffer.includes(0)) continue
    const n = countHits(buffer.toString('utf8'))
    if (n) hits[path] = n
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

const own = scan(root)
for (const path of SELF) delete own[path]
for (const [path, n] of Object.entries(own)) failures.push(`slates-mcp/${path}: ${n} Veo reference(s); this repo allows none`)

const parent = siblingRoot()
const present = parent ? SIBLINGS.filter(name => existsSync(resolve(parent, name, '.git'))) : []
if (present.length < SIBLINGS.length) {
  const missing = SIBLINGS.filter(name => !present.includes(name))
  const message = `sibling repos not found (${missing.join(', ')})${parent ? ` next to ${parent}` : '; set SLATES_DESKTOP_DIR in a worktree'}`
  if (process.env.CI) warnings.push(`${message}; skipped them`)
  else failures.push(`${message}. A local check cannot skip.`)
}

const current = Object.fromEntries(present.map(name => [name, scan(resolve(parent, name))]))

if (process.argv.includes('--write')) {
  if (present.length < SIBLINGS.length) {
    console.error('retired-model-check: --write needs all three sibling repos.')
    process.exit(1)
  }
  const sorted = Object.fromEntries(SIBLINGS.map(name => [name, Object.fromEntries(Object.entries(current[name]).sort(([a], [b]) => a.localeCompare(b)))]))
  writeFileSync(BASELINE, JSON.stringify(sorted, null, 2) + '\n')
  const total = SIBLINGS.reduce((sum, name) => sum + Object.values(sorted[name]).reduce((a, b) => a + b, 0), 0)
  console.log(`retired-model-check: baseline written, ${total} references in ${SIBLINGS.map(name => `${name} ${Object.keys(sorted[name]).length} files`).join(', ')}`)
  process.exit(0)
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
for (const name of present) {
  const allowed = baseline[name] ?? {}
  for (const [path, n] of Object.entries(current[name])) {
    const cap = allowed[path] ?? 0
    if (n > cap) failures.push(`${name}/${path}: ${n} Veo reference(s), baseline allows ${cap}`)
  }
  for (const [path, cap] of Object.entries(allowed)) {
    const n = current[name][path] ?? 0
    if (n < cap) warnings.push(`${name}/${path}: ${n} below the baseline's ${cap}; tighten with node scripts/retired-model-check.mjs --write`)
  }
}

for (const warning of warnings) console.warn(`retired-model-check: warning: ${warning}`)
if (failures.length) {
  console.error('retired-model-check: FAILED. Veo was retired on 2026-10-02; remove the reference, or if it is a kept receipt, raise the baseline in review.')
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}
const total = present.reduce((sum, name) => sum + Object.values(current[name]).reduce((a, b) => a + b, 0), 0)
console.log(`retired-model-check: ok. slates-mcp holds none; ${present.join(', ') || 'no siblings'} hold ${total}, within the baseline.`)
