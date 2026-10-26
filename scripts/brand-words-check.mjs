#!/usr/bin/env node
// Slates is white-labelled (engine-test item 8; slate's `.claude/rules/white-label.md`). Eric,
// 2026-10-19: "Never ever say HyperFrames. We are white labeling this shit. That needs to be a hard
// rule. Everything we add to Slates is Slates itself."
//
// Fails when a vendor's name is in anything an agent reads from this repo: a string in a package's
// source (tool descriptions, results, errors, the CLI's words; comments are free) or one of Slates'
// own skills. The motion engine's skills (`packages/shared/skills/hyperframes/`) ship unmodified for
// their licence and are white-labelled where they are served (`whiteLabel` in
// `packages/shared/src/skills/hyperframes.ts`: the name turned into ours, the vendor company's
// hosted service dropped); this checks that every one of them comes out clean and tests the rules.
// Internal strings no agent reads stay, each on the list below with its reason.
//
//   node scripts/brand-words-check.mjs [--self-test]     (part of npm run build)
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { readAllSkills } from './brain-source.mjs'

const REPO = join(import.meta.dirname, '..')
const PACKAGES = join(REPO, 'packages')
const OWN_SKILLS = join(PACKAGES, 'shared', 'skills')
const CORPUS = join(OWN_SKILLS, 'hyperframes')

/** The names no agent may read: the engine and the company behind it. */
const WORDS = /hyper\s*-?\s*frames?|heygen/i
/** The brand as prose, or the company in any form; the white-labelled corpus may keep only the engine's code forms (`__hyperframes`, `@hyperframes/core`, `npx hyperframes`). */
const PROSE = /\bHyper[Ff]rames?\b|[Hh][Ee][Yy][Gg][Ee][Nn]/

/** Strings that hold a name but are never read by an agent. */
const ALLOWED = [
  [/\bfrom\s+['"][^'"]*['"]|import\(\s*['"][^'"]*['"]\s*\)/g, 'an import path'],
  [/const OVERVIEW = 'hyperframes'/g, "the upstream overview skill's folder name, served as motion-overview"],
  [/'hyperframes-mapping'/g, "an old topic name for the mapping, still accepted"],
  [/^const VENDOR_(?:URL|JSON_LINE) = \/.*$/g, "the patterns `whiteLabel` finds the company's name with, to drop it from upstream text"],
]

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
const STRING = /(['"`])(?:\\.|(?!\1)[^\\])*\1/g

/** Each line of `src` (a source file) that holds the name in a string no allowance covers. */
export function sourceHits(src) {
  const hits = []
  stripComments(src).split('\n').forEach((line, i) => {
    let rest = line
    for (const [pattern] of ALLOWED) rest = rest.replace(pattern, '')
    // A template's `${…}` is code (an identifier such as HYPERFRAMES_MAPPING), not words.
    for (const literal of rest.match(STRING) ?? []) if (WORDS.test(literal.replace(/\$\{[^}]*\}/g, ''))) { hits.push({ line: i + 1, text: line.trim() }); break }
  })
  return hits
}

const lineHits = (text, pattern) => text.split('\n').flatMap((line, i) => (pattern.test(line) ? [{ line: i + 1, text: line.trim() }] : []))

function* files(dir, test) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue
      yield* files(path, test)
    } else if (test(name)) yield path
  }
}

function selfTest() {
  const cases = [
    ['a description fails', "description: 'Search the HyperFrames registry'", 1],
    ['the company in a string fails', "const hint = 'Sign in to HeyGen'", 1],
    ['a comment passes', '// HyperFrames blocks', 0],
    ['an import passes', "import { x } from '../skills/hyperframes.js'", 0],
    ['an identifier in a template passes', 'const t = `topic motion/${HYPERFRAMES_MAPPING}`', 0],
  ]
  let failed = 0
  for (const [name, src, want] of cases) {
    const got = sourceHits(src).length
    if (got !== want) failed++
    console.log(`${got === want ? 'ok ' : 'BAD'}  ${name}${got === want ? '' : `: ${got} hit(s), expected ${want}`}`)
  }
  if (failed) { console.error(`✖ brand-words self-test: ${failed} failed`); process.exit(1) }
}

/** `whiteLabel` on small markdown: [name, input, the output it must give (null: the stub)]. */
const SERVED_CASES = [
  ["the engine's name becomes ours, its code forms stay", 'HyperFrames runs `npx hyperframes lint` on `__hyperframes`.\n', 'Slates motion runs `npx hyperframes lint` on `__hyperframes`.\n'],
  ['text without the vendor is untouched', '# T\n\nPlain.\n', '# T\n\nPlain.\n'],
  ['a link to the vendor keeps its text', 'Per [PR #1](https://github.com/heygen-com/hyperframes/pull/1), yes.\n', 'Per PR #1, yes.\n'],
  ['a bare vendor URL reads as the upstream source', 'See https://hyperframes.heygen.com/docs. Next.\n', 'See the upstream source. Next.\n'],
  ['a paragraph about the service goes, its neighbours stay', 'Keep.\n\nSign in to HeyGen first.\n\nAlso keep.\n', 'Keep.\n\nAlso keep.\n'],
  ['a list item goes alone', '- one\n- HeyGen two\n- three\n', '- one\n- three\n'],
  ['a table row goes alone', '| a | b |\n|---|---|\n| x | HeyGen |\n| y | z |\n', '| a | b |\n|---|---|\n| y | z |\n'],
  ['a section named for the service goes with its subsections', '# T\n\n## Local\n\nok\n\n## HeyGen cloud\n\nno\n\n### Auth\n\nno\n\n## After\n\nok2\n', '# T\n\n## Local\n\nok\n\n## After\n\nok2\n'],
  ['a heading left empty goes', '# T\n\n## Auth\n\nHeyGen only.\n\n## Next\n\nok\n', '# T\n\n## Next\n\nok\n'],
  ['a lead-in that names the service takes its list', 'Keep.\n\nSign in to HeyGen:\n\n- web\n- key\n\nAfter.\n', 'Keep.\n\nAfter.\n'],
  ['an example takes its lead-in', 'Keep.\n\nFetch it:\n\n```bash\ncurl https://api.heygen.com\n```\n\nAfter.\n', 'Keep.\n\nAfter.\n'],
  ['a vendor URL property leaves the rest of its example', '```json\n{\n  "$schema": "https://hyperframes.heygen.com/s.json",\n  "name": "x"\n}\n```\n', '```json\n{\n  "name": "x"\n}\n```\n'],
  ['front matter loses only its vendor sentence', '---\nname: hyperframes-cli\ndescription: >\n  Use it. Covers HeyGen cloud.\n---\n\nBody.\n', '---\nname: motion-cli\ndescription: >\n  Use it.\n---\n\nBody.\n'],
  ['a guide that was all the service becomes a stub', '# cloud — HeyGen rendering\n\nAll of it.\n', null],
]

function servedTest(whiteLabel) {
  let failed = 0
  for (const [name, input, want] of SERVED_CASES) {
    const got = whiteLabel(input)
    const ok = want === null ? got.startsWith('# Not offered in Slates\n') && !WORDS.test(got) : got === want
    if (!ok) failed++
    console.log(`${ok ? 'ok ' : 'BAD'}  served: ${name}${ok ? '' : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`}`)
  }
  if (failed) { console.error(`✖ brand-words served self-test: ${failed} failed`); process.exit(1) }
}

if (process.argv.includes('--self-test')) selfTest()

const rel = (path) => relative(REPO, path).split(sep).join('/')
const problems = []
for (const pkg of readdirSync(PACKAGES)) {
  const src = join(PACKAGES, pkg, 'src')
  try { statSync(src) } catch { continue }
  for (const file of files(src, (n) => /\.(ts|tsx|js|mjs)$/.test(n) && !n.startsWith('hyperframes-content'))) {
    for (const hit of sourceHits(readFileSync(file, 'utf8'))) problems.push(`${rel(file)}:${hit.line}  ${hit.text.slice(0, 160)}`)
  }
}
// Our own skills: the card and router here and the brain in slates-api brain/ (the public half alone in single-repo CI).
for (const [name, text] of Object.entries(readAllSkills())) {
  for (const hit of lineHits(text, WORDS)) problems.push(`${name}.md:${hit.line}  ${hit.text.slice(0, 160)}`)
}
// The served corpus, as an agent receives it.
const { whiteLabel } = await import('../packages/shared/dist/skills/hyperframes.js').catch(() => ({ whiteLabel: null }))
if (!whiteLabel) problems.push('packages/shared/dist/skills/hyperframes.js: not built, so the served guides were not checked (run after the shared build)')
else {
  if (process.argv.includes('--self-test')) servedTest(whiteLabel)
  for (const file of files(CORPUS, (n) => n.endsWith('.md'))) {
    for (const hit of lineHits(whiteLabel(readFileSync(file, 'utf8')), PROSE)) problems.push(`${rel(file)}:${hit.line} (served)  ${hit.text.slice(0, 160)}`)
  }
}

if (problems.length) {
  console.error(`✖ check:brand-words: ${problems.length} place(s) an agent reads a vendor's name:\n  ${problems.join('\n  ')}\n\n  Slates is white-labelled: say what it is ("motion block", "composition"), never whose it is.`)
  process.exit(1)
}
console.log("✓ check:brand-words: no vendor name in the packages' strings, Slates' skills or the served motion guides")
