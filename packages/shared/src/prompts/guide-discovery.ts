import { parseSkillMetadata } from '../skills/metadata.js'
import { guideSections } from './guide-retrieval.js'
import { searchTerms } from './search-terms.js'

export interface GuideCatalogEntry {
  name: string
  description: string
  tier: 'free' | 'paid'
  /** HyperFrames' own skills (`skills/hyperframes.ts`): they carry the craft, Slates' guides direct. */
  source?: 'hyperframes'
  /** What ranking reads when `description` is a listing summary. */
  searchText?: string
}

// Brief filler that matches guides by accident ("30 second", "how much", "I need").
const GUIDE_FILLER = ['create', 'make', 'use', 'video', 'image', 'need', 'how', 'much', 'turn', 'keep', 'get', 'like', 'just', 'about', 'every', 'second', 'minute']
const words = (text: string): string[] => searchTerms(text, GUIDE_FILLER).filter(word => !/^\d{1,2}$/.test(word))
// A brief that names an ad: Slates' own guides then rank above every HyperFrames guide (engine plan § 6a).
const AD_WORDS = new Set(words('ad ads advert advertisement advertising commercial ugc campaign'))

/** Metadata is the catalog; headings supply technique vocabulary without returning whole guides. */
export function guideCatalog(skills: Readonly<Record<string, string>>): GuideCatalogEntry[] {
  return Object.keys(skills).sort().map(name => ({ ...parseSkillMetadata(skills[name], name), tier: 'free' as const }))
}

export function discoverGuides(
  entries: readonly GuideCatalogEntry[],
  skills: Readonly<Record<string, string>>,
  query?: string,
  limit?: number,
  offset = 0,
) {
  const terms = words(query ?? '')
  const documents = entries.map(entry => {
    const sections = skills[entry.name] ? guideSections(skills[entry.name]) : []
    const listed = new Set(words(`${entry.name.replace(/-/g, ' ')} ${entry.description}`))
    const metadata = entry.searchText ? new Set([...listed, ...words(entry.searchText)]) : listed
    const headings = sections.map(section => ({ heading: section.title, terms: new Set(words(section.title)) }))
    return { entry, listed, metadata, headings }
  })
  // Rare terms in the corpus carry more weight than generic production vocabulary. Rarity is measured
  // on Slates' own guides, so adding HyperFrames' 21 never re-weights how Slates' guides rank.
  const own = documents.filter(doc => doc.entry.source !== 'hyperframes')
  const frequency = new Map(terms.map(term => [term, own.filter(doc => doc.metadata.has(term) || doc.headings.some(section => section.terms.has(term))).length]))
  const adBrief = terms.some(term => AD_WORDS.has(term))
  const hyperframesLast = (entry: GuideCatalogEntry): number => (adBrief && entry.source === 'hyperframes' ? 1 : 0)
  const ranked = documents.map(doc => {
    const matched = terms.filter(term => doc.metadata.has(term) || doc.headings.some(section => section.terms.has(term)))
    // A HyperFrames description is a long trigger list; only its listed summary and name weigh as metadata.
    const score = matched.reduce((sum, term) => sum + Math.log(1 + own.length / (1 + (frequency.get(term) ?? 0))) * (doc.listed.has(term) ? 3 : 1), 0)
    const sections = doc.headings.filter(section => matched.some(term => section.terms.has(term))).slice(0, 3).map(section => section.heading)
    return { ...doc.entry, matched, sections, score }
  }).filter(entry => !terms.length || entry.score > 0)
    // A browse keeps the catalog's order, Slates' guides first; only a search re-ranks (the sort is stable).
    .sort((a, b) => (terms.length ? hyperframesLast(a) - hyperframesLast(b) || b.score - a.score || a.name.localeCompare(b.name) : 0))
  // An unfamiliar brief still exposes the catalog and its pagination; it never asks the user to route it.
  const fallback = terms.length > 0 && ranked.length === 0
  const candidates = fallback ? documents.map(doc => ({ ...doc.entry, matched: [] as string[], sections: [] as string[], score: 0 })) : ranked
  // Browsing, or a brief with no keyword match, returns the whole catalog unless the caller pages it.
  const size = limit ?? (terms.length && !fallback ? 8 : candidates.length)
  const page = candidates.slice(offset, offset + size).map(({ score: _score, searchText: _searchText, ...entry }) => entry)
  // Keyword ranking only sees shared words, so the first page of a search also carries
  // every other guide's description: the model chooses by the brief, as with native skills.
  const shown = new Set(page.map(entry => entry.name))
  const rest = terms.length && !fallback && offset === 0 ? entries.filter(entry => !shown.has(entry.name)).map(({ searchText: _searchText, ...entry }) => entry) : []
  return { query: query ?? null, fallback, total: candidates.length, offset, nextOffset: offset + page.length < candidates.length ? offset + page.length : null, guides: page, rest }
}
