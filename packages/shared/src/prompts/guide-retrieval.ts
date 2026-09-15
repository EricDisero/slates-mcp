import { craftCard } from './craft-cards.js'

export type GuideDepth = 'card' | 'index' | 'section' | 'full'

/** Parse headings outside code fences; maintainer comments never reach agents. */
export function guideSections(content: string): Array<{ title: string; body: string }> {
  const clean = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').replace(/<!--[\s\S]*?-->/g, '').trim()
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

/** Bounded retrieval. A missing card never silently expands to the full guide. */
export function retrieveGuide(skill: string, content: string, depth: GuideDepth, query?: string): string {
  const sections = guideSections(content)
  const index = sections.map((s) => `- ${s.title}`).join('\n')
  if (depth === 'full') return sections.map((s) => s.body.trim()).join('\n\n')
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
  const card = craftCard(skill)
  return `${card ?? sections[0]?.body.trim().slice(0, 1600) ?? 'No overview available.'}\n\nSections (request with query, or depth "full"):\n${index}`
}
