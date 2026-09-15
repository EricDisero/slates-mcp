#!/usr/bin/env node
// Cinematic catalogue parity — the skill owns the techniques, the vault owns the evidence.
//
// THE CONTRACT. `packages/shared/skills/slates-cinematic-look.md` is the one home
// of every technique's WORDING. The vault's
// `business/projects/slates/research/cinematic-look-research.md` is the one home
// of every technique's EVIDENCE and of the verbatim test prompts. Neither
// restates the other's prose; they share only a technique id, its evidence tag
// and the worked-example prompts, and this check fails when any of those differ:
//
//   1. the id sets inside the two `@catalogue` blocks match, both directions
//   2. every id carries the same evidence tag in both files
//   3. every tag is one of the five the skill defines
//   4. every `@example:<name>` block in the skill is byte-identical (after line
//      endings and outer whitespace) to the same block in the research doc
//
// Why a gate and not a generator: the two files serve two audiences (an agent
// choosing wording, a person weighing evidence), so neither can be derived from
// the other without losing one of them. The prompting SSOT law is "derive it, or
// add the gate that fails when the copies diverge" — this is the second half.
//
// The vault is a SIBLING of this workspace and absent on a build box, so the
// cross-file half skips with a warning exactly like slate's check:shot-list.
// The skill's own shape is checked every run, vault or not.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..')
const SKILL = join(repo, 'packages', 'shared', 'skills', 'slates-cinematic-look.md')
const RESEARCH = resolve(
  repo,
  '../../second-brain/business/projects/slates/research/cinematic-look-research.md'
)
const TAGS = new Set(['receipt', 'vendor', 'practitioner', 'canon', 'untested'])

const failures = []
const fail = (msg) => failures.push(msg)

function read(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
}

function between(text, start, end, label) {
  const a = text.indexOf(start)
  const b = text.indexOf(end)
  if (a === -1 || b === -1 || b < a) {
    fail(`${label}: missing or misordered ${start} … ${end}`)
    return ''
  }
  return text.slice(a + start.length, b)
}

/** id → tag for every `| \`id\` | tag |` row inside the @catalogue block. */
function catalogue(text, label) {
  const body = between(text, '<!-- @catalogue:start -->', '<!-- @catalogue:end -->', label)
  const rows = new Map()
  for (const line of body.split('\n')) {
    const m = /^\|\s*`([a-z0-9][a-z0-9-]*)`\s*\|\s*([a-z]+)\s*\|/.exec(line)
    if (!m) continue
    const [, id, tag] = m
    if (rows.has(id)) fail(`${label}: technique \`${id}\` is listed twice`)
    if (!TAGS.has(tag)) fail(`${label}: \`${id}\` has evidence tag "${tag}", not one of ${[...TAGS].join(' / ')}`)
    rows.set(id, tag)
  }
  if (rows.size === 0) fail(`${label}: the @catalogue block holds no technique rows`)
  return rows
}

/** name → fenced text for every @example block. */
function examples(text, label) {
  const out = new Map()
  const re = /<!-- @example:([a-z0-9-]+):start -->([\s\S]*?)<!-- @example:\1:end -->/g
  let m
  while ((m = re.exec(text)) !== null) {
    const fence = /```text\n([\s\S]*?)\n```/.exec(m[2])
    if (!fence) {
      fail(`${label}: @example:${m[1]} holds no \`\`\`text block`)
      continue
    }
    out.set(m[1], fence[1].trim())
  }
  return out
}

const skillText = read(SKILL)
const skillRows = catalogue(skillText, 'slates-cinematic-look.md')
const skillExamples = examples(skillText, 'slates-cinematic-look.md')
if (skillExamples.size === 0) fail('slates-cinematic-look.md: no @example blocks — the worked examples are part of the contract')

let compared = false
if (!existsSync(RESEARCH)) {
  console.warn(`[cinematic-catalogue] ⚠️  research doc not on disk — cross-file parity SKIPPED (${RESEARCH})`)
} else {
  compared = true
  const researchText = read(RESEARCH)
  const researchRows = catalogue(researchText, 'cinematic-look-research.md')
  const researchExamples = examples(researchText, 'cinematic-look-research.md')

  for (const [id, tag] of skillRows) {
    if (!researchRows.has(id)) {
      fail(`\`${id}\` is in the skill but has no evidence row in the research doc — record the evidence first`)
    } else if (researchRows.get(id) !== tag) {
      fail(`\`${id}\` is tagged "${tag}" in the skill and "${researchRows.get(id)}" in the research doc`)
    }
  }
  for (const id of researchRows.keys()) {
    if (!skillRows.has(id)) fail(`\`${id}\` has evidence in the research doc but no row in the skill`)
  }
  for (const [name, body] of skillExamples) {
    if (!researchExamples.has(name)) {
      fail(`@example:${name} is in the skill but not in the research doc`)
    } else if (researchExamples.get(name) !== body) {
      fail(`@example:${name} differs between the skill and the research doc — the prompt that ran is the one that counts`)
    }
  }
  for (const name of researchExamples.keys()) {
    if (!skillExamples.has(name)) fail(`@example:${name} is in the research doc but not in the skill`)
  }
}

if (failures.length > 0) {
  console.error('[cinematic-catalogue] FAILED')
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

const counts = [...TAGS].map((t) => `${[...skillRows.values()].filter((v) => v === t).length} ${t}`).join(', ')
console.log(
  `[cinematic-catalogue] ok — ${skillRows.size} techniques (${counts}), ${skillExamples.size} worked examples` +
    (compared ? ', skill and research doc agree' : ', skill shape only')
)
