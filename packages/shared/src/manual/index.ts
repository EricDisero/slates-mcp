import { APP_MANUAL } from './content.js'

export { APP_MANUAL }

/** Return whole heading sections, never a truncated sentence or invented UI step. */
export function appManualSections(query?: string): string {
  if (!query?.trim()) return APP_MANUAL
  const terms = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  const sections = APP_MANUAL.split(/(?=^#{1,6} )/m)
  const ranked = sections.map((text, index) => {
    const lower = text.toLowerCase()
    const heading = lower.split('\n', 1)[0]
    const score = terms.reduce((sum, term) => sum + (heading.includes(term) ? 4 : lower.includes(term) ? 1 : 0), 0)
    return { text, index, score }
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.index - b.index)
  if (!ranked.length) return 'No matching manual section. Available headings:\n' + sections
    .map((s) => s.split('\n', 1)[0]).filter((s) => s.startsWith('#')).join('\n')
  return ranked.slice(0, 5).map((s) => s.text.trim()).join('\n\n')
}
