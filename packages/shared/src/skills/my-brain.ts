// ============================================================
// MY BRAIN: the user's own layer of the brain (second-brain
// plans/2026-10-25-slates-brain.md § My brain).
//
// Markdown files in the bundled skills' shape (frontmatter, then an
// operative summary), in one folder on the user's machine. The loader reads
// it as a second root beside the bundled SKILLS: a file named like a bundled
// skill adds to it for this user (their file first, as the rules that win where
// they differ, then the shared guide, so a later fix to the shared guide still
// reaches them: prompts/brain.ts, overlayGuide), a new name adds one. Nothing
// here leaves the machine.
//
// The folder is ~/.slates/my-brain (SLATES_MY_BRAIN_DIR overrides it), beside
// the connection file every surface on the machine already reads, so the MCP
// server, the CLI and the desktop's Director see the same brain.
//
// What goes unused leaves (§ Keeping it from turning into chaos, rule 8): each
// file's last use is kept in .usage.json beside it, and archiveUnused moves a
// file nothing has loaded in 60 days into archive/, whole, its sources with it.
// The app's idle consolidation (plan step 5) calls it; nothing here deletes.
//
// The router is never replaced: it is the shared brain's front door and its
// job list is Eric's call (§ Keeping it from turning into chaos). Every load
// holds the files to the shape (brain-check.ts: a summary, the caps in
// scripts/brain-shape.json caps.mine, one home per lesson), the same code
// scripts/brain-lint.mjs runs on this folder (`--root <dir> --mine`), which
// adds the summary's exact shape and a source on every block.
// ============================================================

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_DIR } from '../auth.js'
import { BRAIN_ROUTER, MY_BRAIN_TOPIC, ROUTER_ALIASES, overlayGuide } from '../prompts/brain.js'
import { myBrainProblems } from './brain-check.js'
import { BRAIN_SHAPE } from './content.js'
import { brainFiles } from './served.js'
import { parseSkillMetadata } from './metadata.js'

/** The shared brain's front door, every name that opens it, and the topic that serves this folder: no local file takes one. */
const RESERVED = new Set([BRAIN_ROUTER, ...ROUTER_ALIASES, MY_BRAIN_TOPIC])
/** A file past this is not a lesson; it is skipped and named. */
const MAX_FILE_BYTES = 64 * 1024
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function myBrainDir(): string {
  return process.env.SLATES_MY_BRAIN_DIR || join(AGENT_DIR, 'my-brain')
}

export interface Brain {
  /** The bundled skills with the user's files laid over them: a same-name file over the shared guide, a new name as itself. */
  skills: Readonly<Record<string, string>>
  /** Names served from the user's folder, the ones laid over a shared guide included. */
  mine: ReadonlySet<string>
  /** Files that were not loaded, each with why. */
  skipped: ReadonlyArray<{ file: string; reason: string }>
}

/**
 * The user's files, read fresh on each call (a handful of small files; an edit applies at once). A file loads only
 * when it passes the shape (brain-check.ts), the profile checked first so the folder's cap never drops it.
 */
export function loadMyBrain(dir = myBrainDir()): { files: Record<string, string>; skipped: Array<{ file: string; reason: string }> } {
  const files: Record<string, string> = {}
  const skipped: Array<{ file: string; reason: string }> = []
  if (!existsSync(dir)) return { files, skipped }
  let names: string[]
  try {
    names = readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
  } catch (error) {
    // A folder that cannot be read (a file in its place, no permission) leaves the shared brain working.
    skipped.push({ file: dir, reason: `the folder could not be read: ${error instanceof Error ? error.message : String(error)}` })
    return { files, skipped }
  }
  for (const file of names) {
    const name = file.slice(0, -3)
    const path = join(dir, file)
    try {
      if (!NAME_RE.test(name)) throw new Error('the name must be lowercase words joined by hyphens')
      if (RESERVED.has(name)) throw new Error(name === MY_BRAIN_TOPIC ? 'the name is the topic that serves this folder' : 'the router belongs to the shared brain')
      if (statSync(path).size > MAX_FILE_BYTES) throw new Error(`over ${MAX_FILE_BYTES / 1024} KB`)
      const body = readFileSync(path, 'utf8')
      parseSkillMetadata(body, name)
      files[name] = body
    } catch (error) {
      skipped.push({ file, reason: error instanceof Error ? error.message : String(error) })
    }
  }
  const order = Object.keys(files).sort((a, b) => Number(b === MY_BRAIN_PROFILE) - Number(a === MY_BRAIN_PROFILE))
  for (const { name, reason } of myBrainProblems(files, { shape: BRAIN_SHAPE, bundled: brainFiles(), order })) {
    delete files[name]
    skipped.push({ file: `${name}.md`, reason })
  }
  return { files, skipped }
}

/** The whole brain this user's agents read: bundled, then theirs on top (over a shared guide of the same name). */
export function brainSkills(dir = myBrainDir()): Brain {
  const { files, skipped } = loadMyBrain(dir)
  // The shared brain: the public card and router, then the files the account's tier opens (skills/served.ts).
  const shared = brainFiles()
  const own = Object.fromEntries(Object.entries(files).map(([name, text]) => [name, Object.hasOwn(shared, name) ? overlayGuide(text, shared[name]) : text]))
  return { skills: { ...shared, ...own }, mine: new Set(Object.keys(files)), skipped }
}

/** About 3,000 tokens (plan § My brain): what an agent reads of the user's brain before the router. */
export const MY_BRAIN_PRELOAD_CHARS = 12_000
/** The user's profile, by this name, leads the preload whole. */
export const MY_BRAIN_PROFILE = 'profile'

/**
 * What an agent reads of the user's brain before the router: the profile, then one line per other file
 * (its operative summary's first bullet, else its description), cut at MY_BRAIN_PRELOAD_CHARS. Empty when
 * the folder holds nothing. Director puts it in its system prompt; the MCP server sends it with the router
 * on a connection's first result. Each file itself is served whole by name.
 */
export function myBrainPreload(dir = myBrainDir()): string {
  const { files, skipped } = loadMyBrain(dir)
  const names = Object.keys(files)
  // A file that did not load is named, so the user hears why their rule is not being followed.
  const notLoaded = skipped.length ? ['', 'Not loaded from their brain (tell them, so they can fix it):', ...skipped.map((s) => `- ${s.file}: ${s.reason}`)] : []
  if (!names.length) return notLoaded.length ? ["The user's own brain (My brain) has files that did not load.", ...notLoaded].join('\n') : ''
  const body = (name: string) => files[name].replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/, '').replace(/<!--[\s\S]*?-->/g, '').trim()
  const line = (name: string) => {
    const summary = /<!--\s*@operative:start\s*-->([\s\S]*?)<!--\s*@operative:end\s*-->/.exec(files[name])?.[1]
    const first = summary?.split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).find((l) => l && !/^\*\*Operative summary/.test(l))
    return `- \`${name}\`${Object.hasOwn(brainFiles(), name) ? ' (adds to the shared guide of this name, and wins where they differ)' : ''}: ${first ?? parseSkillMetadata(files[name], name).description}`
  }
  // The profile is read whole here, so this is its use; the files below are only named, and date themselves when served.
  if (names.includes(MY_BRAIN_PROFILE)) noteUsed(MY_BRAIN_PROFILE, dir)
  const parts = [
    "The user's own brain (My brain): their rules and presets, which win over the shared brain where they differ. Read a file whole with slates_get_prompting_guide (topic: its name) when the job touches it.",
    ...(names.includes(MY_BRAIN_PROFILE) ? ['', `Their profile:\n${body(MY_BRAIN_PROFILE)}`] : []),
    ...(names.some((n) => n !== MY_BRAIN_PROFILE) ? ['', 'Their files:', ...names.filter((n) => n !== MY_BRAIN_PROFILE).map(line)] : []),
    ...notLoaded,
  ]
  const text = parts.join('\n')
  return text.length <= MY_BRAIN_PRELOAD_CHARS ? text : `${text.slice(0, MY_BRAIN_PRELOAD_CHARS)}\n[cut at about 3,000 tokens; ask for a file by name]`
}

const USAGE_FILE = '.usage.json'
export const ARCHIVE_AFTER_DAYS = 60

function readUsage(dir: string): Record<string, string> | null {
  try {
    return JSON.parse(readFileSync(join(dir, USAGE_FILE), 'utf8')) as Record<string, string>
  } catch (error) {
    // No file yet is an empty record; a file that will not parse is unknown, and nothing archives on it.
    return (error as NodeJS.ErrnoException)?.code === 'ENOENT' ? {} : null
  }
}

/** Record that an agent loaded one of the user's files. Never throws: the date is housekeeping, serving the guide matters more. */
export function noteUsed(name: string, dir = myBrainDir(), now = new Date()): void {
  try {
    const usage = readUsage(dir)
    if (!usage) return
    usage[name] = now.toISOString()
    // Written aside and renamed in, so a surface reading at the same moment never sees half a file.
    const temp = join(dir, `${USAGE_FILE}.${process.pid}.tmp`)
    writeFileSync(temp, JSON.stringify(usage, null, 2))
    renameSync(temp, join(dir, USAGE_FILE))
  } catch {
    // A read-only folder keeps no dates; archiveUnused then goes by each file's last edit.
  }
}

/**
 * Move every file unused for ARCHIVE_AFTER_DAYS into archive/, whole. A file's last use is the later of its last
 * load and its last edit, so an edit counts as use. Nothing moves while the usage record is unreadable. Returns
 * the names moved.
 */
export function archiveUnused(dir = myBrainDir(), now = new Date()): string[] {
  if (!existsSync(dir)) return []
  const usage = readUsage(dir)
  if (!usage) return []
  const cutoff = now.getTime() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000
  const moved: string[] = []
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const name = file.slice(0, -3)
    const loaded = Date.parse(usage[name] ?? '')
    const last = Math.max(Number.isFinite(loaded) ? loaded : 0, statSync(join(dir, file)).mtimeMs)
    if (last >= cutoff) continue
    mkdirSync(join(dir, 'archive'), { recursive: true })
    // An earlier archived copy of the same name is kept: the newer one takes a dated name beside it.
    const target = existsSync(join(dir, 'archive', file)) ? `${name}.${now.toISOString().slice(0, 10)}.md` : file
    renameSync(join(dir, file), join(dir, 'archive', target))
    moved.push(name)
  }
  return moved
}

/** When archiveUnused last ran from a surface's start, beside the usage record so it travels with the folder. */
const ARCHIVE_RUN_FILE = '.archive-run'
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * archiveUnused at most once a day, for a surface to call as it starts (the MCP server does): a server starts with
 * every client session, and a sweep of the folder per session is waste. Never throws, so a bad folder never stops a
 * server starting; a run that fails still counts, so a broken folder is not retried on every start.
 */
export function archiveUnusedDaily(dir = myBrainDir(), now = new Date()): string[] {
  try {
    if (!existsSync(dir)) return []
    const runFile = join(dir, ARCHIVE_RUN_FILE)
    let last = Number.NaN
    try {
      last = Date.parse(readFileSync(runFile, 'utf8').trim())
    } catch {
      // No record yet: run now.
    }
    if (Number.isFinite(last) && now.getTime() - last < DAY_MS && last <= now.getTime()) return []
    try {
      return archiveUnused(dir, now)
    } finally {
      writeFileSync(runFile, now.toISOString())
    }
  } catch {
    return []
  }
}
