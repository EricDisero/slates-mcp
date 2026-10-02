import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { SKILLS, parseSkillMetadata } from '@slatesvideo/shared'

const CLIENT_DIRECTORIES = { claude: '.claude', codex: '.agents' } as const
export type SkillClient = keyof typeof CLIENT_DIRECTORIES | 'both'
export const SKILL_CLIENTS = ['both', ...Object.keys(CLIENT_DIRECTORIES)]
export interface InstallSkillsOptions {
  global?: boolean
  client?: SkillClient
}
interface SkillEnvironment {
  cwd: string
  home: string
  skills: Record<string, string>
  log: (message: string) => void
}
export function skillInstallTargets(client: SkillClient, base: string): Array<{ client: Exclude<SkillClient, 'both'>; path: string }> {
  if (client !== 'both' && !Object.hasOwn(CLIENT_DIRECTORIES, client)) throw new Error(`Unknown skill client: ${client}`)
  return Object.entries(CLIENT_DIRECTORIES)
    .filter(([name]) => client === 'both' || name === client)
    .map(([name, directory]) => ({ client: name as Exclude<SkillClient, 'both'>, path: join(base, directory, 'skills') }))
}

/** Check every installed copy: Codex can discover same-name skills in both scopes. */
export function inspectSkillInstallation(roots: string[], skills: Record<string, string> = SKILLS): { installed: number; missing: string[]; stale: string[]; duplicates: string[] } {
  const missing: string[] = []
  const stale: string[] = []
  const duplicates: string[] = []
  for (const [key, content] of Object.entries(skills)) {
    const { name } = parseSkillMetadata(content, key)
    const files = [...new Set(roots)].map(root => join(root, name, 'SKILL.md')).filter(path => existsSync(path))
    if (!files.length) missing.push(name)
    else if (files.some(file => readFileSync(file, 'utf8') !== content)) stale.push(name)
    if (files.length > 1) duplicates.push(name)
  }
  return { installed: Object.keys(skills).length - missing.length, missing, stale, duplicates }
}

/** Both clients consume the same embedded portable SKILL.md source. */
export function runInstallSkills(opts: InstallSkillsOptions, environment: SkillEnvironment = {
  cwd: process.cwd(), home: homedir(), skills: SKILLS, log: console.log,
}): void {
  const entries = Object.entries(environment.skills).map(([key, content]) => ({
    ...parseSkillMetadata(content, key), content,
  }))
  if (!entries.length) throw new Error('No bundled skills found in @slatesvideo/shared')
  const targets = skillInstallTargets(opts.client ?? 'both', opts.global ? environment.home : environment.cwd)
  for (const target of targets) {
    let fresh = 0
    let updated = 0
    for (const { name, content } of entries) {
      const directory = join(target.path, name)
      const file = join(directory, 'SKILL.md')
      if (existsSync(file)) updated++
      else fresh++
      mkdirSync(directory, { recursive: true })
      writeFileSync(file, content)
    }
    environment.log(`Installed ${entries.length} ${target.client} skills (${fresh} new, ${updated} updated) into ${target.path}`)
  }
  environment.log('Skills reload automatically. In Claude Code, use /reload-skills if the skill root was just created; restart Codex if its list has not refreshed.')
}
