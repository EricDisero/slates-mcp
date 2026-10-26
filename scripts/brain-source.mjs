import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

/** The brain folder, or end this check cleanly where there is none (single-repo CI): `label` names what skipped. */
export function brainOrSkip(label) {
  const dir = brainDir()
  if (dir) return dir
  console.error(`[${label}] skipped: this check reads the brain, which single-repo CI does not have`)
  process.exit(0)
}
