// Reference composition — the prompt-as-SSOT composer.
//
// THE PRINCIPLE: the prompt box is the single source of truth. The app's ENTIRE
// contribution to the model prompt is (a) translate @mentions/#tags into the
// lightweight "image N" naming the models actually parse, and (b) name
// token-less references (pinned images, frames, videos) by number. Nothing
// else — no role essays, no "ignore the outfit", no injected lighting/expression
// rules. What the user writes is what leads.
//
// This is the canonical implementation. It is mirrored byte-for-byte into the
// desktop app's `slate/src/shared/promptComposition.ts` (the desktop installs
// the published @slatesvideo/shared from npm and cannot file-import this source,
// so the mirror carries a header pointing here). Both the agent/MCP paths and
// the desktop generation + rail read from this one function, so the rail's badge
// numbers and the prompt's "image N" citations can never desync.
//
// Naming is the ONLY identity signal. Citing both of a subject's images as the
// SAME name ("Marcus (images 1 and 2)") tells the model they are ONE entity —
// which is what prevents a multi-image bucket from averaging into a blended
// face. This IS each model's own official consistency lever (NB2 "assign a
// distinct name", Seedance "Reference Subject_N in Image_N", Kling "reuse a fixed
// label verbatim"); the heavy role-essay block was the off-doctrine part.

export type ReferenceKind =
  | 'character'
  | 'environment'
  | 'style'
  | 'pinned'
  | 'first-frame'
  | 'last-frame'
  | 'video'

export interface ReferenceMedia {
  path: string
  mediaKind: 'image' | 'video'
}

/**
 * A named bucket of reference media that can be @mentioned. The whole definition
 * of a reference. It does NOT mandate a structure — one photo or eight angles,
 * the composer treats them all as "this is one named thing".
 */
export interface ReferenceGroup {
  /** '@Marcus' | '@Cafe' | '#noir' | null (pinned / frames / picked video) */
  token: string | null
  /** Display + citation name: 'Marcus' | 'the cafe' | 'noir'. Used verbatim. */
  name: string
  kind: ReferenceKind
  /** A group can carry several images (e.g. turnaround + expression). */
  media: ReferenceMedia[]
}

export interface ComposedReferences {
  /** The composed prompt: user's words lead, references cited inline as "image N". */
  prompt: string
  /** Free-reference image paths in cited order — flatten yields "image 1..N". */
  orderedImagePaths: string[]
  /** Video reference paths in cited order — "video 1..M". */
  orderedVideoPaths: string[]
}

// Normalize a name/token for matching: drop the sigil, lowercase, strip
// spaces/underscores/hyphens. "@big_red" / "@Big Red" / "#Big-Red" all collapse
// to the same key. Identical to the agent-side resolver's `norm`.
function normToken(s: string): string {
  return s.toLowerCase().replace(/[@#]/g, '').replace(/[\s_-]+/g, '')
}

// Free-reference IMAGE kinds get an "image N" number. Frames are transported in
// their own dedicated slots (start/last frame) by the per-model adapter and are
// NOT part of the free-reference numbering — see the reference-rules note that
// first/last-frame can't mix with free refs on models like Seedance.
function isFreeRefImageKind(kind: ReferenceKind): boolean {
  return kind === 'character' || kind === 'environment' || kind === 'style' || kind === 'pinned'
}

/** "image 5" / "images 5 and 6" / "images 5, 6 and 7" (lowercase, for inline use). */
function citeImages(nums: number[]): string {
  const noun = nums.length === 1 ? 'image' : 'images'
  return `${noun} ${joinNums(nums)}`
}

function joinNums(nums: number[]): string {
  if (nums.length === 1) return String(nums[0])
  if (nums.length === 2) return `${nums[0]} and ${nums[1]}`
  return `${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}`
}

// Humanize an unresolved @token to plain words (preserve the legacy cleanPrompt
// fallback: @big_red → "Big Red", @forest3 → "Forest3"). Never send a raw token.
function humanizeToken(raw: string): string {
  return raw
    .split(/[_-]/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/**
 * Compose the raw prompt (mentions intact) + an ORDERED list of reference groups
 * into the named prompt text + ordered media the API receives. The group order
 * IS the send order — image numbers are assigned by walking the list, so the
 * caller controls numbering by ordering the list (default: pinned/base first,
 * then @mentions in first-appearance order, then #style last).
 *
 * @param rawPrompt  the user's prompt with @mentions / #tags still in it
 * @param groups     the single ordered ReferenceGroup[] (rail + prompt read this)
 * @param opts.startImageNumber  images already attached AHEAD of these groups
 *   (e.g. a grid-cell base that is "image 1" before the free-refs). Free-ref
 *   numbering and orderedImagePaths begin after it. Default 0.
 */
export interface ComposeOptions {
  startImageNumber?: number
  startVideoNumber?: number
}

export function composeReferences(
  rawPrompt: string,
  groups: ReferenceGroup[],
  opts: ComposeOptions = {}
): ComposedReferences {
  // ── 1. Assign global numbers by walking the list in order ──
  let imageNum = opts.startImageNumber ?? 0
  let videoNum = opts.startVideoNumber ?? 0
  const orderedImagePaths: string[] = []
  const orderedVideoPaths: string[] = []

  interface NumberedGroup extends ReferenceGroup {
    imageNums: number[]
    videoNums: number[]
  }
  const numbered: NumberedGroup[] = groups.map((g) => {
    const imageNums: number[] = []
    const videoNums: number[] = []
    for (const m of g.media) {
      if (m.mediaKind === 'video' && g.kind === 'video') {
        videoNum += 1
        videoNums.push(videoNum)
        orderedVideoPaths.push(m.path)
      } else if (m.mediaKind === 'image' && isFreeRefImageKind(g.kind)) {
        imageNum += 1
        imageNums.push(imageNum)
        orderedImagePaths.push(m.path)
      }
      // first-frame / last-frame media: not numbered, not in the free-ref pool.
    }
    return { ...g, imageNums, videoNums }
  })

  // ── 2. Inline-name token groups in the prompt body ──
  // For each character/environment group whose token appears in the prompt, the
  // FIRST occurrence becomes "Name (image N)"; later ones become just "Name".
  // Style tokens are removed (a single trailing clause carries the style). Token
  // groups NOT found in the prompt fall through to a key line in step 3.
  const tokenGroups = numbered.filter((g) => g.token && (g.kind === 'character' || g.kind === 'environment' || g.kind === 'style'))
  const byNorm = new Map<string, NumberedGroup>()
  for (const g of tokenGroups) byNorm.set(normToken(g.token as string), g)

  const seenFirst = new Set<string>()
  const matchedInPrompt = new Set<string>()

  // First strip "in/with the style of #tag" phrases so the style reads as a
  // clean trailing clause, not a dangling preposition (legacy cleanPrompt behaviour).
  let body = rawPrompt.replace(/\s+(with|in)\s+the\s+style\s+of\s+([@#])([\w-]+)/gi, (full, _prep, sigil, tok) => {
    const g = byNorm.get(normToken(`${sigil}${tok}`))
    if (g && g.kind === 'style') {
      matchedInPrompt.add(normToken(`${sigil}${tok}`))
      return ''
    }
    return full
  })

  body = body.replace(/([@#])([\w-]+)/g, (_full, _sigil, tok: string) => {
    const key = normToken(`${_sigil}${tok}`)
    const g = byNorm.get(key)
    if (!g) {
      // Unresolved token. A #unknown vanishes; an @unknown humanizes to words.
      return _sigil === '#' ? '' : humanizeToken(tok)
    }
    matchedInPrompt.add(key)
    if (g.kind === 'style') return '' // styles never inline — trailing clause only
    if (!seenFirst.has(key)) {
      seenFirst.add(key)
      return `${g.name} (${citeImages(g.imageNums)})`
    }
    return g.name
  })

  // Collapse the whitespace the token removals left behind.
  body = body.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim()

  // ── 3. Build the key lines for token-less / unmatched-token groups ──
  // Video sources, pinned/base canvases, and picked subjects that have no token
  // in the prompt each get ONE short neutral key line (never an essay). The user's
  // own prompt supplies the intent ("this exact frame", "the man becomes…").
  const topKeys: string[] = []

  // Video sources first ("Video 1 is the motion source.").
  for (const g of numbered) {
    if (g.kind === 'video' && g.videoNums.length > 0) {
      const noun = g.videoNums.length === 1 ? 'Video' : 'Videos'
      const verb = g.videoNums.length === 1 ? 'is' : 'are'
      topKeys.push(`${noun} ${joinNums(g.videoNums)} ${verb} the motion source.`)
    }
  }

  // Pinned/base references ("Image 1 is a provided reference.").
  for (const g of numbered) {
    if (g.kind === 'pinned' && g.imageNums.length > 0) {
      const noun = g.imageNums.length === 1 ? 'Image' : 'Images'
      const tail = g.imageNums.length === 1 ? 'is a provided reference.' : 'are provided references.'
      topKeys.push(`${noun} ${joinNums(g.imageNums)} ${tail}`)
    }
  }

  // Token-less or not-in-prompt subjects/environments ("Image 1 is Marcus.").
  for (const g of numbered) {
    if ((g.kind === 'character' || g.kind === 'environment') && g.imageNums.length > 0) {
      const tokenWasMatched = g.token && matchedInPrompt.has(normToken(g.token))
      if (!tokenWasMatched) {
        const noun = g.imageNums.length === 1 ? 'Image' : 'Images'
        const verb = g.imageNums.length === 1 ? 'is' : 'are'
        topKeys.push(`${noun} ${joinNums(g.imageNums)} ${verb} ${g.name}.`)
      }
    }
  }

  // ── 4. Style trailing clause (one, at the end — style reads best last) ──
  const styleNums: number[] = []
  for (const g of numbered) {
    if (g.kind === 'style') styleNums.push(...g.imageNums)
  }
  const styleClauses: string[] = []
  if (styleNums.length > 0) {
    styleClauses.push(`Render in the visual style of ${citeImages(styleNums)}.`)
  }

  // ── 5. Assemble: [top key line] · [body] · [style clause], blank-line separated ──
  const parts: string[] = []
  if (topKeys.length > 0) parts.push(topKeys.join(' '))
  if (body) parts.push(body)
  if (styleClauses.length > 0) parts.push(styleClauses.join(' '))

  return {
    prompt: parts.join('\n\n'),
    orderedImagePaths,
    orderedVideoPaths,
  }
}
