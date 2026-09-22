#!/usr/bin/env node
// Script-craft provenance: the shipped skill and presets own the runtime wording,
// the vault owns the evidence. They share only keys, and this gate fails when a
// key drifts:
//
//   1. the skill's `@evidence` marker lists exactly the technique ids in its table
//   2. every ad preset names only catalogued techniques, and preset ids are unique
//   3. the vault's findings carry the same catalogue id and the same ids, both in
//      their marker and in their technique table
//   4. the vault's preset specifications list exactly the shipped presets, each
//      with the same techniques, a readiness note, and evidence ads that exist in
//      the generated source inventory
//   5. the free/paid boundary: no paid pack skill ships in the public package,
//      and neither the craft skill nor a preset names a vault path
//
// Why a gate and not a generator: the skill is written for an agent choosing
// wording and the findings for a person weighing evidence, so neither derives
// from the other. The vault is a sibling of this workspace and absent on a build
// box, so steps 3 and 4 skip with a warning; 1, 2 and 5 run every time.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..')
const SKILLS = join(repo, 'packages', 'shared', 'skills')
const SKILL = join(SKILLS, 'slates-script-craft.md')
const PACK = join(repo, 'pack-skills')
const RESEARCH = resolve(repo, '../../second-brain/business/projects/slates/research/script-craft')

const failures = []
const fail = (msg) => failures.push(msg)
const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
const same = (a, b) => [...a].sort().join() === [...b].sort().join()
/** `<!-- @evidence: <catalogue> <id> <id> … -->` */
const marker = (text, label) => {
  const m = text.match(/<!-- @evidence: (\S+) ([^>]*?) -->/)
  if (!m) { fail(`${label}: no @evidence marker`); return { catalogue: null, ids: [] } }
  return { catalogue: m[1], ids: m[2].trim().split(/\s+/) }
}
/** Technique ids a table defines: rows that open with `| sc-… |` or `` | `sc-…` | ``. */
const tableIds = (text) => [...text.matchAll(/^\|\s*`?(sc-[a-z-]+)`?\s*\|/gm)].map((m) => m[1])

// 1. The skill agrees with itself.
const skill = read(SKILL)
const shipped = marker(skill, 'slates-script-craft.md')
const skillTable = tableIds(skill)
if (!same(shipped.ids, skillTable)) fail(`skill marker ${shipped.ids.join(' ')} differs from its table ${skillTable.join(' ')}`)

// 2. Presets cite catalogued techniques.
const { AD_PRESETS } = await import(pathToFileURL(join(repo, 'packages', 'shared', 'dist', 'prompts', 'ad-presets.js')).href)
const ids = AD_PRESETS.map((p) => p.id)
if (new Set(ids).size !== ids.length) fail(`duplicate preset ids: ${ids.join(' ')}`)
for (const preset of AD_PRESETS) {
  const unknown = preset.techniques.filter((t) => !shipped.ids.includes(t))
  if (unknown.length) fail(`${preset.id}: techniques not in the catalogue: ${unknown.join(' ')}`)
}

// 5. The free/paid boundary, and no vault path in anything that ships.
const pack = existsSync(PACK) ? readdirSync(PACK).filter((f) => f.endsWith('.md')) : []
const free = readdirSync(SKILLS).filter((f) => f.endsWith('.md'))
for (const name of pack) if (free.includes(name)) fail(`paid pack skill ${name} is also in the public skills folder`)
// The craft this gate covers ships with keys only; the evidence stays private.
const vaultPath = /second-brain|ad-research\.db|business\/projects\//
if (vaultPath.test(skill)) fail('slates-script-craft.md names a vault path')
if (vaultPath.test(JSON.stringify(AD_PRESETS))) fail('an ad preset names a vault path')

// 3 and 4. The vault's evidence, when the vault is on disk.
if (!existsSync(RESEARCH)) {
  console.warn(`script-craft-provenance: vault not found at ${RESEARCH}; the evidence half is skipped`)
} else {
  const findings = read(join(RESEARCH, 'findings.md'))
  const evidence = marker(findings, 'findings.md')
  if (evidence.catalogue !== shipped.catalogue) fail(`catalogue ids differ: skill ${shipped.catalogue}, findings ${evidence.catalogue}`)
  if (!same(evidence.ids, shipped.ids)) fail(`findings marker ${evidence.ids.join(' ')} differs from the skill ${shipped.ids.join(' ')}`)
  if (!same(tableIds(findings), shipped.ids)) fail(`findings table ${tableIds(findings).join(' ')} differs from the skill ${shipped.ids.join(' ')}`)
  const specs = JSON.parse(read(join(RESEARCH, 'preset-specifications.json'))).examples
  const inventory = new Set(JSON.parse(read(join(RESEARCH, 'source-inventory.json'))).ads.map((a) => a.id))
  if (!same(specs.map((s) => s.id), ids)) fail(`preset specifications ${specs.map((s) => s.id).join(' ')} differ from the shipped presets ${ids.join(' ')}`)
  for (const spec of specs) {
    const preset = AD_PRESETS.find((p) => p.id === spec.id)
    if (preset && !same(spec.techniqueIds, preset.techniques)) fail(`${spec.id}: specification techniques ${spec.techniqueIds.join(' ')} differ from the preset ${preset.techniques.join(' ')}`)
    if (!Array.isArray(spec.evidenceAds) || !spec.evidenceAds.length) fail(`${spec.id}: no evidence ads`)
    for (const ad of spec.evidenceAds ?? []) if (!inventory.has(ad)) fail(`${spec.id}: evidence ad ${ad} is not in the source inventory`)
    if (typeof spec.readiness !== 'string' || !spec.readiness.trim()) fail(`${spec.id}: no readiness note`)
  }
}

if (failures.length) {
  console.error(`script-craft-provenance: ${failures.length} failure(s)\n  - ${failures.join('\n  - ')}`)
  process.exit(1)
}
console.log(`script-craft-provenance: ${shipped.ids.length} techniques and ${ids.length} presets trace to their evidence`)
