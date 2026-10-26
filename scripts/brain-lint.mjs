#!/usr/bin/env node
// The brain's shape (second-brain plans/2026-10-25-slates-brain.md § The shape, § Keeping it from
// turning into chaos). The skills are one layered brain: the Director card (L0) and the router (L1)
// in `slates-start-here`, a playbook per job (L2), the rules and model guides they link (L3). An
// agent reads a few hundred words to know where to go, so the layers only work while each one
// stays its size, every lesson has one home and every file says what it holds at its top. Agents
// organize; Eric decides: the shape, the caps and the known overlaps are pinned in
// brain-shape.json, which changes only with his yes. This checks, reading the markdown directly:
//
//   1. the router exists, carries the Director card, and both are under their word caps;
//   2. every guide the router names exists, and it lists at least one playbook and one rule;
//   3. every skill is reachable: named by the router, or by a file the router names. Per-model
//      guides are exempt, since the model id resolves to them in code and the guide gate makes
//      the agent read one before its model's first generation;
//   4. every other file leads with an operative summary: an @operative block (or, on a per-model
//      guide or another file with a craft card, the @card, never both), before its first section,
//      under its cap, two to seven bullets, each ending on (§ heading) for headings that exist;
//   5. a fixed shape: every file has exactly one layer in brain-shape.json, and the router's
//      Playbooks table lists exactly the pinned playbooks and its Rules section only pinned rules;
//   6. caps: every file under its layer's word cap, and every layer's total under its cap;
//   7. one home per lesson: no two files share a passage (nine-word runs, the vault's duplicate
//      check), past the pinned known overlaps, which may shrink and never grow. Shared blocks
//      injected from one partial (@inject) are one home and do not count;
//   8. a source on every new block: each block of lines added since `sourcesSince` here and
//      `brainSourcesSince` in slates-api's brain/ (brain-shape.json; a paragraph,
//      or a list with no blank line between its items; a brand-new unstaged file counts as wholly
//      added) carries a `<!-- src: what it came from, YYYY-MM-DD -->` comment, inline or on the
//      line right after it (agents never see comments).
//
// A pinned overlap that has since shrunk prints a warning, so the pin gets lowered (Eric's call).
//
// The same rules run on a user's My brain (`--root <dir> --mine`; packages/shared/src/skills/
// my-brain.ts). What the loader checks on the user's machine on every load (a summary, the personal
// caps, one home per lesson among their files and against every bundled skill) is one function in
// packages/shared/src/skills/brain-check.ts, which this calls, so the lint and the loader agree on
// what loads and count words the same way; this adds the summary's exact shape and a source on every
// block, not only new ones. The serving-provider and raw-rate check is skill-copy-check.mjs.
//
//   node scripts/brain-lint.mjs [--self-test] [--measure]      (part of npm run build)
//   node scripts/brain-lint.mjs --root <dir> --mine
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadTypeScriptModule } from './load-typescript.mjs'
import { brainOrSkip, readAllSkills, readSkillDir } from './brain-source.mjs'

const REPO = join(import.meta.dirname, '..')
export const ROUTER = 'slates-start-here'
export const SHAPE = JSON.parse(readFileSync(join(import.meta.dirname, 'brain-shape.json'), 'utf8'))
export const CAPS = { directorWords: 300, routerWords: SHAPE.caps.fileWords.router, operativeChars: 1200, bulletsMin: 2, bulletsMax: 7 }
// The word count, the passage runs and the My brain checks, shared with the package (a dependency-free leaf, read
// from source so the lint needs no build).
const BRAIN_CHECK = loadTypeScriptModule(join(REPO, 'packages', 'shared', 'src', 'skills', 'brain-check.ts'))

const OPERATIVE_RE = /<!--\s*@operative:start\s*-->([\s\S]*?)<!--\s*@operative:end\s*-->/
const CARD_START_RE = /<!--\s*@card:start\s*-->/
const CARD_RE = /<!--\s*@card:start\s*-->([\s\S]*?)<!--\s*@card:end\s*-->/
const DIRECTOR_RE = /<!--\s*@director:start\s*-->([\s\S]*?)<!--\s*@director:end\s*-->/
const INJECT_RE = /<!--\s*@inject:([a-z0-9-]+)\s*-->[\s\S]*?<!--\s*@end:\1\s*-->/g
const COMMENT_RE = /<!--[\s\S]*?-->/g
const FRONTMATTER_RE = /^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/
// What it came from (a letter or digit, so a bare comma is not a source), then the date, then anything
// up to the first `-->`; a `>` inside the text is fine.
export const SOURCE_RE = /<!--\s*src:(?:(?!-->)[\s\S])*?[\p{L}\p{N}](?:(?!-->)[\s\S])*?\d{4}-\d{2}-\d{2}(?:(?!-->)[\s\S])*-->/u
const COMMENT_LINE_RE = /^\s*<!--[\s\S]*-->\s*$/

const prose = (text) => text.replace(COMMENT_RE, '').replace(FRONTMATTER_RE, '')
export const words = BRAIN_CHECK.words
/** Headings outside code fences, without their hashes. */
const headings = (text) => {
  const out = []
  let fenced = false
  for (const line of prose(text).split(/\r?\n/)) {
    if (/^\s*```/.test(line)) fenced = !fenced
    if (!fenced && /^#{2,4} /.test(line)) out.push(line.replace(/^#+ /, '').trim())
  }
  return out
}
const named = (text) => [...prose(text).matchAll(/`(slates-[a-z0-9]+(?:-[a-z0-9]+)*)`/g)].map((m) => m[1])
/** The router's names under a `## ` section whose heading starts with `title`. */
const sectionNames = (router, title) => {
  const m = new RegExp(`^## ${title}[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(prose(router))
  return m ? [...new Set(named(m[1]))] : []
}
/** Per line, whether it is a code fence or sits inside one (the closing fence included). */
const fenceMap = (lines) => {
  let open = false
  return lines.map((line) => {
    if (/^\s*```/.test(line)) { open = !open; return true }
    return open
  })
}
/** Whether a line carries a lesson: not a heading, a lone comment, a table rule or code. */
const isLesson = (line, inFence) => !inFence && !!line.trim() && !/^#{1,6} /.test(line) && !COMMENT_LINE_RE.test(line) && !/^\|?[\s:|-]+\|?$/.test(line)
const layerOf = (shape, name) => Object.entries(shape.layers).filter(([, names]) => names.includes(name)).map(([layer]) => layer)

/** Per pair of files (`a + b`, sorted), how many nine-word runs they share. */
export const overlaps = (skills, n = SHAPE.duplicates.shingleWords) => BRAIN_CHECK.overlaps(skills, n)

/** The operative summary's shape on one file; shared by both brains. */
function summaryFailures(name, text) {
  const fail = []
  const op = OPERATIVE_RE.exec(text)
  const hasCard = CARD_START_RE.test(text)
  if (op && hasCard) return [`${name}: carries both an @operative block and a @card; the card is its summary, keep one`]
  if (!op && hasCard) {
    // An empty card is no summary; a start with no end is not a card the readers can extract.
    const card = CARD_RE.exec(text)
    if (!card) return [`${name}: the <!-- @card:start --> has no <!-- @card:end -->`]
    return card[1].replace(COMMENT_RE, '').trim() ? [] : [`${name}: the @card is empty; it is the file's summary`]
  }
  if (!op) return [`${name}: no <!-- @operative:start --> block leading the file`]
  const firstSection = text.search(/^## /m)
  if (firstSection !== -1 && op.index > firstSection) fail.push(`${name}: the operative summary sits below the first section; it leads the file`)
  if (op.index > text.length * 0.25) fail.push(`${name}: the operative summary starts ${Math.round((op.index / text.length) * 100)}% in; it leads the file`)
  const body = op[1].replace(COMMENT_RE, '').trim()
  if (body.length > CAPS.operativeChars) fail.push(`${name}: the operative summary is ${body.length} chars, over ${CAPS.operativeChars}`)
  const bullets = body.split(/\r?\n/).filter((l) => /^- /.test(l))
  if (bullets.length < CAPS.bulletsMin || bullets.length > CAPS.bulletsMax) fail.push(`${name}: the operative summary has ${bullets.length} bullets; ${CAPS.bulletsMin} to ${CAPS.bulletsMax}`)
  const own = new Set(headings(text))
  for (const bullet of bullets) {
    // Greedy, so a heading with its own parentheses can be cited.
    const anchor = /\(§ (.+)\)\s*$/.exec(bullet)
    if (!anchor) { fail.push(`${name}: a summary bullet does not end on (§ heading): ${bullet.slice(0, 80)}`); continue }
    for (const h of anchor[1].split(/\s*;\s*§?\s*/)) if (!own.has(h.trim())) fail.push(`${name}: (§ ${h.trim()}) names no heading in the file`)
  }
  return fail
}

/** Pairs past the bar that are not pinned, and pinned pairs that grew. `compare` limits which pairs count. */
function duplicateFailures(skills, known, failAt, compare = () => true) {
  const fail = []
  for (const [pair, { count, sample }] of overlaps(skills)) {
    if (!compare(...pair.split(' + '))) continue
    const pinned = known[pair]
    if (pinned == null && count >= failAt) fail.push(`${pair}: share ${count} nine-word runs ("${sample} …"); one home per lesson: keep it in one file and point the other there`)
    else if (pinned != null && count > pinned) fail.push(`${pair}: share ${count} nine-word runs, up from the pinned ${pinned} ("${sample} …"); a known overlap may shrink, never grow`)
  }
  return fail
}

/** Known pairs that now share fewer runs than their pin. A warning, not a failure: the pin is Eric's to lower. */
export function pinWarnings(skills, known = SHAPE.duplicates.known) {
  const now = overlaps(skills)
  return Object.entries(known).filter(([pair, pinned]) => (now.get(pair)?.count ?? 0) < pinned)
    .map(([pair, pinned]) => `${pair}: now shares ${now.get(pair)?.count ?? 0} nine-word runs, pinned at ${pinned}; lower the pin to ${now.get(pair)?.count ?? 0} in brain-shape.json, Eric's call`)
}

/** Every failure in a record of skill name → markdown. `added` maps a name to the blocks of lines added since `sourcesSince`. */
export function lintBrain(skills, { shape = SHAPE, added = null } = {}) {
  const fail = []
  const router = skills[ROUTER]
  if (!router) return [`${ROUTER}.md is missing: the router is the brain's front door`]

  // 1. The Director card and the router, each under its cap.
  const card = DIRECTOR_RE.exec(router)
  if (!card) fail.push(`${ROUTER}: no <!-- @director:start --> block (the Director card, L0)`)
  else if (words(card[1]) > CAPS.directorWords) fail.push(`${ROUTER}: the Director card is ${words(card[1])} words, over ${CAPS.directorWords}`)
  const routerBody = router.replace(DIRECTOR_RE, '')
  if (words(routerBody) > CAPS.routerWords) fail.push(`${ROUTER}: the router is ${words(routerBody)} words without the card, over ${CAPS.routerWords}`)

  // 2. What the router names exists, and it has both layers.
  const playbooks = sectionNames(router, 'Playbooks')
  const rules = sectionNames(router, 'Rules')
  if (!playbooks.length) fail.push(`${ROUTER}: no playbook under a "## Playbooks" heading`)
  if (!rules.length) fail.push(`${ROUTER}: no rule under a "## Rules" heading`)
  const routed = new Set(named(router))
  for (const name of routed) if (!skills[name]) fail.push(`${ROUTER}: names ${name}, which is not a skill`)

  // 3. Reachable from the router in one hop.
  const reachable = new Set([ROUTER, ...routed])
  for (const name of routed) for (const linked of named(skills[name] ?? '')) reachable.add(linked)
  for (const name of Object.keys(skills)) {
    if (!name.startsWith('slates-prompting-') && !reachable.has(name)) fail.push(`${name}: nothing the router names links it, so no agent finds it by the layers`)
  }

  // 4. An operative summary leads every other file.
  for (const [name, text] of Object.entries(skills)) if (name !== ROUTER) fail.push(...summaryFailures(name, text))

  // 5. The fixed shape.
  for (const name of Object.keys(skills)) {
    const layers = layerOf(shape, name)
    if (layers.length !== 1) fail.push(`${name}: ${layers.length ? `in ${layers.length} layers` : 'in no layer'} of brain-shape.json; a new file is Eric's call, pinned there with his yes`)
  }
  for (const [layer, names] of Object.entries(shape.layers)) for (const name of names) if (!skills[name]) fail.push(`brain-shape.json: ${layer} ${name} is not a skill`)
  const pinnedPlaybooks = new Set(shape.layers.playbook)
  for (const name of playbooks) if (!pinnedPlaybooks.has(name)) fail.push(`${ROUTER}: the Playbooks table lists ${name}, which is not a pinned playbook; a new job is Eric's call`)
  for (const name of pinnedPlaybooks) if (!playbooks.includes(name)) fail.push(`${ROUTER}: the Playbooks table leaves out the pinned playbook ${name}`)
  for (const name of rules) if (!shape.layers.rule.includes(name)) fail.push(`${ROUTER}: the Rules section names ${name}, which is not a pinned rule; a new topic is Eric's call`)

  // 6. Caps on every file and every layer.
  const totals = {}
  for (const [name, text] of Object.entries(skills)) {
    const [layer] = layerOf(shape, name)
    if (!layer || layer === 'router') continue
    const n = words(text)
    totals[layer] = (totals[layer] ?? 0) + n
    const cap = shape.caps.fileWords[layer]
    if (n > cap) fail.push(`${name}: ${n} words, over the ${layer} cap of ${cap}; cut or merge something first`)
  }
  for (const [layer, cap] of Object.entries(shape.caps.layerWords)) {
    if ((totals[layer] ?? 0) > cap) fail.push(`the ${layer} layer: ${totals[layer]} words, over its cap of ${cap}; cut or merge something first`)
  }

  // 7. One home per lesson.
  fail.push(...duplicateFailures(skills, shape.duplicates.known, shape.duplicates.failAt))

  // 8. A source on every new block.
  for (const [name, blocks] of Object.entries(added ?? {})) {
    for (const block of blocks) {
      if (!block.lines.some((l) => SOURCE_RE.test(l))) fail.push(`${name}:${block.start}: ${block.lines.length} new line(s) with no <!-- src: …, YYYY-MM-DD --> ("${block.lines[0].trim().slice(0, 70)}")`)
    }
  }
  return fail
}

/**
 * A user's My brain: what the loader refuses (brain-check.ts myBrainProblems: a summary, the personal caps, one
 * home per lesson among their files and against every bundled skill in `bundled`, a same-name one included,
 * since their file is served with it), then the summary's exact shape and a source on every block.
 */
export function lintMyBrain(files, { shape = SHAPE, bundled = null } = {}) {
  const fail = []
  for (const name of Object.keys(files)) if (name === ROUTER) fail.push(`${name}: the router belongs to the shared brain`)
  const problems = BRAIN_CHECK.myBrainProblems(files, { shape, bundled: bundled ?? {} })
  fail.push(...problems.map((p) => `${p.name}: ${p.reason}`))
  // A file the loader already refuses for its summary is not named twice for the same thing.
  const noSummary = new Set(problems.filter((p) => /summary|@card/.test(p.reason) && !/runs with/.test(p.reason)).map((p) => p.name))
  for (const [name, text] of Object.entries(files)) {
    if (!noSummary.has(name)) fail.push(...summaryFailures(name, text))
    for (const block of blocksOf(text)) {
      if (!block.lines.some((l) => SOURCE_RE.test(l))) fail.push(`${name}:${block.start}: a block with no <!-- src: …, YYYY-MM-DD --> ("${block.lines[0].trim().slice(0, 70)}")`)
    }
  }
  return fail
}

/** A file's paragraphs and bullets that carry a lesson: outside frontmatter, headings, the summary and code. */
function blocksOf(text) {
  const body = text.replace(FRONTMATTER_RE, (m) => '\n'.repeat(m.split('\n').length - 1)).replace(OPERATIVE_RE, (m) => '\n'.repeat(m.split('\n').length - 1))
  const lines = body.split(/\r?\n/)
  const fenced = fenceMap(lines)
  const blocks = []
  let current = null
  lines.forEach((line, i) => {
    if (!fenced[i] && COMMENT_LINE_RE.test(line)) {
      // A source on the line right after a paragraph or bullet is that block's; it closes the block.
      if (current) { current.lines.push(line); blocks.push(current); current = null }
      return
    }
    const lesson = isLesson(line, fenced[i])
    if (!lesson || /^\s*[-*] /.test(line)) { if (current) blocks.push(current); current = null }
    if (lesson) {
      current ??= { start: i + 1, lines: [] }
      current.lines.push(line)
    }
  })
  if (current) blocks.push(current)
  return blocks
}

/**
 * The blocks of lines added to each skill since `since` (working tree against that commit; a new
 * unstaged file counts as wholly added), with lines inside an injected partial left out. A block is a
 * paragraph of added lines: an added run splits at blank lines, so a list with no blank line between
 * its items stays one block, and a source comment on the line right after a paragraph joins it. Runs
 * of only headings, lone comments and code carry no lesson and need no source. Null, with a warning,
 * when git or the commit is not there (a shallow clone): the rest of the lint still runs.
 */
export function addedBlocks(skills, since = SHAPE.sourcesSince, { repo = REPO, path = 'packages/shared/skills' } = {}) {
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 })
  const skillPath = new RegExp(`^${path}/([^/]+)\\.md$`)
  let diff
  let fresh
  try {
    // Prefixes and colour are set here so a user's diff.noprefix, diff.mnemonicPrefix or color.ui cannot change what is parsed.
    diff = git('diff', '--unified=0', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', since, '--', path)
    // `git diff <commit>` leaves untracked files out.
    fresh = git('ls-files', '--others', '--exclude-standard', '-z', '--', path).split('\0').filter(Boolean)
  } catch {
    console.warn(`brain lint: no git history back to ${since}; the source check is skipped`)
    return null
  }
  const texts = { ...skills }
  /** The added runs: the consecutive added lines of a hunk, or the whole of an untracked file. */
  const runs = []
  let name = null
  let inHunk = false
  let lineNo = 0
  let run = null
  const flush = () => { if (run) runs.push(run); run = null }
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) { flush(); name = null; inHunk = false; continue }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (hunk) { flush(); inHunk = true; lineNo = Number(hunk[1]); continue }
    if (!inHunk) { name = skillPath.exec(line.startsWith('+++ b/') ? line.slice(6) : '')?.[1] ?? name; continue }
    if (!name || !line.startsWith('+')) continue
    run ??= { name, start: lineNo, lines: [] }
    run.lines.push(line.slice(1))
    lineNo++
  }
  flush()
  for (const path of fresh) {
    const file = skillPath.exec(path)
    if (!file) continue
    const text = readFileSync(join(repo, path), 'utf8')
    texts[file[1]] = text
    runs.push({ name: file[1], start: 1, lines: text.replace(/\r?\n$/, '').split(/\r?\n/) })
  }

  const out = {}
  for (const { name: skill, start, lines } of runs) {
    const fenced = fenceMap((texts[skill] ?? '').split('\n'))
    let block = null
    const close = () => { if (block?.lesson) (out[skill] ??= []).push({ start: block.start, lines: block.lines }); block = null }
    lines.forEach((line, i) => {
      const at = start + i
      // A blank line ends a paragraph, except inside a code fence.
      if (!line.trim() && !fenced[at - 1]) { close(); return }
      block ??= { start: at, lines: [], lesson: false }
      block.lines.push(line)
      block.lesson ||= isLesson(line, fenced[at - 1] ?? false)
    })
    close()
  }
  // Lines inside an @inject block come from its partial, whose source is the partial's own.
  for (const [skill, blocks] of Object.entries(out)) {
    const text = texts[skill] ?? ''
    const injected = []
    for (const m of text.matchAll(INJECT_RE)) {
      const first = text.slice(0, m.index).split('\n').length
      injected.push([first, first + m[0].split('\n').length - 1])
    }
    // Frontmatter says what the file is for, and a comment inside it breaks the YAML: its source is the commit message.
    const frontmatter = FRONTMATTER_RE.exec(text)?.[0].split('\n').length - 1 || 0
    out[skill] = blocks.filter((b) => b.start > frontmatter && !injected.some(([a, z]) => b.start >= a && b.start + b.lines.length - 1 <= z))
    if (!out[skill].length) delete out[skill]
  }
  return out
}

/** One folder's skills, or with no folder the whole brain: the public card and router plus slates-api brain/. */
export function readSkills(dir) {
  return dir ? readSkillDir(dir) : readAllSkills({ dir: brainOrSkip('brain-lint') })
}

/**
 * The blocks added since each home's own start: this repo's skills since `sourcesSince`, the brain's in slates-api
 * since `brainSourcesSince` (the commit that moved it there, whose blocks this lint had checked here). Null when
 * either history is missing.
 */
function addedSinceBoth(skills) {
  const brain = brainOrSkip('brain-lint')
  const own = addedBlocks(skills)
  const moved = addedBlocks(skills, SHAPE.brainSourcesSince, { repo: dirname(brain), path: basename(brain) })
  return own && moved ? { ...own, ...moved } : null
}

function selfTest(skills) {
  const clean = lintBrain(skills)
  if (clean.length) throw new Error(`self-test needs a clean brain first:\n  ${clean.join('\n  ')}`)
  const anOperative = Object.keys(skills).find((n) => OPERATIVE_RE.test(skills[n]) && !n.startsWith('slates-prompting-'))
  const aPlaybook = sectionNames(skills[ROUTER], 'Playbooks')[0]
  const aRule = SHAPE.layers.rule.find((n) => n !== anOperative)
  const knownPair = Object.keys(SHAPE.duplicates.known)[0]
  const passage = ' Every winning hook names its viewer, promises one concrete payoff and says what the ad is about inside two seconds flat, always.'
  const mutations = [
    ['no router', (s) => { delete s[ROUTER] }, /router is the brain's front door/],
    ['no Director card', (s) => { s[ROUTER] = s[ROUTER].replace(DIRECTOR_RE, '') }, /no <!-- @director:start -->/],
    ['a long Director card', (s) => { s[ROUTER] = s[ROUTER].replace('<!-- @director:end -->', `${' word'.repeat(CAPS.directorWords)}\n<!-- @director:end -->`) }, /Director card is \d+ words/],
    ['a long router', (s) => { s[ROUTER] += ' word'.repeat(CAPS.routerWords) }, /the router is \d+ words/],
    ['a router naming a missing guide', (s) => { s[ROUTER] += '\n`slates-no-such-guide`\n' }, /not a skill/],
    ['an unreachable skill', (s) => { s['slates-orphan'] = s[anOperative] }, /slates-orphan: nothing the router names links it/],
    ['a missing summary', (s) => { s[anOperative] = s[anOperative].replace(OPERATIVE_RE, '') }, /no <!-- @operative:start -->/],
    ['a summary and a card', (s) => { s[anOperative] = s[anOperative].replace('<!-- @operative:start -->', '<!-- @card:start --><!-- @card:end -->\n<!-- @operative:start -->') }, /both an @operative block and a @card/],
    ['an empty card', (s) => { s[anOperative] = s[anOperative].replace(OPERATIVE_RE, '<!-- @card:start -->\n<!-- only a comment -->\n<!-- @card:end -->') }, /the @card is empty/],
    ['a card that never ends', (s) => { s[anOperative] = s[anOperative].replace(OPERATIVE_RE, '<!-- @card:start -->\n- Lever. (§ Hooks)') }, /has no <!-- @card:end -->/],
    ['a dead anchor', (s) => { s[anOperative] = s[anOperative].replace(/\(§ [^)]+\)(\s*\r?\n)/, '(§ No such heading)$1') }, /names no heading/],
    ['a bullet with no anchor', (s) => { s[anOperative] = s[anOperative].replace(/ \(§ [^)]+\)(\s*\r?\n)/, '$1') }, /does not end on \(§ heading\)/],
    ['a long summary', (s) => { s[anOperative] = s[anOperative].replace('<!-- @operative:end -->', `${'x'.repeat(CAPS.operativeChars)}\n<!-- @operative:end -->`) }, /over 1200/],
    ['an unpinned file', (s) => { s['slates-new-topic'] = s[aRule].replace(/name: [^\n]+/, 'name: slates-new-topic'); s[ROUTER] += '\n`slates-new-topic`\n' }, /slates-new-topic: in no layer of brain-shape\.json/],
    ['an unpinned job in the router', (s) => { s[ROUTER] = s[ROUTER].replace('## Playbooks: one per job\n', `## Playbooks: one per job\n\n| A new job | \`${aRule}\` | ? |\n`) }, /not a pinned playbook/],
    ['a long playbook', (s) => { s[aPlaybook] += ' word'.repeat(SHAPE.caps.fileWords.playbook) }, /over the playbook cap/],
    ['a long rule', (s) => { s[aRule] += ' word'.repeat(SHAPE.caps.fileWords.rule) }, /over the rule cap/],
    ['a layer over its cap', (s) => { for (const n of SHAPE.layers.rule) s[n] += ' word'.repeat(Math.ceil(SHAPE.caps.layerWords.rule / SHAPE.layers.rule.length / 2)) }, /the rule layer: \d+ words, over its cap/],
    ['a lesson in two homes', (s) => { s[aPlaybook] += `\n${passage}\n`; s[aRule] += `\n${passage}\n` }, /share \d+ nine-word runs \(/],
    ...(knownPair ? [['a known overlap that grows', (s) => { const [a, b] = knownPair.split(' + '); s[a] += `\n${passage}\n`; s[b] += `\n${passage}\n` }, /up from the pinned/]] : []),
  ]
  for (const [label, mutate, expected] of mutations) {
    const copy = { ...skills }
    mutate(copy)
    const found = lintBrain(copy)
    if (!found.some((f) => expected.test(f))) throw new Error(`self-test: ${label} was not caught (got: ${found.join(' | ') || 'nothing'})`)
  }
  // The source rule, on a synthetic diff and on a My brain.
  const unsourced = lintBrain(skills, { added: { [aRule]: [{ start: 9, lines: ['- A new rule with nowhere it came from.'] }] } })
  if (!unsourced.some((f) => /no <!-- src:/.test(f))) throw new Error('self-test: a new block with no source was not caught')
  const sourced = lintBrain(skills, { added: { [aRule]: [{ start: 9, lines: ['- A new rule. <!-- src: correction, 2026-10-25 -->'] }] } })
  if (sourced.length) throw new Error(`self-test: a sourced block was refused: ${sourced.join(' | ')}`)
  const mine = (body) => `---\nname: tight-hooks\ndescription: "Tight hooks."\n---\n\n# Tight hooks\n\n<!-- @operative:start -->\n**Operative summary.**\n- Cut hooks short. (§ Hooks)\n- Never a slow zoom. (§ Hooks)\n<!-- @operative:end -->\n\n## Hooks\n\n${body}\n`
  const goodMine = mine('- Cut every hook to its first word. <!-- src: correction on take 3, 2026-10-25 -->')
  if (lintMyBrain({ 'tight-hooks': goodMine }).length) throw new Error(`self-test: a clean My brain was refused: ${lintMyBrain({ 'tight-hooks': goodMine }).join(' | ')}`)
  const bundledHooks = { 'slates-cuts': mine(`- ${passage} <!-- src: y, 2026-10-25 -->`).replace('name: tight-hooks', 'name: slates-cuts') }
  const myMutations = [
    ['a My brain line with no source', { 'tight-hooks': mine('- Cut every hook to its first word.') }, /a block with no <!-- src:/],
    ['a My brain source with no text', { 'tight-hooks': mine('- Cut every hook to its first word. <!-- src: , 2026-10-25 -->') }, /a block with no <!-- src:/],
    ['a My brain file over its cap', { 'tight-hooks': mine(`- Cut. <!-- src: x, 2026-10-25 -->${' word'.repeat(SHAPE.caps.mine.fileWords)}`) }, /over My brain's file cap/],
    ['a My brain file with an empty summary', { 'tight-hooks': goodMine.replace(OPERATIVE_RE, '<!-- @operative:start -->\n<!-- @operative:end -->') }, /the operative summary is empty/],
    ['a My brain lesson in two files', { 'tight-hooks': mine(`- ${passage} <!-- src: x, 2026-10-25 -->`), 'hooks-again': mine(`- ${passage} <!-- src: y, 2026-10-25 -->`).replace('name: tight-hooks', 'name: hooks-again') }, /tight-hooks: shares \d+ \d+-word runs with their hooks-again/],
    ['a My brain lesson copied from a bundled skill', { 'tight-hooks': mine(`- ${passage} <!-- src: x, 2026-10-25 -->`) }, /tight-hooks: shares \d+ \d+-word runs with the shared slates-cuts/, { bundled: bundledHooks }],
    // A same-name file is served with the shared guide (my-brain.ts), so what it copies from it is served twice.
    ['a file over the bundled guide it copies', { 'slates-cuts': mine(`- ${passage} <!-- src: x, 2026-10-25 -->`).replace('name: tight-hooks', 'name: slates-cuts') }, /slates-cuts: shares \d+ \d+-word runs with the shared slates-cuts .*keep only what differs/, { bundled: bundledHooks }],
    ['a My brain folder over its cap', Object.fromEntries(Array.from({ length: Math.ceil(SHAPE.caps.mine.layerWords / (SHAPE.caps.mine.fileWords - 20)) + 1 }, (_, i) => [`notes-${i}`, mine(`- Note. <!-- src: x, 2026-10-25 -->${Array.from({ length: SHAPE.caps.mine.fileWords - 40 }, (_, j) => ` n${i}w${j}`).join('')}`).replace('name: tight-hooks', `name: notes-${i}`)])), /over its cap of \d+; consolidate first/],
    ['a My brain router', { [ROUTER]: goodMine.replace('name: tight-hooks', `name: ${ROUTER}`) }, /router belongs to the shared brain/],
    ['an empty My brain card', { 'tight-hooks': goodMine.replace(OPERATIVE_RE, '<!-- @card:start -->\n<!-- @card:end -->') }, /the @card is empty/],
    ['a source after a second paragraph', { 'tight-hooks': mine('First lesson.\n<!-- src: x, 2026-10-25 -->\nSecond lesson with none.') }, /a block with no <!-- src:.*Second lesson/],
  ]
  for (const [label, files, expected, options] of myMutations) {
    const found = lintMyBrain(files, options)
    if (!found.some((f) => expected.test(f))) throw new Error(`self-test: ${label} was not caught (got: ${found.join(' | ') || 'nothing'})`)
  }
  // What must stay clean: a source on the next line, a code fence, a file over a bundled guide that adds its own
  // rules, and words in comments and frontmatter, which no agent reads and no cap counts.
  const asCuts = (text) => text.replace('name: tight-hooks', 'name: slates-cuts')
  const myClean = [
    ['a source on the line after a bullet', { 'tight-hooks': mine('- Cut every hook to its first word.\n<!-- src: correction, 2026-10-25 -->\n- Never a slow zoom. <!-- src: take 3, 2026-10-25 -->') }],
    ['a source on the line after a paragraph', { 'tight-hooks': mine('Cut every hook to its first word.\n<!-- src: correction, 2026-10-25 -->') }],
    ['a code fence', { 'tight-hooks': mine(`- Use this, and keep it short.${' Pad.'.repeat(60)} <!-- src: x, 2026-10-25 -->\n\n\`\`\`\nsome code\n\`\`\``) }],
    ['a file over a bundled guide with rules of its own', { 'slates-cuts': asCuts(mine(`- Cut every hook to its first word.${' Pad.'.repeat(60)} <!-- src: x, 2026-10-25 -->`)) }, { bundled: bundledHooks }],
    ['a file at its cap once comments are left out', { 'tight-hooks': mine(`- Cut. <!-- src: x, 2026-10-25 --><!--${' word'.repeat(SHAPE.caps.mine.fileWords)} -->`) }],
  ]
  for (const [label, files, options] of myClean) {
    const found = lintMyBrain(files, options)
    if (found.length) throw new Error(`self-test: ${label} was refused: ${found.join(' | ')}`)
  }
  // The source comment's shape.
  for (const [comment, ok] of [
    ['<!-- src: Eric, 2026-10-25: the brain should know -->', true],
    ['<!-- src: routing eval misses on Haiku and Sonnet, 2026-10-25 -->', true],
    ['<!-- src: a > b in the text, 2026-10-25 -->', true],
    ['<!-- src: , 2026-10-25 -->', false],
    ['<!-- src:  2026-10-25 -->', false],
    ['<!-- src: no date -->', false],
    ['<!-- src: x --> and 2026-10-25 -->', false],
  ]) if (SOURCE_RE.test(comment) !== ok) throw new Error(`self-test: ${comment} should ${ok ? '' : 'not '}count as a source`)
  // Pins tighten: a pinned count above the current one is named.
  if (pinWarnings(skills).length) throw new Error(`self-test: a pin above the current count on a clean brain: ${pinWarnings(skills).join(' | ')}`)
  if (knownPair) {
    const now = overlaps(skills).get(knownPair).count
    const warned = pinWarnings(skills, { [knownPair]: now + 3 })
    if (warned.length !== 1 || !warned[0].includes(knownPair) || !warned[0].includes(`lower the pin to ${now} in brain-shape.json`)) throw new Error(`self-test: a loose pin was not named (got: ${warned.join(' | ') || 'nothing'})`)
  }
  const gitCases = sourceCheckInTempRepo()
  console.log(`brain-lint self-test: ${mutations.length + 1 + myMutations.length + myClean.length} mutations and clean cases, each caught or kept${gitCases ? `; the source check on a real diff, ${gitCases} git settings` : '; no git, so the source check on a real diff was skipped'}`)
}

/**
 * The source check against a real diff in a throwaway repo: paragraphs split, a list stays one block,
 * a comment on the next line counts, a new unstaged file is checked, and the user's diff prefix
 * settings change nothing. Returns the number of git settings tried, or 0 without git.
 */
function sourceCheckInTempRepo() {
  const root = mkdtempSync(join(tmpdir(), 'brain-lint-src-'))
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    try { git('init', '-q') } catch { return 0 }
    const dir = join(root, 'packages', 'shared', 'skills')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'a.md'), '# A\n\nOld paragraph.\n')
    git('add', '.')
    git('-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'base')
    writeFileSync(join(dir, 'a.md'), [
      '# A', '', 'Old paragraph.', '',
      'One. <!-- src: inline, 2026-10-25 -->', '',
      'Two has no source.', '',
      '- item one', '- item two <!-- src: the list shares it, 2026-10-25 -->', '',
      'Three', '<!-- src: on its own next line, 2026-10-25 -->', '',
      'Four has none either.', 'Its second line.', '',
      '## A heading needs none', '',
      '```', 'code', '', 'more code', '```', '',
    ].join('\n'))
    writeFileSync(join(dir, 'b.md'), '# B\n\nA brand-new unstaged file, no source.\n\nAnd one with. <!-- src: x, 2026-10-25 -->\n')
    const unsourced = () => Object.entries(addedBlocks(readSkills(dir), 'HEAD', { repo: root }) ?? {})
      .flatMap(([name, blocks]) => blocks.filter((b) => !b.lines.some((l) => SOURCE_RE.test(l))).map((b) => `${name}:${b.lines[0]}`))
    const want = ['a:Two has no source.', 'a:Four has none either.', 'b:A brand-new unstaged file, no source.']
    let tried = 0
    for (const setting of [[], ['diff.noprefix', 'true'], ['diff.mnemonicPrefix', 'true'], ['color.diff', 'always']]) {
      if (setting.length) git('config', ...setting)
      const found = unsourced()
      if (JSON.stringify(found) !== JSON.stringify(want)) throw new Error(`self-test: the source check with ${setting.join('=') || 'default git settings'} found ${JSON.stringify(found)}, wanted ${JSON.stringify(want)}`)
      tried++
    }
    return tried
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function measure(skills) {
  const totals = {}
  for (const [name, text] of Object.entries(skills)) {
    const [layer] = layerOf(SHAPE, name)
    if (layer && layer !== 'router') totals[layer] = (totals[layer] ?? 0) + words(text)
  }
  const pairs = Object.fromEntries([...overlaps(skills)].sort((a, b) => b[1].count - a[1].count).map(([pair, { count }]) => [pair, count]))
  console.log(JSON.stringify({ layerWords: totals, overlaps: pairs }, null, 2))
}

function main() {
  const rootArg = process.argv.indexOf('--root')
  if (rootArg > 0) {
    const dir = resolve(process.argv[rootArg + 1] ?? '')
    const files = readSkills(dir)
    const failures = process.argv.includes('--mine') ? lintMyBrain(files, { bundled: readSkills() }) : lintBrain(files)
    if (failures.length) { console.error(`brain lint (${dir}): ${failures.length} problem(s):\n  ${failures.join('\n  ')}`); process.exit(1) }
    console.log(`✓ brain lint (${dir}): ${Object.keys(files).length} files`)
    return
  }
  const skills = readSkills()
  if (process.argv.includes('--measure')) return measure(skills)
  const added = addedSinceBoth(skills)
  const failures = lintBrain(skills, { added })
  for (const warning of pinWarnings(skills)) console.warn(`brain lint warning: ${warning}`)
  if (failures.length) {
    console.error(`brain lint: ${failures.length} problem(s):\n  ${failures.join('\n  ')}`)
    process.exit(1)
  }
  if (process.argv.includes('--self-test')) selfTest(skills)
  const ops = Object.values(skills).filter((t) => OPERATIVE_RE.test(t)).length
  const cards = Object.values(skills).filter((t) => CARD_START_RE.test(t)).length
  const known = Object.keys(SHAPE.duplicates.known).length
  console.log(`✓ brain lint: ${Object.keys(skills).length} files in their pinned layers; router ${words(skills[ROUTER].replace(DIRECTOR_RE, ''))} words, Director card ${words(DIRECTOR_RE.exec(skills[ROUTER])[1])}; ${ops} operative summaries, ${cards} craft cards; every file and layer under its cap; no new shared passage (${known} known overlaps pinned); ${added ? `every block added since ${SHAPE.sourcesSince} here and ${SHAPE.brainSourcesSince} in the brain sourced` : 'sources not checked'}`)
}

// Run as a script, not when another check imports the parser.
if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) main()
