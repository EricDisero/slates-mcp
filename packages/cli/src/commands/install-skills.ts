import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { SlatesCloudClient, brainFiles, parseSkillMetadata, refreshServedBrain } from '@slatesvideo/shared'

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
  skills: Readonly<Record<string, string>>
  log: (message: string) => void
}
/** The brain's source comments say where a lesson came from; that is for the repo and its review, not an installed copy. */
const SOURCE_COMMENT_RE = /[\t ]*<!--\s*src:[^]*?-->/g
const installedCopy = (content: string) => content.replace(SOURCE_COMMENT_RE, '')

export function skillInstallTargets(client: SkillClient, base: string): Array<{ client: Exclude<SkillClient, 'both'>; path: string }> {
  if (client !== 'both' && !Object.hasOwn(CLIENT_DIRECTORIES, client)) throw new Error(`Unknown skill client: ${client}`)
  return Object.entries(CLIENT_DIRECTORIES)
    .filter(([name]) => client === 'both' || name === client)
    .map(([name, directory]) => ({ client: name as Exclude<SkillClient, 'both'>, path: join(base, directory, 'skills') }))
}

/** Check every installed copy: Codex can discover same-name skills in both scopes. */
export function inspectSkillInstallation(roots: string[], skills: Readonly<Record<string, string>> = brainFiles()): { installed: number; missing: string[]; stale: string[]; duplicates: string[] } {
  const missing: string[] = []
  const stale: string[] = []
  const duplicates: string[] = []
  for (const [key, content] of Object.entries(skills)) {
    const { name } = parseSkillMetadata(content, key)
    const files = [...new Set(roots)].map(root => join(root, name, 'SKILL.md')).filter(path => existsSync(path))
    if (!files.length) missing.push(name)
    else if (files.some(file => readFileSync(file, 'utf8') !== installedCopy(content))) stale.push(name)
    if (files.length > 1) duplicates.push(name)
  }
  return { installed: Object.keys(skills).length - missing.length, missing, stale, duplicates }
}

/** The card and router ship in this package; the playbooks, rules and guides come from the connected account's brain. */
export async function runInstallSkillsFromAccount(opts: InstallSkillsOptions): Promise<void> {
  const brain = await refreshServedBrain(() => new SlatesCloudClient(), { force: true })
  runInstallSkills(opts)
  if (brain.source === 'none') console.log(`Only the Director card and the router are installed: the playbooks come from your Slates account (${brain.problem ?? 'not reached'}). Run slates login, then slates install-skills again.`)
}

/** Both clients consume the same portable SKILL.md source. */
export function runInstallSkills(opts: InstallSkillsOptions, environment: SkillEnvironment = {
  cwd: process.cwd(), home: homedir(), skills: brainFiles(), log: console.log,
}): void {
  const entries = Object.entries(environment.skills).map(([key, content]) => ({
    ...parseSkillMetadata(content, key), content,
  }))
  if (!entries.length) throw new Error('No skills found in @slatesvideo/shared or the Slates brain')
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
      writeFileSync(file, installedCopy(content))
    }
    environment.log(`Installed ${entries.length} ${target.client} skills (${fresh} new, ${updated} updated) into ${target.path}`)
  }
  environment.log('Skills reload automatically. In Claude Code, use /reload-skills if the skill root was just created; restart Codex if its list has not refreshed.')
}
