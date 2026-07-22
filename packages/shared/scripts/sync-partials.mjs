// Prompt-partial sync — the de-fork mechanism for shared prompting prose.
//
// THE PROBLEM THIS SOLVES: the reference rules were canonical prose in
// src/prompts/reference-rules.ts that NOTHING imported, while five per-model
// skills each hand-maintained their own paraphrase. One rule, eight wordings.
// Worse, a 2026-06-26 doctrine reversal (role-labeling → naming-as-one-entity)
// propagated to some copies and not others — hand-sync did not merely drift,
// it survived a reversal.
//
// HOW IT WORKS: canonical prose lives in skills/_partials/<name>.md. Any skill
// that needs it carries a marker pair; this script writes the resolved text
// between the markers and commits it, so every de-fork is visible in review.
//
//     <!-- @inject:reference-rules-core -->
//     ...generated; do not edit between the markers...
//     <!-- @end:reference-rules-core -->
//
// The resolved text is COMMITTED into skills/*.md on purpose: package.json
// `files` publishes the raw skills/ directory, and the CLI's `install-skills`
// writes those files verbatim onto users' disks. A build-time-only substitution
// would ship placeholders or force a packaging change.
//
// MODES
//   (no flag)  rewrite skills in place, then emit the TS module
//   --check    do not touch skills; print a unified diff and exit 1 on drift.
//              Still emits the TS module — it is a gitignored build artifact
//              that tsc needs on a clean checkout.
//
// RULES (all violations exit non-zero)
//   - partials are leaf nodes: a partial may not itself contain a marker
//   - unknown partial name referenced by a skill
//   - a partial referenced by no skill (no dead partials) — unless its first
//     line is `<!-- consumer:ts -->`, which declares it TS-only (consumed from
//     PARTIALS, e.g. the short card copy prompting-tips.ts renders)
//   - marker mismatch: open without close, close without open, nesting,
//     or a close whose name doesn't match its open
//
// Output: src/prompts/partials.generated.ts (gitignored, regenerated every
// build) — the same JSON.stringify treatment embed-skills.mjs gives content.ts.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, '..')
const skillsDir = join(pkgRoot, 'skills')
const partialsDir = join(skillsDir, '_partials')
const tsOutDir = join(pkgRoot, 'src', 'prompts')
const tsOutFile = join(tsOutDir, 'partials.generated.ts')

const CHECK = process.argv.includes('--check')
const NAME_RE = '[a-z0-9][a-z0-9-]*'
const OPEN_RE = new RegExp(`^<!-- @inject:(${NAME_RE}) -->$`)
const CLOSE_RE = new RegExp(`^<!-- @end:(${NAME_RE}) -->$`)
const ANY_MARKER_RE = /^<!-- @(inject|end):/

const errors = []
const fail = (msg) => errors.push(msg)

// ── 1. Load partials ────────────────────────────────────────────────────────

if (!existsSync(partialsDir)) {
  console.error(`[sync-partials] missing ${partialsDir}`)
  process.exit(1)
}

const partials = new Map()
/** Partials consumed only from TypeScript via PARTIALS, exempt from the
 *  no-dead-partials check. Declared by a `<!-- consumer:ts -->` first line —
 *  the exemption has to be explicit, or "nothing references it" stops meaning
 *  anything and dead prose accumulates again. */
const tsOnly = new Set()

for (const f of readdirSync(partialsDir).filter((f) => f.endsWith('.md')).sort()) {
  const name = basename(f, '.md')
  if (!new RegExp(`^${NAME_RE}$`).test(name)) {
    fail(`_partials/${f}: name must match /^${NAME_RE}$/ (lowercase, digits, hyphens)`)
    continue
  }
  let raw = readFileSync(join(partialsDir, f), 'utf8').replace(/\r\n/g, '\n')
  if (raw.trimStart().startsWith('<!-- consumer:ts -->')) {
    tsOnly.add(name)
    raw = raw.trimStart().slice('<!-- consumer:ts -->'.length)
  }
  const body = raw.trim()
  // Depth 1, no recursion: a partial containing a marker would need a resolver
  // with a cycle check, and that complexity is a signal the content is wrong.
  if (body.split('\n').some((l) => ANY_MARKER_RE.test(l.trim()))) {
    fail(`_partials/${f}: partials are leaf nodes — they may not contain @inject/@end markers`)
    continue
  }
  partials.set(name, body)
}

if (partials.size === 0) {
  console.error(`[sync-partials] no .md partials found in ${partialsDir}`)
  process.exit(1)
}

// ── 2. Resolve markers in every skill ───────────────────────────────────────

/** Walks a skill's lines, validating markers and substituting partial bodies. */
function resolve(file, text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out = []
  const used = new Set()
  let open = null // { name, line }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const openMatch = OPEN_RE.exec(trimmed)
    const closeMatch = CLOSE_RE.exec(trimmed)

    if (openMatch) {
      if (open) {
        fail(`${file}:${i + 1}: @inject:${openMatch[1]} nested inside @inject:${open.name} (opened line ${open.line})`)
        return null
      }
      const name = openMatch[1]
      if (!partials.has(name)) {
        fail(`${file}:${i + 1}: unknown partial "${name}" — no _partials/${name}.md`)
        return null
      }
      open = { name, line: i + 1 }
      used.add(name)
      out.push(line, partials.get(name))
      continue
    }

    if (closeMatch) {
      if (!open) {
        fail(`${file}:${i + 1}: @end:${closeMatch[1]} with no matching @inject`)
        return null
      }
      if (open.name !== closeMatch[1]) {
        fail(`${file}:${i + 1}: @end:${closeMatch[1]} closes @inject:${open.name} (opened line ${open.line})`)
        return null
      }
      open = null
      out.push(line)
      continue
    }

    // Everything inside a marker block is generated — drop the old body.
    if (!open) out.push(line)
  }

  if (open) {
    fail(`${file}:${open.line}: @inject:${open.name} never closed`)
    return null
  }

  return { text: out.join('\n'), used }
}

const skillFiles = readdirSync(skillsDir).filter((f) => f.endsWith('.md')).sort()
const referenced = new Set()
const drifted = []
let rewritten = 0

for (const f of skillFiles) {
  const path = join(skillsDir, f)
  const original = readFileSync(path, 'utf8')
  const result = resolve(f, original)
  if (!result) continue
  for (const n of result.used) referenced.add(n)
  if (result.used.size === 0) continue

  if (result.text !== original.replace(/\r\n/g, '\n')) {
    if (CHECK) drifted.push({ file: f, before: original.replace(/\r\n/g, '\n'), after: result.text })
    else {
      writeFileSync(path, result.text)
      rewritten++
    }
  }
}

// ── 3. No dead partials ─────────────────────────────────────────────────────

// Skipped when a skill already failed validation — its markers never got
// walked, so "referenced" is incomplete and every miss would be a false alarm.
if (errors.length === 0) {
  for (const name of partials.keys()) {
    if (!referenced.has(name) && !tsOnly.has(name)) {
      fail(
        `_partials/${name}.md is referenced by no skill — inject it somewhere, ` +
          `delete it, or mark it \`<!-- consumer:ts -->\` if it is consumed from PARTIALS in TypeScript`
      )
    }
  }
}

// ── 4. Report drift (--check) ───────────────────────────────────────────────

/** Minimal unified-ish diff: enough to see WHICH lines drifted, no deps. */
function printDiff(file, before, after) {
  const a = before.split('\n')
  const b = after.split('\n')
  console.error(`\n--- ${file} (committed)`)
  console.error(`+++ ${file} (expected from _partials/)`)
  let i = 0
  let j = 0
  let shown = 0
  while ((i < a.length || j < b.length) && shown < 60) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    // Resync: find the next line that matches on both sides.
    let k = j
    while (k < b.length && b[k] !== a[i]) k++
    if (k < b.length && k - j <= 200) {
      for (; j < k && shown < 60; j++, shown++) console.error(`+${b[j]}`)
      continue
    }
    let m = i
    while (m < a.length && a[m] !== b[j]) m++
    if (m < a.length && m - i <= 200) {
      for (; i < m && shown < 60; i++, shown++) console.error(`-${a[i]}`)
      continue
    }
    if (i < a.length) console.error(`-${a[i++]}`), shown++
    if (j < b.length) console.error(`+${b[j++]}`), shown++
  }
  if (shown >= 60) console.error('… (diff truncated)')
}

// ── 5. Emit the TS module (both modes — tsc needs it) ───────────────────────

let ts = '// GENERATED — do not edit. Source: packages/shared/skills/_partials/*.md\n'
ts += '// Regenerated by scripts/sync-partials.mjs on every build.\n'
ts += '//\n'
ts += '// This is the SAME text injected between the @inject markers in the\n'
ts += '// per-model skills, so the TS consumers and the markdown consumers can\n'
ts += '// no longer disagree. Edit the partial, not this file, not the skills.\n\n'
ts += 'export const PARTIALS: Record<string, string> = {\n'
for (const [name, body] of [...partials.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  ts += `  ${JSON.stringify(name)}: ${JSON.stringify(body)},\n`
}
ts += '}\n'

mkdirSync(tsOutDir, { recursive: true })
writeFileSync(tsOutFile, ts)

// ── 6. Exit ─────────────────────────────────────────────────────────────────

// Structural errors first — they explain any drift that follows.
if (errors.length > 0) {
  console.error('[sync-partials] failed:')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

if (drifted.length > 0) {
  console.error(`[sync-partials] ${drifted.length} skill(s) out of sync with _partials/:`)
  for (const d of drifted) printDiff(d.file, d.before, d.after)
  console.error(`\n[sync-partials] run \`npm run sync-partials -w packages/shared\` to fix.`)
  process.exit(1)
}

const verb = CHECK ? 'verified' : rewritten > 0 ? `synced (${rewritten} rewritten)` : 'synced (no changes)'
console.log(`[sync-partials] ${verb} — ${partials.size} partial(s) across ${referenced.size} referenced name(s)`)
