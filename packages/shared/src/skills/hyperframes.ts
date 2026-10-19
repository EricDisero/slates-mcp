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
 * CLI's commands, which the mapping file says never to run in Slates.
 */
export function whiteLabel(text: string): string {
  return text
    .replace(/\bremotion-to-hyperframes\b/g, 'remotion-to-motion')
    .replace(/(?<![\w@/._-])hyperframes-(animation|audio|cli|core|creative|keyframes|registry|studio)\b/g, 'motion-$1')
    .replace(/\bHyper[Ff]rames\b/g, 'Slates motion')
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
