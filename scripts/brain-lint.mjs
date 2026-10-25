#!/usr/bin/env node
// The brain's shape (second-brain plans/2026-10-25-slates-brain.md § The shape). The skills are one
// layered brain: the Director card (L0) and the router (L1) in `slates-start-here`, a playbook per
// job (L2), the rules and model guides they link (L3). An agent reads a few hundred words to know
// where to go, so the layers only work while each one stays its size and every file says what it
// holds at its top. This checks that, reading the markdown directly (no build needed):
//
//   1. the router exists, carries the Director card, and both are under their word caps;
//   2. every guide the router names exists, and it lists at least one playbook and one rule;
//   3. every skill is reachable: named by the router, or by a file the router names. Per-model
//      guides are exempt, since the model id resolves to them in code and the guide gate makes
//      the agent read one before its model's first generation;
//   4. every other file leads with an operative summary: an @operative block (or, on a per-model
//      guide or another file with a craft card, the @card, never both), before its first section,
//      under its cap, two to seven bullets, each ending on (§ heading) for headings that exist;
//   5. every playbook is under its word cap.
//
// The serving-provider and raw-rate check is skill-copy-check.mjs, run beside this (check:brain).
//
//   node scripts/brain-lint.mjs [--self-test]     (part of npm run build)
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SKILLS_DIR = join(import.meta.dirname, '..', 'packages', 'shared', 'skills')
export const ROUTER = 'slates-start-here'
export const CAPS = { directorWords: 300, routerWords: 800, playbookWords: 2500, operativeChars: 1200, bulletsMin: 2, bulletsMax: 7 }

const OPERATIVE_RE = /<!--\s*@operative:start\s*-->([\s\S]*?)<!--\s*@operative:end\s*-->/
const CARD_RE = /<!--\s*@card:start\s*-->/
const DIRECTOR_RE = /<!--\s*@director:start\s*-->([\s\S]*?)<!--\s*@director:end\s*-->/
const COMMENT_RE = /<!--[\s\S]*?-->/g
const FRONTMATTER_RE = /^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/

const prose = (text) => text.replace(COMMENT_RE, '').replace(FRONTMATTER_RE, '')
export const words = (text) => prose(text).split(/\s+/).filter((w) => w && !/^[|:\-#*>]+$/.test(w)).length
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

/** Every failure in a record of skill name → markdown. */
export function lintBrain(skills) {
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
  for (const [name, text] of Object.entries(skills)) {
    if (name === ROUTER) continue
    const op = OPERATIVE_RE.exec(text)
    const hasCard = CARD_RE.test(text)
    if (op && hasCard) { fail.push(`${name}: carries both an @operative block and a @card; the card is its summary, keep one`); continue }
    if (!op) {
      if (!hasCard) fail.push(`${name}: no <!-- @operative:start --> block leading the file`)
      continue
    }
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
  }

  // 5. Playbooks stay readable whole.
  for (const name of playbooks) {
    if (skills[name] && words(skills[name]) > CAPS.playbookWords) fail.push(`${name}: the playbook is ${words(skills[name])} words, over ${CAPS.playbookWords}`)
  }
  return fail
}

export function readSkills(dir = SKILLS_DIR) {
  return Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => [f.slice(0, -3), readFileSync(join(dir, f), 'utf8')]))
}

function selfTest(skills) {
  const clean = lintBrain(skills)
  if (clean.length) throw new Error(`self-test needs a clean brain first:\n  ${clean.join('\n  ')}`)
  const anOperative = Object.keys(skills).find((n) => OPERATIVE_RE.test(skills[n]) && !n.startsWith('slates-prompting-'))
  const aPlaybook = sectionNames(skills[ROUTER], 'Playbooks')[0]
  const mutations = [
    ['no router', (s) => { delete s[ROUTER] }, /router is the brain's front door/],
    ['no Director card', (s) => { s[ROUTER] = s[ROUTER].replace(DIRECTOR_RE, '') }, /no <!-- @director:start -->/],
    ['a long Director card', (s) => { s[ROUTER] = s[ROUTER].replace('<!-- @director:end -->', `${' word'.repeat(CAPS.directorWords)}\n<!-- @director:end -->`) }, /Director card is \d+ words/],
    ['a long router', (s) => { s[ROUTER] += ' word'.repeat(CAPS.routerWords) }, /the router is \d+ words/],
    ['a router naming a missing guide', (s) => { s[ROUTER] += '\n`slates-no-such-guide`\n' }, /not a skill/],
    ['an unreachable skill', (s) => { s['slates-orphan'] = s[anOperative] }, /slates-orphan: nothing the router names links it/],
    ['a missing summary', (s) => { s[anOperative] = s[anOperative].replace(OPERATIVE_RE, '') }, /no <!-- @operative:start -->/],
    ['a summary and a card', (s) => { s[anOperative] = s[anOperative].replace('<!-- @operative:start -->', '<!-- @card:start --><!-- @card:end -->\n<!-- @operative:start -->') }, /both an @operative block and a @card/],
    ['a dead anchor', (s) => { s[anOperative] = s[anOperative].replace(/\(§ [^)]+\)(\s*\r?\n)/, '(§ No such heading)$1') }, /names no heading/],
    ['a bullet with no anchor', (s) => { s[anOperative] = s[anOperative].replace(/ \(§ [^)]+\)(\s*\r?\n)/, '$1') }, /does not end on \(§ heading\)/],
    ['a long summary', (s) => { s[anOperative] = s[anOperative].replace('<!-- @operative:end -->', `${'x'.repeat(CAPS.operativeChars)}\n<!-- @operative:end -->`) }, /over 1200/],
    ['a long playbook', (s) => { s[aPlaybook] += ' word'.repeat(CAPS.playbookWords) }, /the playbook is \d+ words/],
  ]
  for (const [label, mutate, expected] of mutations) {
    const copy = { ...skills }
    mutate(copy)
    const found = lintBrain(copy)
    if (!found.some((f) => expected.test(f))) throw new Error(`self-test: ${label} was not caught (got: ${found.join(' | ') || 'nothing'})`)
  }
  console.log(`brain-lint self-test: ${mutations.length} mutations, each caught`)
}

const skills = readSkills()
const failures = lintBrain(skills)
if (failures.length) {
  console.error(`brain lint: ${failures.length} problem(s):\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
if (process.argv.includes('--self-test')) selfTest(skills)
const ops = Object.values(skills).filter((t) => OPERATIVE_RE.test(t)).length
const cards = Object.values(skills).filter((t) => CARD_RE.test(t)).length
console.log(`✓ brain lint: ${Object.keys(skills).length} files; router ${words(skills[ROUTER].replace(DIRECTOR_RE, ''))} words, Director card ${words(DIRECTOR_RE.exec(skills[ROUTER])[1])}; ${ops} operative summaries, ${cards} craft cards`)
