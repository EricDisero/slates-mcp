const STOP_WORDS = new Set('a an and are as at be by can do for from have he her him his i in into is it its me my of on or our please she that the their them these they this those to was want we were with you your slates'.split(' '))

/** Shared task vocabulary, without substring matches or grammatical filler. */
export function searchTerms(text: string, additionalStopWords: readonly string[] = []): string[] {
  const omitted = new Set([...STOP_WORDS, ...additionalStopWords])
  const normalize = (word: string): string => {
    if (/^movies?$/.test(word)) return 'film'
    if (/^animat(?:e|ed|ing|ion|ions)$/.test(word)) return 'animate'
    if (/^photograph(?:s)?$/.test(word)) return 'photo'
    if (/^(voiceover|narration)s?$/.test(word)) return 'voice'
    if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y'
    if (word.length > 3 && word.endsWith('s') && !/(ss|us|ics)$/.test(word)) return word.slice(0, -1)
    return word
  }
  const words = text.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? []
  // Filler is checked before and after normalizing, so "this" never survives as "thi".
  return [...new Set(words.filter(word => !omitted.has(word)).map(normalize))].filter(word => word.length > 1 && !omitted.has(word))
}
