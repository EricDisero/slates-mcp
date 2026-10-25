#!/usr/bin/env node
// What one job costs in brain (second-brain plans/2026-10-25-slates-brain.md § Step 3): the
// target is a whole job under about 15,000 tokens. Per playbook the router names, the path an
// agent reads by the layers is
//
//   the Director card + the router + the playbook, whole, as the guide op serves it at its default
//     depth (retrieveGuide serves every playbook pinned in brain-shape.json whole)
//   + the summary of every guide the playbook names (its @operative block, or a model guide's @card)
//   + one model guide's card (the guide gate makes the agent read one before its first generation;
//     the largest card is counted)
//
// and the ceiling, reported beside it, is every named guide read whole. Tokens are characters / 4,
// the usual English estimate; this compares jobs and catches growth, it is not a bill. Reads the
// markdown directly and serves each playbook through the built package's retrieveGuide, so build
// shared first. Fails when a job's path is over the target, or when the default depth stops serving
// a playbook whole or starts serving a rule whole.
//
//   node scripts/brain-eval/tokens.mjs [--json]     (part of npm run check:brain)
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROUTER, SHAPE, readSkills } from '../brain-lint.mjs'

export const TARGET_TOKENS = 15_000

/**
 * The built package's guide retrieval: `served` is what the guide op returns for a bundled guide asked for by
 * name, with no depth or query. Loaded only when this runs as a script, so routing.mjs can import brainLayers
 * without a build.
 */
async function loadRetrieval() {
  const dist = join(import.meta.dirname, '..', '..', 'packages', 'shared', 'dist')
  if (!existsSync(join(dist, 'prompts', 'guide-retrieval.js'))) {
    console.error('✗ brain tokens: packages/shared/dist is missing; build shared first (npm run build -w packages/shared)')
    process.exit(1)
  }
  const { retrieveGuide } = await import(pathToFileURL(join(dist, 'prompts', 'guide-retrieval.js')).href)
  const { BRAIN_SHAPE } = await import(pathToFileURL(join(dist, 'skills', 'content.js')).href)
  return { retrieveGuide, shape: BRAIN_SHAPE, served: (name, text) => retrieveGuide(name, text, 'card') }
}

/**
 * Where the default depth serves a file whole and where it should not: every pinned playbook whole (the
 * Director card says to follow its steps), every rule and model guide at its card. Empty when it holds.
 */
export function depthFailures(skills, { retrieveGuide, shape, served }) {
  const fail = []
  // The built package embeds brain-shape.json at its build; another shape here means it is measuring another brain.
  if (JSON.stringify(shape.layers) !== JSON.stringify(SHAPE.layers)) fail.push('the built package carries another brain-shape.json; rebuild shared')
  for (const name of SHAPE.layers.playbook) {
    if (skills[name] && served(name, skills[name]) !== retrieveGuide(name, skills[name], 'full')) fail.push(`${name}: a playbook served as its summary at the default depth, not whole`)
  }
  for (const name of [...SHAPE.layers.rule, ...SHAPE.layers.model]) {
    if (skills[name] && served(name, skills[name]) === retrieveGuide(name, skills[name], 'full')) fail.push(`${name}: a ${SHAPE.layers.rule.includes(name) ? 'rule' : 'model guide'} served whole at the default depth, not at its card`)
  }
  return fail
}

const COMMENT_RE = /<!--[\s\S]*?-->/g
const FRONTMATTER_RE = /^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/
const DIRECTOR_RE = /<!--\s*@director:start\s*-->([\s\S]*?)<!--\s*@director:end\s*-->/
const OPERATIVE_RE = /<!--\s*@operative:start\s*-->([\s\S]*?)<!--\s*@operative:end\s*-->/
const CARD_RE = /<!--\s*@card:start\s*-->([\s\S]*?)<!--\s*@card:end\s*-->/

const tokens = (text) => Math.round(text.length / 4)
const clean = (text) => text.replace(FRONTMATTER_RE, '').replace(COMMENT_RE, '').replace(/\n{3,}/g, '\n\n').trim()
const summary = (text) => (OPERATIVE_RE.exec(text) ?? CARD_RE.exec(text))?.[1].replace(COMMENT_RE, '').trim() ?? ''
const named = (text) => [...new Set([...clean(text).matchAll(/`(slates-[a-z0-9]+(?:-[a-z0-9]+)*)`/g)].map((m) => m[1]))]

/** The Director card and the router body, cut the way packages/shared/src/prompts/brain.ts cuts them. */
export function brainLayers(skills) {
  const router = skills[ROUTER]
  return {
    card: DIRECTOR_RE.exec(router)[1].replace(COMMENT_RE, '').trim(),
    routerBody: router.replace(FRONTMATTER_RE, '').replace(DIRECTOR_RE, '').replace(COMMENT_RE, '').replace(/^\s*# [^\n]*\n/, '').trim(),
  }
}

/** `served(name, text)`: the playbook as the guide op returns it at its default depth (loadRetrieval). */
export function jobCosts(skills, served) {
  const router = skills[ROUTER]
  const { card, routerBody } = brainLayers(skills)
  // The section runs to the next heading or, when it is the router's last, to the end of the file.
  const playbooks = named(/^## Playbooks[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(router)?.[1] ?? '').filter((n) => skills[n])
  const modelCards = Object.entries(skills).filter(([n]) => n.startsWith('slates-prompting-')).map(([n, t]) => ({ name: n, tokens: tokens(summary(t)) }))
  const modelCard = modelCards.sort((a, b) => b.tokens - a.tokens)[0] ?? { name: null, tokens: 0 }
  const base = tokens(card) + tokens(routerBody)
  return playbooks.map((name) => {
    const linked = named(skills[name]).filter((n) => n !== name && n !== ROUTER && skills[n] && !n.startsWith('slates-prompting-'))
    const playbook = tokens(served(name, skills[name]))
    const summaries = linked.reduce((s, n) => s + tokens(summary(skills[n])), 0)
    const whole = linked.reduce((s, n) => s + tokens(clean(skills[n])), 0)
    return { playbook: name, linked: linked.length, path: base + playbook + summaries + modelCard.tokens, ceiling: base + playbook + whole + modelCard.tokens }
  }).concat([{ playbook: '(base: card + router)', linked: 0, path: base, ceiling: base, modelCard: modelCard.name }])
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  const skills = readSkills()
  const retrieval = await loadRetrieval()
  const rows = jobCosts(skills, retrieval.served)
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2))
  const over = rows.filter((r) => r.path > TARGET_TOKENS)
  const worst = rows.reduce((a, b) => (b.path > a.path ? b : a))
  const depth = depthFailures(skills, retrieval)
  if (over.length || depth.length) {
    for (const r of over) console.error(`✗ ${r.playbook}: ${r.path} tokens by the layers, over ${TARGET_TOKENS}`)
    for (const f of depth) console.error(`✗ ${f}`)
    process.exit(1)
  }
  console.log(`✓ brain tokens: ${rows.length - 1} jobs, each under ${TARGET_TOKENS} by the layers, every playbook served whole at the default depth and every rule and model guide at its card; the largest ${worst.playbook} at ${worst.path} (every linked guide whole: ${worst.ceiling})`)
}
