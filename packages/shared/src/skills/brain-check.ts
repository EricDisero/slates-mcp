// ============================================================
// THE BRAIN'S COUNTS AND THE MY BRAIN CHECKS, in one place for both readers.
//
// The My brain loader (my-brain.ts) runs these on the user's machine on every
// load, and scripts/brain-lint.mjs (`--root <dir> --mine`) runs the same code,
// so a file the lint passes is a file the loader serves, and a word is counted
// the same way by both. The lint adds what needs a person at a keyboard: the
// summary's exact shape and a source on every block.
//
// The numbers are not here: the caller passes the shape, which is
// scripts/brain-shape.json (read by the lint, embedded into content.ts as
// BRAIN_SHAPE by scripts/embed-skills.mjs for the loader).
//
// A dependency-free leaf: brain-lint.mjs loads it through load-typescript.mjs
// before any build, so it imports nothing.
// ============================================================

/** The parts of scripts/brain-shape.json the code reads. */
export interface BrainShape {
  layers: Record<string, string[]>
  caps: { fileWords: Record<string, number>; layerWords: Record<string, number>; mine: { fileWords: number; layerWords: number } }
  duplicates: { shingleWords: number; failAt: number }
}

const OPERATIVE_RE = /<!--\s*@operative:start\s*-->([\s\S]*?)<!--\s*@operative:end\s*-->/
const CARD_START_RE = /<!--\s*@card:start\s*-->/
const CARD_RE = /<!--\s*@card:start\s*-->([\s\S]*?)<!--\s*@card:end\s*-->/
const INJECT_RE = /<!--\s*@inject:([a-z0-9-]+)\s*-->[\s\S]*?<!--\s*@end:\1\s*-->/g
const COMMENT_RE = /<!--[\s\S]*?-->/g
const FRONTMATTER_RE = /^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/

const prose = (text: string): string => text.replace(COMMENT_RE, '').replace(FRONTMATTER_RE, '')

/** Words an agent reads: frontmatter, comments and bare table or list punctuation left out. */
export function words(text: string): number {
  return prose(text).split(/\s+/).filter((w) => w && !/^[|:\-#*>]+$/.test(w)).length
}

/** The words a passage check compares: prose only, with injected partials, comments, frontmatter and code left out. */
export function passageWords(text: string): string[] {
  return text.replace(INJECT_RE, ' ').replace(COMMENT_RE, ' ').replace(FRONTMATTER_RE, '').replace(/```[\s\S]*?```/g, ' ')
    .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean)
}

/** A file's distinct runs of `n` words. */
function shingles(text: string, n: number): Set<string> {
  const w = passageWords(text)
  const out = new Set<string>()
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '))
  return out
}

/** Per pair of files (`a + b`, sorted), how many runs of `n` words they share, with one as a sample. */
export function overlaps(skills: Readonly<Record<string, string>>, n: number): Map<string, { count: number; sample: string }> {
  const seen = new Map<string, Set<string>>()
  for (const [name, text] of Object.entries(skills)) {
    for (const key of shingles(text, n)) {
      if (!seen.has(key)) seen.set(key, new Set())
      seen.get(key)!.add(name)
    }
  }
  const pairs = new Map<string, { count: number; sample: string }>()
  for (const [key, where] of seen) {
    if (where.size < 2) continue
    const files = [...where].sort()
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const pair = `${files[i]} + ${files[j]}`
        const hit = pairs.get(pair) ?? { count: 0, sample: key }
        hit.count++
        pairs.set(pair, hit)
      }
    }
  }
  return pairs
}

/**
 * Each bundled run of words and the files that hold it, built once per bundled record: the loader checks the
 * user's files against all of them on every load, and re-reading tens of thousands of words each time is waste.
 */
const bundledIndexes = new WeakMap<object, { n: number; index: Map<string, string[]> }>()
function bundledIndex(bundled: Readonly<Record<string, string>>, n: number): Map<string, string[]> {
  const cached = bundledIndexes.get(bundled)
  if (cached && cached.n === n) return cached.index
  const index = new Map<string, string[]>()
  for (const [name, text] of Object.entries(bundled)) {
    for (const key of shingles(text, n)) {
      const at = index.get(key)
      if (at) at.push(name)
      else index.set(key, [name])
    }
  }
  bundledIndexes.set(bundled, { n, index })
  return index
}

/** Why a file has no summary an agent can read first, or null when it has one. */
function summaryMissing(text: string): string | null {
  const op = OPERATIVE_RE.exec(text)
  if (op) return op[1].replace(COMMENT_RE, '').trim() ? null : 'the operative summary is empty; it is what an agent reads first'
  if (!CARD_START_RE.test(text)) return 'no <!-- @operative:start --> summary (or, on a model guide, a <!-- @card:start --> card) leading the file; it is what an agent reads first'
  const card = CARD_RE.exec(text)
  if (!card) return 'the <!-- @card:start --> has no <!-- @card:end -->'
  return card[1].replace(COMMENT_RE, '').trim() ? null : "the @card is empty; it is the file's summary"
}

export interface MyBrainProblem {
  /** The user's file that is not loaded, by name. */
  name: string
  reason: string
}

/**
 * Every My brain file that should not load, with why: no readable summary, over the file cap, a lesson already in
 * another of their files or in a bundled skill (one home per lesson, at the shape's failAt), or one file too many
 * for the folder's cap. Files are checked in `order` (the loader passes the profile first); a file that fails is
 * left out of the checks after it, so one problem never names two files. Of two of their files sharing a passage
 * the later one is named. Every bundled skill counts, a same-name one included: a user's file adds to the shared
 * guide of its name (my-brain.ts), so a passage copied from it would be served twice.
 */
export function myBrainProblems(
  files: Readonly<Record<string, string>>,
  { shape, bundled = {}, order = Object.keys(files).sort() }: { shape: BrainShape; bundled?: Readonly<Record<string, string>>; order?: string[] }
): MyBrainProblem[] {
  const problems: MyBrainProblem[] = []
  const caps = shape.caps.mine
  const n = shape.duplicates.shingleWords
  const failAt = shape.duplicates.failAt
  const index = bundledIndex(bundled, n)
  const kept: Array<{ name: string; runs: Set<string> }> = []
  let total = 0
  for (const name of order) {
    const text = files[name]
    if (text === undefined) continue
    const missing = summaryMissing(text)
    if (missing) { problems.push({ name, reason: missing }); continue }
    const count = words(text)
    if (count > caps.fileWords) { problems.push({ name, reason: `${count} words, over My brain's file cap of ${caps.fileWords}` }); continue }
    const runs = shingles(text, n)
    // How many of this file's runs each bundled skill holds, then each of their files already kept.
    const hits: Array<{ other: string; theirs: boolean; count: number; sample: string }> = []
    const inBundled = new Map<string, { count: number; sample: string }>()
    for (const key of runs) {
      for (const other of index.get(key) ?? []) {
        const hit = inBundled.get(other) ?? { count: 0, sample: key }
        hit.count++
        inBundled.set(other, hit)
      }
    }
    for (const [other, hit] of inBundled) hits.push({ other, theirs: false, ...hit })
    for (const other of kept) {
      let count = 0
      let sample = ''
      for (const key of runs) if (other.runs.has(key)) { count++; sample ||= key }
      if (count) hits.push({ other: other.name, theirs: true, count, sample })
    }
    const dup = hits.filter((hit) => hit.count >= failAt).sort((a, b) => b.count - a.count)[0]
    if (dup) {
      const fix = dup.theirs ? 'keep it in one file and point the other there'
        : dup.other === name ? 'keep only what differs, since the shared guide is served with it'
        : `point at ${dup.other} instead of repeating it`
      problems.push({ name, reason: `shares ${dup.count} ${n}-word runs with ${dup.theirs ? 'their' : 'the shared'} ${dup.other} ("${dup.sample} …"); one home per lesson: ${fix}` })
      continue
    }
    if (total + count > caps.layerWords) {
      problems.push({ name, reason: `${count} words would take My brain to ${total + count}, over its cap of ${caps.layerWords}; consolidate first` })
      continue
    }
    total += count
    kept.push({ name, runs })
  }
  return problems
}
