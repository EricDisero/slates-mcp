import { APP_MANUAL } from './content.js'

export { APP_MANUAL }

/**
 * THE APP MANUAL, ONE SMALL SECTION PER QUESTION.
 *
 * The manual is read by LLMs (the Studio Agent, a user's own Claude or ChatGPT through the MCP), and a
 * user asks them instead of reading it (Eric, 2026-09-30: progressive disclosure "needs to be absolutely
 * perfect, very token efficient"). So a question costs one `###` section, not the ~32k-token whole:
 *
 *   appManualIndex()          the map: every `##` surface with its `###` headings, no bodies
 *   appManualSections(query)  the best section for the words (a second only when it scores as well),
 *                             then a "Related" line naming the next headings to ask for
 *   appManualSections()       the whole manual (depth "full", the MCP resource)
 *
 * Scoring weighs a word by how rare it is across sections (IDF), so "export" outranks "video", and
 * heading words four times body words: the manual's headings carry the words users type. An exact
 * heading returns that section. Maintainer comments and generated-block markers never reach the model.
 * Doc: second-brain plans/2026-09-30-slates-manual-for-llms-1-6-1-decisions.md § 0.
 */

interface Section {
  heading: string
  /** The `##` a `###` sits under, for context in the answer and in scoring. */
  parent: string | null
  level: 2 | 3
  body: string
  words: Map<string, number>
  /** Heading words with their counts: a heading that names a thing three times is about it. */
  headingWords: Map<string, number>
  /** Adjacent heading words ("new project"), so a question's phrasing counts, not only its words. */
  headingPairs: Set<string>
  parentWords: Set<string>
}

/** Stop here when two sections are returned together (~1.5k tokens). */
const PAIR_CAP_CHARS = 6000
const STOP = new Set(
  // Question words and filler: "that has no video yet" should not steer toward a heading that says "yet".
  'a an and are as at be by can could do does don doesn for from get got had has have how i in into is isn it its just ll me my of on or re s should t than that the then there this to ve what when where which while who why will with won would you your'.split(' ')
)

/**
 * One form per word, so the question's word meets the manual's: "saved", "saves" and "save" are one, as
 * are "running" and "run", "categories" and "category". A light stemmer, not Porter: plural, then -ing or
 * -ed, then a doubled final consonant, then a final e. Both sides go through it, so a crude root is fine.
 */
function stem(word: string): string {
  let w = word
  if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2)
  const last = w[w.length - 1]
  if (w.length > 3 && last === w[w.length - 2] && !'lsz'.includes(last) && !/[aeiou0-9]/.test(last)) w = w.slice(0, -1)
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1)
  return w
}

/** Lowercase, split, drop stop words, stem. */
function terms(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => !STOP.has(w)).map(stem)
}

const pairs = (list: string[]): Set<string> => new Set(list.slice(1).map((w, i) => `${list[i]} ${w}`))

const counts = (list: string[]): Map<string, number> => {
  const m = new Map<string, number>()
  for (const w of list) m.set(w, (m.get(w) ?? 0) + 1)
  return m
}

const clean = (text: string): string => text.replace(/<!--[\s\S]*?-->\n?/g, '').replace(/\n{3,}/g, '\n\n').trim()
const bare = (heading: string): string => heading.replace(/^#+\s*/, '').trim()

/** The manual's sections, parsed once per text. */
function parse(manual: string): Section[] {
  const start = manual.indexOf('<slates_reference>')
  const end = manual.lastIndexOf('</slates_reference>')
  const body = start >= 0 && end > start ? manual.slice(start + '<slates_reference>'.length, end) : manual
  const out: Section[] = []
  let parent: string | null = null
  let current: { heading: string; level: 2 | 3; parent: string | null; lines: string[] } | null = null
  let fenced = false
  const flush = (): void => {
    if (!current) return
    const text = clean(current.lines.join('\n'))
    const words = new Map<string, number>()
    for (const w of terms(text)) words.set(w, (words.get(w) ?? 0) + 1)
    out.push({
      heading: current.heading,
      parent: current.parent,
      level: current.level,
      body: text,
      words,
      headingWords: counts(terms(current.heading)),
      headingPairs: pairs(terms(current.heading)),
      parentWords: new Set(terms(current.parent ?? '')),
    })
  }
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) fenced = !fenced
    const m = fenced ? null : /^(#{1,4}) (.+)$/.exec(line)
    // `#` (the version header) and `####` (a sub-point) stay inside the section they sit in.
    if (m && (m[1].length === 2 || m[1].length === 3)) {
      flush()
      const level = m[1].length as 2 | 3
      if (level === 2) parent = m[2].trim()
      current = { heading: m[2].trim(), level, parent: level === 3 ? parent : null, lines: [line] }
    } else if (current) current.lines.push(line)
  }
  flush()
  return out.filter((s) => s.body.replace(/^#+ .*$/m, '').trim().length > 0)
}

/** A `###` heading without its trailing synonyms: "Timeline: markers (add a marker, …)" is "Timeline: markers", which asks for it. */
const shortHeading = (heading: string): string => heading.replace(/\s*\([^)]*\)\s*$/, '').trim() || heading

/**
 * The map, step one: every `##` surface on one line with the words it answers. Asking for a surface by
 * the words before its dash returns its opening and its sections (step two); asking with the words of a
 * question returns the one section that answers it. Each step is small.
 */
function indexOf(all: Section[]): string {
  const lines = [
    'Slates app manual. Ask with the words of the question for the section that answers it, or ask for a surface by its name (the words before the —) for its list of sections.',
    '',
  ]
  for (const s of all) if (s.level === 2) lines.push(`## ${s.heading}`)
  return lines.join('\n')
}

/** A surface's own sections, short, for step two. */
const sectionList = (all: Section[], surface: Section): string =>
  all.filter((s) => s.parent === surface.heading).map((s) => shortHeading(s.heading)).join(' · ')

function score(s: Section, qTerms: string[], idf: Map<string, number>, phrase: string): number {
  let n = 0
  for (const t of new Set(qTerms)) {
    const w = idf.get(t) ?? 0
    if (!w) continue
    // A heading word counts 4, a second mention of it 2 more; the surface's words 1; the body up to 1.5.
    const h = s.headingWords.get(t) ?? 0
    n += w * ((h ? 4 : 0) + (h > 1 ? 2 : 0) + (s.parentWords.has(t) ? 1 : 0) + Math.min(s.words.get(t) ?? 0, 3) * 0.5)
  }
  // Two question words side by side in the heading ("new project", "video from a picture") are the
  // phrasing the heading was written for.
  for (let i = 1; i < qTerms.length; i++) {
    if (s.headingPairs.has(`${qTerms[i - 1]} ${qTerms[i]}`)) n += 2 * ((idf.get(qTerms[i - 1]) ?? 0) + (idf.get(qTerms[i]) ?? 0))
  }
  if (phrase.length > 3) {
    if (s.heading.toLowerCase().includes(phrase)) n += 6
    else if (s.body.toLowerCase().includes(phrase)) n += 2
  }
  return n
}

const withContext = (s: Section): string => (s.parent ? `## ${s.parent}\n\n${s.body}` : s.body)

/**
 * With no query, the whole manual. With a query, the best section (a second when it scores within 15%
 * and both fit ~1.5k tokens), then the next headings to ask for. Whole sections only: never a cut
 * sentence, never an invented step.
 */
function sectionsFor(manual: string, all: Section[], query?: string): string {
  if (!query?.trim()) return manual
  const q = query.trim().toLowerCase()
  const asked = q.replace(/^#+\s*/, '')
  const exact =
    all.find((s) => s.heading.toLowerCase() === q || bare(s.heading).toLowerCase() === asked) ??
    // A heading without its synonyms ("Timeline: markers"), or a surface by the words before its dash.
    all.find((s) => s.heading.toLowerCase().replace(/\s*\([^)]*\)\s*$/, '') === asked) ??
    all.find((s) => s.level === 2 && s.heading.split(' — ')[0].toLowerCase() === asked)
  if (exact?.level === 3) return withContext(exact)
  if (exact) {
    const list = sectionList(all, exact)
    return list ? `${exact.body}\n\nIts sections (ask for one by name, or with the question's words): ${list}` : exact.body
  }

  const qTerms = terms(query)
  const df = new Map<string, number>()
  for (const t of new Set(qTerms)) df.set(t, all.filter((s) => s.words.has(t) || s.headingWords.has(t)).length)
  const idf = new Map([...df].map(([t, d]) => [t, d ? Math.log(1 + all.length / d) : 0]))
  const ranked = all
    .map((s, index) => ({ s, index, score: score(s, qTerms, idf, q) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.s.body.length - b.s.body.length || a.index - b.index)
  if (!ranked.length) return `No manual section matches "${query}". Available headings:\n\n${indexOf(all)}`

  const [best, second] = ranked
  const picked = [best]
  if (second && second.score >= best.score * 0.85 && best.s.body.length + second.s.body.length <= PAIR_CAP_CHARS) picked.push(second)
  const related = ranked.slice(picked.length, picked.length + 4).map((r) => r.s.heading)
  const text = picked.map((r) => withContext(r.s)).join('\n\n')
  return related.length ? `${text}\n\nRelated sections (ask by heading): ${related.join(' · ')}` : text
}

/**
 * A reader over one manual text. The package's own reads go through the shipped manual below; the
 * retrieval check (`scripts/app-manual-retrieval-check.mjs`) reads slate's source manual the same way,
 * before the generator has copied it here.
 */
export function manualReader(manual: string): { index: () => string; sections: (query?: string) => string } {
  let all: Section[] | null = null
  const parsed = (): Section[] => (all ??= parse(manual))
  return { index: () => indexOf(parsed()), sections: (query) => sectionsFor(manual, parsed(), query) }
}

const shipped = manualReader(APP_MANUAL)
export const appManualIndex = (): string => shipped.index()
export const appManualSections = (query?: string): string => shipped.sections(query)
