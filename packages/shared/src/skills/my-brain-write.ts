// ============================================================
// MY BRAIN, THE WRITE SIDE: a lesson the user teaches lands in their own brain
// (second-brain plans/2026-10-25-slates-brain.md § My brain, step 5).
//
// One lesson is one line in the operative summary of one file, with its source
// and date, so the loader (my-brain.ts) reads it first and every line can be
// traced and reverted. A lesson already there is not written twice; one that
// replaces an older line removes it, and the older line is kept in
// .history.jsonl (the newest wins, the loser is logged). After every write the
// file is checked with the loader's own checks; a write that would leave it
// unloaded (over a cap, a passage the shared brain already holds) is undone and
// the reason returned, so the agent consolidates instead.
// ============================================================

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MY_BRAIN_PROFILE, loadMyBrain, myBrainDir } from './my-brain.js'

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SUMMARY_RE = /(<!--\s*@operative:start\s*-->\r?\n)([\s\S]*?)(<!--\s*@operative:end\s*-->)/
const LESSON_RE = /^- (.*?) _\(from (.*?), (\d{4}-\d{2}-\d{2})\)_$/
const HISTORY_FILE = '.history.jsonl'

/** The file a lesson goes to when the agent names none. */
export const MY_BRAIN_RULES = 'my-rules'

const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

function newFile(name: string): string {
  const title = name === MY_BRAIN_PROFILE ? 'My profile' : name === MY_BRAIN_RULES ? 'My rules' : `My ${name.replace(/-/g, ' ')}`
  const what = name === MY_BRAIN_PROFILE ? 'who they are, what they make, for whom, in what voice' : 'rules and presets they taught Slates'
  return `---\nname: ${name}\ndescription: "${title}: ${what}. Theirs, and it wins over the shared brain."\n---\n\n# ${title}\n\n<!-- @operative:start -->\n**Operative summary.**\n<!-- @operative:end -->\n`
}

function writeAtomic(path: string, text: string): void {
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, text)
  renameSync(temp, path)
}

export interface RememberInput {
  /** One lesson in the user's words, as a rule or a preset ("cut every hook to its first word"). */
  lesson?: string
  /** Their file to put it in; a shared guide's name adds to that guide for them. */
  file?: string
  /** What taught it: "said always", "corrected twice", "kept take IMG-A8". */
  source?: string
  /** An existing line this lesson replaces, or with no lesson, the line to remove (undo, forget). */
  replaces?: string
}

export interface RememberResult {
  file: string
  saved?: string
  removed?: string
  unchanged?: boolean
}

/** Add, replace or remove one lesson. Throws with a reason the agent can act on. */
export function remember(input: RememberInput, dir = myBrainDir(), now = new Date()): RememberResult {
  const file = (input.file ?? MY_BRAIN_RULES).trim().toLowerCase()
  if (!NAME_RE.test(file)) throw new Error('file must be lowercase words joined by hyphens, for example "hooks" or "profile"')
  const lesson = input.lesson ? oneLine(input.lesson) : ''
  const replaces = input.replaces ? norm(input.replaces) : ''
  if (!lesson && !replaces) throw new Error('pass a lesson to save, or replaces alone to remove a line')
  if (lesson.includes('_(from ')) throw new Error('write the lesson alone; the source goes in source')

  const path = join(dir, `${file}.md`)
  const before = existsSync(path) ? readFileSync(path, 'utf8') : null
  if (before === null && !lesson) throw new Error(`${file}.md does not exist, so there is nothing to remove`)
  const text = before ?? newFile(file)
  const match = SUMMARY_RE.exec(text)
  if (!match) throw new Error(`${file}.md has no operative summary to add to; fix the file or name another`)

  const lines = match[2].split(/\r?\n/).filter((l) => l.trim())
  const lessonText = (l: string) => {
    const m = LESSON_RE.exec(l)
    return m ? norm(m[1]) : null
  }
  if (lesson && lines.some((l) => lessonText(l) === norm(lesson))) return { file, saved: lesson, unchanged: true }

  let removed: string | undefined
  if (replaces) {
    const at = lines.findIndex((l) => lessonText(l) === replaces) >= 0
      ? lines.findIndex((l) => lessonText(l) === replaces)
      : lines.findIndex((l) => lessonText(l)?.includes(replaces))
    if (at >= 0) {
      removed = LESSON_RE.exec(lines[at])![1]
      lines.splice(at, 1)
    } else if (!lesson) throw new Error(`no line in ${file}.md matches "${input.replaces}"`)
  }
  if (lesson) lines.push(`- ${lesson} _(from ${oneLine(input.source || 'the user')}, ${now.toISOString().slice(0, 10)})_`)

  const next = text.replace(SUMMARY_RE, (_all, start: string, _body: string, end: string) => `${start}${lines.join('\n')}\n${end}`)
  mkdirSync(dir, { recursive: true })
  // A file this op made, left with no lesson, is removed whole; a file with anything else of theirs is kept.
  const empty = next.trim() === newFile(file).trim()
  if (empty) rmSync(path)
  else writeAtomic(path, next)

  const problem = empty ? undefined : loadMyBrain(dir).skipped.find((s) => s.file === `${file}.md`)
  if (problem) {
    if (before === null) rmSync(path)
    else writeAtomic(path, before)
    throw new Error(`not saved: ${problem.reason}. Merge it into a line ${file}.md already has (pass replaces), or remove one first.`)
  }
  try {
    appendFileSync(join(dir, HISTORY_FILE), `${JSON.stringify({ at: now.toISOString(), file, saved: lesson || undefined, removed, source: input.source })}\n`)
  } catch {
    // The history is for tracing; the lesson is saved either way.
  }
  return { file, ...(lesson ? { saved: lesson } : {}), ...(removed ? { removed } : {}) }
}
