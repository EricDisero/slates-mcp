import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTypeScriptModule } from './load-typescript.mjs'

// Where the Slates brain's deep layers live (second-brain plans/2026-10-25-slates-brain.md step 4): the private
// slates-api repo's `brain/`, never this public one, which keeps only the Director card and the router in
// packages/shared/skills/. Every build step, check and eval that reads a playbook, rule or model guide reads it here:
// SLATES_BRAIN_DIR when set (a worktree must set it, as it sets SLATES_DESKTOP_DIR), else ../slates-api/brain.
// Single-repo CI has no private checkout: it gets null and skips what needs the brain, with a warning.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const PUBLIC_SKILLS_DIR = join(root, 'packages', 'shared', 'skills')

export function brainDir({ optional = false } = {}) {
  const explicit = process.env.SLATES_BRAIN_DIR
  if (!explicit && basename(root) !== 'slates-mcp' && !process.env.CI) {
    throw new Error('Set SLATES_BRAIN_DIR to the paired slates-api brain/ for this worktree.')
  }
  const dir = resolve(root, explicit || '../slates-api/brain')
  if (existsSync(dir)) return dir
  if (process.env.CI && !explicit) {
    console.error(`[sources] brain: ${dir} is absent in single-repo CI; brain checks skip`)
    return null
  }
  if (optional) return null
  throw new Error(`Missing the brain: ${dir}. Clone slates-api beside this repo or set SLATES_BRAIN_DIR. A local check cannot skip.`)
}

/** Name → markdown for every skill file in one folder. */
export const readSkillDir = (dir) => Object.fromEntries(
  readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => [f.slice(0, -3), readFileSync(join(dir, f), 'utf8')]),
)

/** Every skill an agent can read: the public card and router, then the brain (each name has one home). */
export function readAllSkills({ dir = brainDir(), publicDir = PUBLIC_SKILLS_DIR } = {}) {
  const pub = readSkillDir(publicDir)
  const brain = dir ? readSkillDir(dir) : {}
  const both = Object.keys(pub).filter((n) => Object.hasOwn(brain, n))
  if (both.length) throw new Error(`a skill has one home: ${both.join(', ')} is in both packages/shared/skills and the brain`)
  return { ...pub, ...brain }
}

/**
 * How the server serves `dir` (a slates-api brain/ folder, or an export of one): its tiers.json, raw and as the bump
 * list, and slates-api's own `lockedNotice` and `TIER_NAMES` from src/lib/brain-notice.ts beside it, so an eval or
 * fixture says what a member's server says.
 */
export function servedTiers(dir) {
  const tiersPath = join(dir, 'tiers.json')
  const noticePath = join(dir, '..', 'src', 'lib', 'brain-notice.ts')
  if (!existsSync(tiersPath) || !existsSync(noticePath)) {
    throw new Error(`${dir} is not a slates-api brain/ with its src/ beside it (tiers.json and src/lib/brain-notice.ts)`)
  }
  const raw = readFileSync(tiersPath, 'utf8')
  const { lockedNotice, TIER_NAMES } = loadTypeScriptModule(noticePath)
  const bump = new Set(JSON.parse(raw).bump ?? [])
  return { raw, bump, tierOf: (name) => (bump.has(name) ? 'bump' : 'license'), lockedNotice, TIER_NAMES }
}

/**
 * What is wrong with a folder a build writes brain text into, as a list (empty when it is private): it must be
 * gitignored, hold no tracked file, and stay out of @slatesvideo/shared's published `files`. This repo and its npm
 * package are public, so brain text written anywhere else here ships to everyone.
 */
export function unpublishedProblems(dir) {
  const rel = relative(root, dir).split(sep).join('/')
  const problems = []
  const tracked = execFileSync('git', ['ls-files', '--', rel], { cwd: root, encoding: 'utf8' }).trim()
  if (tracked) problems.push(`${rel} holds ${tracked.split('\n').length} tracked file(s); untrack them (git rm --cached)`)
  if (spawnSync('git', ['check-ignore', '-q', `${rel}/probe`], { cwd: root }).status !== 0) problems.push(`${rel} is not gitignored`)
  const pkgDir = join(root, 'packages', 'shared')
  const inPkg = relative(pkgDir, dir).split(sep).join('/')
  const files = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).files ?? []
  if (files.some((f) => inPkg === f.replace(/\/$/, '') || inPkg.startsWith(`${f.replace(/\/$/, '')}/`))) {
    problems.push(`packages/shared/package.json "files" publishes ${inPkg}`)
  }
  return problems
}

/** The brain folder, or end this check cleanly where there is none (single-repo CI): `label` names what skipped. */
export function brainOrSkip(label) {
  const dir = brainDir()
  if (dir) return dir
  console.error(`[${label}] skipped: this check reads the brain, which single-repo CI does not have`)
  process.exit(0)
}
