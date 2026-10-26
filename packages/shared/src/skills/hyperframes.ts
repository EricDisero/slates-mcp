// The motion engine's own skills, shipped unmodified in `skills/hyperframes/` (its NOTICE and the
// timeline engine plan § 6a), and white-labelled where they are served (`whiteLabel`, engine-test
// item 8: no vendor is named in anything an agent reads; slate's `.claude/rules/white-label.md`). Slates' skills direct and these carry the craft: guide search lists them beside
// Slates' guides, ranks Slates' first for an ad (`guide-discovery.ts`), and retrieves any of their
// markdown files by path. They are never MCP prompts, never installed as skills and never in the
// doctrine's guide index, so the SKILLS record and everything that reads it stay Slates-only.

import type { GuideCatalogEntry } from '../prompts/guide-discovery.js'
import { guideSections } from '../prompts/guide-retrieval.js'
import { parseSkillMetadata } from './metadata.js'

/** The mapping file's key and the topics that reach it besides its path. */
export const HYPERFRAMES_MAPPING = 'SLATES-MAPPING.md'
const MAPPING_ALIASES = new Set(['hyperframes-mapping', 'slates-mapping'])

export interface HyperframesCorpus {
  /** Skill folder names. */
  skills: readonly string[]
  /** `<name>` → its SKILL.md, `<name>/<path>` → any other markdown file, plus the mapping. */
  files: Readonly<Record<string, string>>
}

let corpus: Promise<HyperframesCorpus> | undefined

/** The upstream skill folder that the public name `motion-overview` stands for. */
const OVERVIEW = 'hyperframes'

/** A skill's name as agents see it: the vendor's word turned into ours (`hyperframes-core` → `motion-core`). */
export function publicGuideName(name: string): string {
  if (name === OVERVIEW) return 'motion-overview'
  return name.replace(/^hyperframes-/, 'motion-').replace(/^remotion-to-hyperframes$/, 'remotion-to-motion')
}

/** A file key as agents see it: its skill folder's public name, then its path. */
const publicKey = (key: string): string => {
  const slash = key.indexOf('/')
  return slash < 0 ? publicGuideName(key) : `${publicGuideName(key.slice(0, slash))}${key.slice(slash)}`
}

/**
 * Upstream prose with the vendor's name turned into ours. Code an agent must write stays as the
 * runtime reads it (`__hyperframes`, `@hyperframes/*`, `data-hyperframes-*`), and so do the upstream
 * CLI's commands, which the mapping file says never to run in Slates. The vendor company's own
 * name never survives: a link to its site keeps its text, and whatever else names it is its hosted
 * service (cloud render, sign-in, catalog, voices), which Slates does not offer, so that goes.
 */
export function whiteLabel(text: string): string {
  return dropVendorService(text
    .replace(/\bremotion-to-hyperframes\b/g, 'remotion-to-motion')
    .replace(/(?<![\w@/._-])hyperframes-(animation|audio|cli|core|creative|keyframes|registry|studio)\b/g, 'motion-$1')
    .replace(/\bHyper[Ff]rames\b/g, 'Slates motion')
    .replace(/\[([^\]]*)\]\(<?https?:\/\/[^)\s>]*heygen[^)\s>]*>?\)/gi, '$1')
    .replace(/@miguel-heygen\b/g, '@miguel-dev'))
}

/** The company's name in any spelling: prose, a command, an env var, a host or a repo path. */
const VENDOR = /heygen/i

interface Block { kind: 'blank' | 'heading' | 'fence' | 'row' | 'prose'; lines: string[]; level: number }

/** Markdown cut into the units that can be dropped whole: headings, fenced code, table rows, paragraphs and list items. */
function markdownBlocks(lines: string[]): Block[] {
  const blocks: Block[] = []
  let fence = ''
  for (const line of lines) {
    const last = blocks.at(-1)
    const open = fence ? null : /^\s*(`{3,}|~{3,})/.exec(line)
    if (fence) { last?.lines.push(line); if (line.trimStart().startsWith(fence)) fence = '' } else if (open) { fence = open[1]; blocks.push({ kind: 'fence', lines: [line], level: 0 }) }
    else if (!line.trim()) blocks.push({ kind: 'blank', lines: [line], level: 0 })
    else if (/^#{1,6}\s/.test(line)) blocks.push({ kind: 'heading', lines: [line], level: line.indexOf(' ') })
    else if (/^\s*\|/.test(line)) blocks.push({ kind: 'row', lines: [line], level: 0 })
    else if (last?.kind === 'prose' && !/^\s*(?:[-*+]|\d+[.)])\s/.test(line)) last.lines.push(line)
    else blocks.push({ kind: 'prose', lines: [line], level: 0 })
  }
  return blocks
}

const isListItem = (block?: Block): boolean => block?.kind === 'prose' && /^\s*(?:[-*+]|\d+[.)])\s/.test(block.lines[0])
const endsInColon = (block?: Block): boolean => block?.kind === 'prose' && block.lines.at(-1)!.trimEnd().endsWith(':')

/** Where a sentence, or a `;` clause, ends; `e.g.` and `vs.` do not end one. */
const SENTENCE_END = /(?<=[.!?;])(?<!\b(?:e\.g|i\.e|vs)\.)(\s+)(?=[A-Z`*[<(])/

/** A skill's front matter key (`description`) less its sentences and clauses that name the vendor. */
function dropVendorClauses(key: string): string {
  const head = /^[\w-]+:\s*(?:[>|][-+]?\s*)?/.exec(key)?.[0] ?? ''
  const parts = key.slice(head.length).split(SENTENCE_END)
  let kept = ''
  for (let i = 0; i < parts.length; i += 2) if (!VENDOR.test(parts[i])) kept += (kept ? parts[i - 1] : '') + parts[i]
  return head + kept.replace(/;$/, '.')
}

/** A link to the vendor's repo or site that no link text carried; it reads as "the upstream source". */
const VENDOR_URL = /https?:\/\/[^\s)>"'`]*heygen[^\s)>"'`]*(?<![.,;:!?])/gi
/** A JSON property whose value is a vendor URL (`"$schema"`, `"registry"`), inside an example that is otherwise ours. */
const VENDOR_JSON_LINE = /^\s*"[^"]+":\s*"[^"]*heygen[^"]*",?\s*$/i

/** What stands where a whole guide was the vendor's service. */
const SERVICE_STUB = `# Not offered in Slates\n\nThis guide covered a hosted service Slates does not provide; topic motion/${HYPERFRAMES_MAPPING} says what to use instead.\n`

/**
 * Drops the vendor's hosted service from markdown: a section whose heading names it, then every
 * fenced example, table row, paragraph or list item that does (a vendor URL in prose becomes "the
 * upstream source", and a vendor URL property in a JSON example goes alone). Front matter loses
 * only the sentences. A heading left with nothing under it goes too, and a guide left with nothing
 * becomes a stub.
 */
function dropVendorService(text: string): string {
  if (!VENDOR.test(text)) return text
  const fm = /^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n)/.exec(text)
  const front = fm?.[0] ?? ''
  const header = fm ? fm[1] + fm[2].split(/\n(?=\S)/).map((key) => (VENDOR.test(key) ? dropVendorClauses(key) : key)).join('\n') + fm[3] : ''
  const blocks = markdownBlocks(text.slice(front.length).split('\n'))
  const kept: Block[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    let lines: string[] | null = block.kind === 'fence' ? block.lines.filter((line) => !VENDOR_JSON_LINE.test(line)) : block.lines.map((line) => line.replace(VENDOR_URL, 'the upstream source'))
    if (block.kind === 'heading' && VENDOR.test(lines[0])) {
      while (blocks[i + 1] && !(blocks[i + 1].kind === 'heading' && blocks[i + 1].level <= block.level)) i++
      lines = null
    } else if (VENDOR.test(lines.join('\n'))) lines = null
    if (lines) { kept.push({ ...block, lines }); continue }
    // A lead-in ending in a colon takes the list or example it introduced, and an example takes its lead-in.
    if (endsInColon(block)) for (let next = i + 1; ; i = next++) {
      while (blocks[next]?.kind === 'blank') next++
      if (blocks[next]?.kind !== 'fence' && !isListItem(blocks[next])) break
    }
    let lead = kept.length - 1
    while (lead >= 0 && kept[lead].kind === 'blank') lead--
    if (block.kind === 'fence' && endsInColon(kept[lead])) kept.length = lead
    if (blocks[i + 1]?.kind === 'blank' && (!kept.length || kept.at(-1)!.kind === 'blank')) i++
  }
  for (let again = true; again;) {
    again = false
    for (let i = 0; i < kept.length && !again; i++) {
      if (kept[i].kind !== 'heading') continue
      let next = i + 1
      while (kept[next]?.kind === 'blank') next++
      if (kept[next] && !(kept[next].kind === 'heading' && kept[next].level <= kept[i].level)) continue
      kept.splice(i, next - i)
      again = true
    }
  }
  if (!kept.some((block) => block.kind !== 'blank')) return `${header}${SERVICE_STUB}`
  return `${header}${kept.flatMap((block) => block.lines).join('\n')}`
}

/** About 3 MB of markdown, so it loads on the first guide call rather than with the package. */
export function loadHyperframes(): Promise<HyperframesCorpus> {
  corpus ??= import('./hyperframes-content.js').then((m) => ({ skills: m.HYPERFRAMES_SKILL_NAMES, files: m.HYPERFRAMES_FILES }))
  return corpus
}

/**
 * Catalog lines that replace an upstream first sentence. `hyperframes` opens "Mandatory entry point:
 * read this first for any request to make ... a video", which beside Slates' guides sent the model
 * to HyperFrames' CLI workflow before `slates-motion`. Its ranking text stays upstream's.
 */
const SUMMARY_OVERRIDES: Readonly<Record<string, string>> = {
  [OVERVIEW]: "The motion engine's own overview of making and checking a composition, written for its CLI; in Slates, start from slates-motion.",
}

/** The first sentence of an upstream description, short enough for a catalog line. */
function summary(description: string, max = 160): string {
  const first = description.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/)[0]
  if (first.length <= max) return first
  return `${first.slice(0, first.lastIndexOf(' ', max - 1))}…`
}

/** Catalog entries: the summary is listed, the whole upstream description is ranked. */
export function hyperframesCatalog({ skills, files }: HyperframesCorpus): GuideCatalogEntry[] {
  return skills.map((name) => {
    const { description } = parseSkillMetadata(files[name], name)
    return { name: publicGuideName(name), description: whiteLabel(SUMMARY_OVERRIDES[name] ?? summary(description)), searchText: description, tier: 'free' as const, source: 'motion' as const }
  })
}

/** SKILL.md bodies by skill name, for the headings guide search matches. */
export function hyperframesSkillBodies({ skills, files }: HyperframesCorpus): Record<string, string> {
  return Object.fromEntries(skills.map((name) => [publicGuideName(name), whiteLabel(files[name])]))
}

/**
 * A topic naming one of these skills by its public name (`motion-core`) or its upstream one
 * (`hyperframes-core`), one of its files (`motion-animation/transitions/overview.md`) or the mapping.
 * A leading `motion/` or `hyperframes/` is accepted. Case-insensitive: topics arrive lowercased.
 * `key` is the public name; the content is white-labelled.
 */
export function findHyperframesGuide({ files }: HyperframesCorpus, topic: string): { key: string; content: string } | null {
  const t = topic.trim().toLowerCase().replace(/\\/g, '/').replace(/^(?:motion|hyperframes)\/(?=.)/, '')
  if (MAPPING_ALIASES.has(t) || t === HYPERFRAMES_MAPPING.toLowerCase()) return { key: HYPERFRAMES_MAPPING, content: whiteLabel(files[HYPERFRAMES_MAPPING]) }
  const keys = new Map<string, string>()
  for (const key of Object.keys(files)) { keys.set(key.toLowerCase(), key); keys.set(publicKey(key).toLowerCase(), key) }
  const key = keys.get(t)
  return key ? { key: publicKey(key), content: whiteLabel(files[key]) } : null
}

/** What every motion guide answer opens with: how it maps onto Slates. */
export function hyperframesGuideHeader(key: string): string {
  if (key === HYPERFRAMES_MAPPING) return ''
  return `Motion guide ${key} (Apache-2.0), written for the motion engine's own CLI and Studio. In Slates, topic motion/${HYPERFRAMES_MAPPING} says what each command and surface is; never run its npx commands.\n\n`
}

/**
 * The default card: the guide's opening, about as long as a Slates card, then its sections. Upstream
 * files have no `@card` block and often open with a one-line preamble, so the first section alone
 * would be the preamble.
 */
export function hyperframesCard(content: string, max = 1600): string {
  const sections = guideSections(content)
  const opening = sections.map((s) => s.body.trim()).filter(Boolean).join('\n\n')
  const cut = opening.length <= max ? opening : opening.slice(0, Math.max(opening.lastIndexOf('\n', max), max / 2))
  const more = cut.length < opening.length ? '\n…' : ''
  return `${cut.trim()}${more}\n\nSections (request with query, or depth "full"):\n${sections.map((s) => `- ${s.title}`).join('\n')}`
}

/** A skill's other markdown files (`skill` is its public name), as the topics that retrieve them. */
export function hyperframesFilesOf({ files }: HyperframesCorpus, skill: string): string[] {
  return Object.keys(files).map(publicKey).filter((key) => key.startsWith(`${skill}/`))
}
