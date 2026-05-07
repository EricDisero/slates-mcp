import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs'

interface InstallSkillsOptions {
  force: boolean
}

// Copy bundled skill markdown files into ./.claude/skills/ in the user's
// current working directory. Mirrors how Higgsfield ships its CLI: skills
// are markdown recipes that compose the operation surface. They auto-
// register with Claude Code skill discovery once they're on disk.

export function runInstallSkills(opts: InstallSkillsOptions): void {
  const here = dirname(fileURLToPath(import.meta.url))
  // dist/commands → walk up to package root, then look for /skills.
  const pkgRoot = join(here, '..', '..')
  const skillsRoot = join(pkgRoot, 'skills')

  if (!existsSync(skillsRoot)) {
    console.error(`Bundled skills not found at ${skillsRoot}`)
    process.exit(1)
  }

  const target = join(process.cwd(), '.claude', 'skills')
  if (!existsSync(target)) mkdirSync(target, { recursive: true })

  const files = readdirSync(skillsRoot).filter((f) => f.endsWith('.md'))
  let copied = 0
  let skipped = 0
  for (const file of files) {
    const dest = join(target, file)
    if (existsSync(dest) && !opts.force) {
      console.log(`skip   ${file} (already exists, use --force to overwrite)`)
      skipped++
      continue
    }
    writeFileSync(dest, readFileSync(join(skillsRoot, file)))
    console.log(`write  ${file}`)
    copied++
  }

  console.log(`\nInstalled ${copied} skill(s), skipped ${skipped}, into ${target}`)
}
