import { craftCardOf } from './craft-cards.js'
import { BRAIN_ROUTER, OVERLAY_LEAD, OVERLAY_SHARED_LEAD, PLAYBOOKS, operativeSummary, splitOverlay } from './brain.js'

export type GuideDepth = 'card' | 'index' | 'section' | 'full'

/** Parse headings outside code fences; maintainer comments never reach agents. */
export function guideSections(content: string): Array<{ title: string; body: string }> {
  const clean = content.replace(/<!--[\s\S]*?-->/g, '').trimStart().replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim()
  const sections: Array<{ title: string; body: string }> = []
  let current = { title: 'Overview', body: '' }
  let fenced = false
  for (const line of clean.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) fenced = !fenced
    if (!fenced && /^#{1,3} /.test(line)) {
      if (current.body.trim()) sections.push(current)
      current = { title: line.replace(/^#+ /, ''), body: line }
    } else current.body += '\n' + line
  }
  if (current.body.trim()) sections.push(current)
  return sections
}

/** What a file leads with: a model guide's craft card, else its operative summary, else the top of its first section. */
function leadOf(skill: string, content: string): string {
  return craftCardOf(skill, content) ?? operativeSummary(content) ?? guideSections(content)[0]?.body.trim().slice(0, 1600) ?? 'No overview available.'
}

/**
 * The depth a request is served at. The router, the index of the brain, and every playbook, whose steps the
 * Director card says to follow (a summary of steps is not the steps), are served whole at the default depth;
 * rules and model guides stay at their card.
 */
export function servedDepth(skill: string, depth: GuideDepth, query?: string): GuideDepth {
  return (skill === BRAIN_ROUTER || PLAYBOOKS.has(skill)) && depth === 'card' && !query?.trim() ? 'full' : depth
}

/** Bounded retrieval. A missing card never silently expands to the full guide. */
export function retrieveGuide(skill: string, content: string, requested: GuideDepth, query?: string): string {
  const depth = servedDepth(skill, requested, query)
  const overlay = splitOverlay(content)
  if (overlay) {
    // Their file over a shared guide: their summary or card, then the shared one; a deeper read takes both bodies.
    if (depth === 'full') return retrieveOne(skill, content, depth)
    if (depth === 'index' || query?.trim()) return `${OVERLAY_LEAD}\n\n${retrieveOne(skill, content, depth, query)}`
    const index = guideSections(content).map((s) => `- ${s.title}`).join('\n')
    return `${OVERLAY_LEAD}\n\n${leadOf(skill, overlay.theirs)}\n\n${OVERLAY_SHARED_LEAD}\n\n${leadOf(skill, overlay.shared)}\n\nSections (request with query, or depth "full"):\n${index}`
  }
  return retrieveOne(skill, content, depth, query)
}

function retrieveOne(skill: string, content: string, depth: GuideDepth, query?: string): string {
  const sections = guideSections(content)
  const index = sections.map((s) => `- ${s.title}`).join('\n')
  // Stripped maintainer comments leave runs of blank lines behind.
  if (depth === 'full') return sections.map((s) => s.body.trim()).join('\n\n').replace(/\n{3,}/g, '\n\n')
  if (depth === 'index') return index
  if (query?.trim()) {
    const q = query.trim().toLowerCase()
    // Exact technique IDs return one complete row with its source heading.
    for (const s of sections) {
      const row = s.body.split('\n').find((line) => line.toLowerCase().startsWith(`| \`${q}\` |`))
      if (row) return `${s.title}\n\n| Technique | Evidence | What it does | Reach for · skip | Say |\n|---|---|---|---|---|\n${row}`
    }
    const words = q.split(/[^\p{L}\p{N}-]+/u).filter(Boolean)
    const ranked = sections.map((s) => ({ s, score: words.reduce((n, w) => n + (s.title.toLowerCase().includes(w) ? 4 : s.body.toLowerCase().includes(w) ? 1 : 0), 0) }))
      .filter((x) => x.score > 0).sort((a, b) => b.score - a.score)
    if (!ranked.length) return `No section matches "${query}". Available sections:\n${index}`
    const body = ranked[0].s.body.trim()
    if (body.length <= 6000) return body
    // Never cut a table row or a worked prompt mid-sentence.
    return `Section "${ranked[0].s.title}" is too large for a selective response. Use a technique ID or depth "full".\n${index}`
  }
  // A model guide's summary is its craft card; every other file leads with an operative summary.
  return `${leadOf(skill, content)}\n\nSections (request with query, or depth "full"):\n${index}`
}
