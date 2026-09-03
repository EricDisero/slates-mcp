// ============================================================
// README GENERATION — the counts and the roster, from the BUILD.
//
// All three READMEs said "64 tools" and "15 skills" against a real surface of
// 91 and 33, and listed "Seedance 2.0" as the video roster months after LTX,
// MiniMax and Omni Flash shipped. The confirm threshold was quoted as "$0.50",
// which stopped being the unit in the 2026-07-07 credit re-denomination.
//
// 🚨 NONE OF THOSE NUMBERS IS TYPED ANY MORE. Marked spans in each README are
// filled from the built `@slatesvideo/shared` dist:
//
//     <!-- gen:tool-count -->91<!-- /gen:tool-count -->
//
// MODES
//   (no flag)  rewrite the READMEs in place
//   --check    print the drift and exit 1 (wired into `npm run build`)
//
// Deliberately the same mechanism as sync-partials: markers committed into the
// file, so every regeneration is visible in review and the published tarball
// carries real text rather than a placeholder.
// ============================================================

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')
const CHECK = process.argv.includes('--check')

const dist = join(repoRoot, 'packages', 'shared', 'dist', 'index.js')
const shared = await import(pathToFileURL(dist).href)
const { ALL_OPERATIONS, SKILLS, VIDEO_MODELS, IMAGE_MODELS, AUDIO_MODELS, CONFIRM_CREDITS, MODEL_FACTS } = shared

/** Human names for the roster line, from MODEL_FACTS — never hand-typed. */
function roster(ids) {
  return ids
    .map((id) => MODEL_FACTS.find((f) => f.id === id)?.label ?? id)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ')
}

const skillNames = Object.keys(SKILLS)
const perModel = skillNames.filter((n) => n.startsWith('slates-prompting-'))
const workflow = skillNames.filter((n) => !n.startsWith('slates-prompting-'))

const VALUES = {
  'tool-count': String(ALL_OPERATIONS.length),
  'skill-count': String(skillNames.length),
  'per-model-skill-count': String(perModel.length),
  'workflow-skill-count': String(workflow.length),
  'confirm-credits': String(CONFIRM_CREDITS),
  'video-roster': roster([...VIDEO_MODELS]),
  'image-roster': roster([...IMAGE_MODELS]),
  'audio-roster': roster([...AUDIO_MODELS]),
  'workflow-skills': workflow.map((n) => n.replace('slates-', '')).join(', '),
}

const FILES = [
  join(repoRoot, 'README.md'),
  join(repoRoot, 'packages', 'mcp', 'README.md'),
  join(repoRoot, 'packages', 'cli', 'README.md'),
]

const errors = []
const drifted = []
let rewritten = 0

for (const file of FILES) {
  const original = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  let out = original
  const seen = new Set()
  out = out.replace(
    /<!-- gen:([a-z0-9-]+) -->[\s\S]*?<!-- \/gen:\1 -->/g,
    (_match, name) => {
      seen.add(name)
      if (!(name in VALUES)) {
        errors.push(`${file}: unknown generated span "${name}". Known: ${Object.keys(VALUES).join(', ')}`)
        return _match
      }
      return `<!-- gen:${name} -->${VALUES[name]}<!-- /gen:${name} -->`
    }
  )
  if (seen.size === 0) {
    errors.push(`${file}: no <!-- gen:… --> spans at all. Every count and roster line in a README must be generated.`)
  }
  if (out !== original) {
    if (CHECK) drifted.push(file)
    else {
      writeFileSync(file, out)
      rewritten++
    }
  }
}

if (errors.length > 0) {
  console.error('[render-readmes] failed:')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
if (drifted.length > 0) {
  console.error('[render-readmes] stale generated spans in:')
  for (const f of drifted) console.error(`  - ${f}`)
  console.error('[render-readmes] run `node scripts/render-readmes.mjs` to fix.')
  process.exit(1)
}
console.log(
  `[render-readmes] ${CHECK ? 'verified' : rewritten > 0 ? `rewrote ${rewritten}` : 'no changes'} — ` +
    `${VALUES['tool-count']} tools, ${VALUES['skill-count']} skills`
)
