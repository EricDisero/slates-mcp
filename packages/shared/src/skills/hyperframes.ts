// HyperFrames' own skills, shipped unmodified in `skills/hyperframes/` (its NOTICE and the timeline
// engine plan § 6a). Slates' skills direct and these carry the craft: guide search lists them beside
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
  hyperframes: "HyperFrames' own overview of making and checking a composition, written for its CLI; in Slates, start from slates-motion.",
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
    return { name, description: SUMMARY_OVERRIDES[name] ?? summary(description), searchText: description, tier: 'free' as const, source: 'hyperframes' as const }
  })
}

/** SKILL.md bodies by skill name, for the headings guide search matches. */
export function hyperframesSkillBodies({ skills, files }: HyperframesCorpus): Record<string, string> {
  return Object.fromEntries(skills.map((name) => [name, files[name]]))
}

/**
 * A topic naming a HyperFrames skill (`hyperframes-core`), one of its files
 * (`hyperframes-animation/transitions/overview.md`) or the mapping. A leading `hyperframes/` is
 * accepted, the way the folder sits in the package. Case-insensitive: topics arrive lowercased.
 */
export function findHyperframesGuide({ files }: HyperframesCorpus, topic: string): { key: string; content: string } | null {
  const t = topic.trim().toLowerCase().replace(/\\/g, '/')
  if (MAPPING_ALIASES.has(t)) return { key: HYPERFRAMES_MAPPING, content: files[HYPERFRAMES_MAPPING] }
  const keys = new Map(Object.keys(files).map((key) => [key.toLowerCase(), key]))
  const key = keys.get(t) ?? (t.startsWith('hyperframes/') ? keys.get(t.slice('hyperframes/'.length)) : undefined)
  return key ? { key, content: files[key] } : null
}

/** What every HyperFrames guide answer opens with: where it comes from and how it maps onto Slates. */
export function hyperframesGuideHeader(key: string): string {
  if (key === HYPERFRAMES_MAPPING) return ''
  return `HyperFrames guide ${key} (HeyGen, Apache-2.0, unmodified), written for HyperFrames' own CLI and Studio. In Slates, topic hyperframes/${HYPERFRAMES_MAPPING} says what each command and surface is; never run npx hyperframes.\n\n`
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

/** A skill's other markdown files, as the topics that retrieve them. */
export function hyperframesFilesOf({ files }: HyperframesCorpus, skill: string): string[] {
  return Object.keys(files).filter((key) => key.startsWith(`${skill}/`))
}
