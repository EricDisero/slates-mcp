import { join } from 'node:path'
import { homedir } from 'node:os'
import {
  existsSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import { SKILLS } from '@slatesvideo/shared'

interface InstallSkillsOptions {
  global?: boolean
}

// Install the bundled skill markdown into Claude Code's skill directories.
//
// Skill content is embedded in @slatesvideo/shared (generated from
// packages/shared/skills/*.md at build time), so the install works no matter
// how the CLI was delivered — global npm install, npx, or a bundled binary.
//
// Claude Code discovers skills as DIRECTORIES: .claude/skills/<name>/SKILL.md.
// A loose .md file dropped straight into .claude/skills/ is silently never
// loaded. So each bundled skill is written to its own <name>/SKILL.md folder,
// where <name> comes from the skill's frontmatter `name:` field (falling back
// to the embedded key, the source filename sans .md). Discovery runs at
// session start — a restart of Claude Code is required before new skills
// appear.

function frontmatterName(markdown: string, fallback: string): string {
  if (!markdown.startsWith('---')) return fallback
  const end = markdown.indexOf('\n---', 3)
  if (end === -1) return fallback
  const block = markdown.slice(3, end)
  const m = block.match(/^name:\s*(.+?)\s*$/m)
  return m ? m[1].trim() : fallback
}

export function runInstallSkills(opts: InstallSkillsOptions): void {
  const skillEntries = Object.entries(SKILLS)
  if (skillEntries.length === 0) {
    console.error('No bundled skills found in @slatesvideo/shared — broken build?')
    process.exit(1)
  }

  const target = opts.global
    ? join(homedir(), '.claude', 'skills')
    : join(process.cwd(), '.claude', 'skills')
  if (!existsSync(target)) mkdirSync(target, { recursive: true })

  // Migrate away from the old broken layout: earlier versions of this
  // command copied loose slates-*.md files flat into the skills root, where
  // Claude Code never discovers them. Remove them — the same content is
  // about to be written in the correct <name>/SKILL.md layout. EXACT
  // filename match only (the embedded key + .md): a slates-* glob would
  // also delete a user's own files (e.g. slates-notes.md).
  const legacyFilenames = new Set(skillEntries.map(([key]) => `${key}.md`))
  const stale = readdirSync(target).filter((f) => {
    if (!legacyFilenames.has(f)) return false
    try {
      return statSync(join(target, f)).isFile()
    } catch {
      return false
    }
  })
  for (const f of stale) rmSync(join(target, f))
  if (stale.length > 0) {
    console.log(
      `Removed ${stale.length} stale flat .md file(s) left by a previous install — ` +
        `the old flat layout was never picked up by Claude Code. Reinstalling in the correct layout now.`
    )
  }

  let fresh = 0
  let updated = 0
  for (const [key, content] of skillEntries) {
    const name = frontmatterName(content, key)
    const dir = join(target, name)
    const isUpdate = existsSync(dir)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'SKILL.md'), content)
    if (isUpdate) {
      updated++
      console.log(`update  ${name}`)
    } else {
      fresh++
      console.log(`install ${name}`)
    }
  }

  const total = fresh + updated
  console.log(`\nInstalled ${total} skill(s) (${fresh} new, ${updated} updated) into ${target}`)
  console.log(`Restart Claude Code, then ask: 'what slates skills do you have?' to verify.`)
}
