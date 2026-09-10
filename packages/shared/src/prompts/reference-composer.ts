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
// Naming is the identity signal. Citing the canonical subject image inline
// ("Marcus (image 1)") tells the model which reference owns that entity. This
// is each model's own official consistency lever (NB2 "assign a
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
  // 🚨 'video-ref' IS NOT 'video'. 'video' is the EDIT SOURCE — the clip being
  // rewritten — and it emits "Video N is the motion source." Overloading it for
  // a plain reference clip would silently rewrite the prompt of the shipped
  // Kling O3 / Seedance edit path, which is the one thing the transparency
  // invariant forbids. A reference clip emits "Video N is a provided
  // reference." — and unlike the pinned-IMAGE line that used to say the same
  // thing (deleted 2026-08-10, see step 3), that sentence is real information:
  // a video attachment could genuinely be either role, so naming which one is
  // not a tautology.
  | 'video-ref'
  | 'audio-ref'

export interface ReferenceMedia {
  path: string
  mediaKind: 'image' | 'video' | 'audio'
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
  /**
   * A group can carry several images for workflows that genuinely need them.
   *
   * 🚨 A `character` GROUP MAY ALSO CARRY ONE `audio` MEDIUM — that character's
   * assigned VOICE (2026-09-09). It is the same idea as the identity image, on
   * the other axis of identity: the mention attaches what the character IS, and
   * a voice is part of that. The audio takes its number from the audio counter,
   * so adding one renumbers no image, and it is cited INLINE beside her name
   * ("Sarah (image 1, voice timbre from audio 1)") rather than as the neutral
   * `audio-ref` sentence — step 3e holds the receipt for why that is legal.
   *
   * A character group with a voice and NO identity image is a real state, not a
   * defect: `voice-without-photo` is legal on any model that reads audio alone
   * (Seedance 2.5). It cites no image and the timbre line carries the binding.
   */
  media: ReferenceMedia[]
  /**
   * What is SAID in this group's reference audio, typed by the user.
   * `audio-ref` groups only; every other kind ignores it.
   *
   * 🚨 THE MODEL RE-TRANSCRIBES REFERENCE AUDIO AND GUESSES THE WORDS.
   * Seedance does not consume a supplied take verbatim — it re-synthesises
   * something very close to it, and a field test on 2026-08-28 heard "an app
   * called Slates" come back as "a map called Slates". The audio carries the
   * voice, the accent and the timing; only TEXT carries the words. Composing
   * this line is the whole fix, and every user who attached a voice take since
   * v1.5.2 was exposed to silent mistranscription without it.
   *
   * It is USER-AUTHORED and optional. Nothing transcribes the clip and fills
   * this in: a second model in the request path silently rewriting the prompt
   * is exactly what the prompt-transparency invariant forbids. An empty value
   * composes byte-identically to before this field existed.
   */
  spokenText?: string
}

export interface ComposedReferences {
  /** The composed prompt: user's words lead, references cited inline as "image N". */
  prompt: string
  /** Free-reference image paths in cited order — flatten yields "image 1..N". */
  orderedImagePaths: string[]
  /** Video paths in cited order — "video 1..M". Edit sources and reference
   *  clips SHARE this list and one counter, so a mixed state can never emit
   *  two "Video 1"s. */
  orderedVideoPaths: string[]
  /** Reference audio paths in cited order — "audio 1..K". */
  orderedAudioPaths: string[]
  /**
   * Tokens written in the prompt that matched NO reference group, as authored
   * (`'#noir'`, `'@bob'`), first-appearance order, deduped case-insensitively.
   *
   * 🚨 IT IS A REPORT, NOT A RECEIPT FOR A DELETION. These tokens are left in
   * `prompt` EXACTLY as the user typed them (see step 2) — nothing is removed
   * and nothing is humanised. What the field says is narrower and more useful:
   * "no reference is attached for this word", which is the difference between a
   * mistyped mention and a `@handle` you meant to typeset. Callers that render a
   * composed-prompt preview SHOULD surface it — as a note, never as an error,
   * because nothing has gone wrong.
   */
  unresolvedTokens: string[]
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

/**
 * "voice timbre from audio 1" — a character's VOICE, cited inline beside her
 * name (lowercase, for inline use, exactly like `citeImages`).
 *
 * 🚨 THE ROLE WORDS ARE THE LOAD-BEARING HALF, not decoration. A bare
 * "(image 1, audio 1)" would be the UNROLED state: BytePlus's capability table
 * gives an audio reference five possible jobs — "music, dialogue, voice, tone,
 * or timbre" — and an unroled clip falls back to DIALOGUE, so the model
 * transcribes it and speaks ITS words instead of the prompt's. That is the
 * shipped defect where a supplied take came back as "a map called Slates" for
 * "an app called Slates" (2026-08-28). "voice timbre" is the vendor's own
 * phrase for the half we want: the sound of her, not her words.
 */
function citeVoice(nums: number[]): string {
  const noun = nums.length === 1 ? 'audio' : 'audios'
  return `voice timbre from ${noun} ${joinNums(nums)}`
}

function joinNums(nums: number[]): string {
  if (nums.length === 1) return String(nums[0])
  if (nums.length === 2) return `${nums[0]} and ${nums[1]}`
  return `${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}`
}

/**
 * 🚨 A SIGIL IS A MENTION ONLY IF IT RESOLVES. Everything else is prose, and
 * prose is not ours to edit.
 *
 * This grammar used to be `/([@#])([\w-]+)/g` with "unresolved" as a rewrite
 * branch: an unknown `@word` was humanised (`@woodland.candle` → "Woodland" +
 * ".candle") and an unknown `#word` was deleted outright. Both assumed anyone
 * typing a sigil was reaching for OUR feature, so the app quietly rewrote the
 * one thing the composer exists to protect — and it failed precisely where the
 * literal characters matter most: a poster's `@handle`, an email address, a hex
 * colour. That last one is not hypothetical: `#3a3a3c` was eaten out of every
 * identity-sheet prompt for months (`reference-rules.ts`, 2026-07-30), which is
 * the same bug wearing a different sigil.
 *
 * Two changes make the sigil safe to type:
 *
 * 1. THE GRAMMAR IS NARROW. A sigil only opens a token at a boundary, so
 *    `eric@gmail.com` is never even a candidate, and a token may carry interior
 *    dots, so `@woodland.candle` is ONE token rather than a mention with debris
 *    stuck to it. Interior only — a trailing `.` stays with the sentence.
 * 2. AN UNRESOLVED TOKEN IS RETURNED UNTOUCHED. A mention is a BINDING; when it
 *    binds to nothing there is nothing to translate, so there is nothing to
 *    rewrite. It is reported through `unresolvedTokens` and sent as written.
 *
 * There is deliberately NO escape syntax (`\@`, quoting). Making someone learn
 * our grammar to opt OUT of a feature they never invoked is the shoehorn this
 * change exists to remove — the sandbox rule from the root `CLAUDE.md`: a
 * capability attaches to the primitive, it does not stand in the way of it.
 */
const TOKEN_RE = /(?<![\w.@#])([@#])([\w-]+(?:\.[\w-]+)*)/g

/**
 * 🚨 A HEX COLOUR IS NOT A TAG. `#000000` is to `#` what `eric@gmail.com` is to
 * `@`: an everyday literal that happens to open with our sigil, written by
 * someone who was not reaching for our feature at all.
 *
 * The TEXT was already safe — an unresolved token is returned byte-identical
 * (see TOKEN_RE) — so what this guards is the REPORT. The `@` half of that
 * grammar gets its everyday literal excluded for free, because an email's `@`
 * sits after a word character and the boundary lookbehind kills it. A hex
 * colour gets no such help: `#` at a word boundary is exactly how a real tag is
 * written too, so `#000000` reaches `noteUnresolved` and a palette prompt
 * ("pure black #000000 with #c8ff00 accents") comes back with every colour
 * listed as *matching nothing saved* — an accusation about words that were
 * never mentions. That is the asymmetry this closes, and it is the same
 * complaint, in the same place, as `#3a3a3c` being eaten for months.
 *
 * 🚨 IT GATES THE REPORT, NOT THE GRAMMAR, and that is the whole design.
 * `fade`, `cafe`, `dead`, `beef`, `decade` and `facade` are all valid hex
 * digits AND plausible style names, so excluding hex shapes from TOKEN_RE would
 * quietly stop `#fade` from attaching a style called "Fade" — trading a noisy
 * note for a silent drop, which is the worse half of the trade every time.
 * Resolution is checked first and always wins; only a token that binds to
 * nothing ever reaches here.
 *
 * Lengths are CSS's: 3 (`#fff`), 4 (`#fff8`), 6 (`#c8ff00`), 8 (`#c8ff00ff`).
 * `#1` and `#2026` are deliberately NOT covered — an ordinal is not a colour,
 * and widening this to "anything numeric" would start swallowing tags.
 */
export function isHexColorToken(sigil: string, token: string): boolean {
  return sigil === '#' && /^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(token)
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
  startAudioNumber?: number
}

export function composeReferences(
  rawPrompt: string,
  groups: ReferenceGroup[],
  opts: ComposeOptions = {}
): ComposedReferences {
  // ── 1. Assign global numbers by walking the list in order ──
  //
  // 🚨 ONE COUNTER PER MODALITY, EACH STARTING AT 1 — never a single running
  // count across the attachments. `audio 1` is the first AUDIO, however many
  // images precede it. This is the vendors' scheme, not a convenience:
  // BytePlus states it ("The numbering should correspond to the upload order of
  // the assets, such as Image 1 / Video 1 / Audio 1") and PROVES it in a mixed
  // example that numbers two audios 1 and 2 behind four images — a global
  // counter would make them 5 and 6. fal says the same for MiniMax H3 in its
  // own prompt-field description. Receipts and line refs:
  // second-brain/business/projects/slates/research/model-prompting-research.md
  // § 2026-09-09 Multimodal reference GRAMMAR.
  //
  // Collapsing these into one counter would renumber every citation the prompt
  // makes, silently — the model would be told "audio 1" about an image.
  let imageNum = opts.startImageNumber ?? 0
  let videoNum = opts.startVideoNumber ?? 0
  let audioNum = opts.startAudioNumber ?? 0
  const orderedImagePaths: string[] = []
  const orderedVideoPaths: string[] = []
  const orderedAudioPaths: string[] = []

  interface NumberedGroup extends ReferenceGroup {
    imageNums: number[]
    videoNums: number[]
    audioNums: number[]
  }
  const numbered: NumberedGroup[] = groups.map((g) => {
    const imageNums: number[] = []
    const videoNums: number[] = []
    const audioNums: number[] = []
    for (const m of g.media) {
      // ONE video counter across the edit source and reference clips. They are
      // mutually exclusive in practice, and a shared counter means a mixed
      // state degrades to wrong-but-unambiguous rather than two "Video 1"s.
      if (m.mediaKind === 'video' && (g.kind === 'video' || g.kind === 'video-ref')) {
        videoNum += 1
        videoNums.push(videoNum)
        orderedVideoPaths.push(m.path)
      } else if (m.mediaKind === 'audio' && (g.kind === 'audio-ref' || g.kind === 'character')) {
        // ONE audio counter across hand-attached clips and a CHARACTER'S VOICE,
        // for the same reason the video counter is shared: the two are the same
        // numbered space on the wire, and a second counter would emit two
        // "Audio 1"s the moment a request carried both. Which SENTENCE names
        // the clip is what differs (step 3 vs step 3e), never the number.
        audioNum += 1
        audioNums.push(audioNum)
        orderedAudioPaths.push(m.path)
      } else if (m.mediaKind === 'image' && isFreeRefImageKind(g.kind)) {
        imageNum += 1
        imageNums.push(imageNum)
        orderedImagePaths.push(m.path)
      }
      // first-frame / last-frame media: not numbered, not in the free-ref pool.
    }
    return { ...g, imageNums, videoNums, audioNums }
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

  // Every token that named nothing, recorded as authored and deduped by the
  // same normalisation used for matching. Nothing is removed on its account —
  // it is the "no reference is attached for this word" report. See
  // ComposedReferences.unresolvedTokens.
  const unresolvedTokens: string[] = []
  const unresolvedSeen = new Set<string>()
  const noteUnresolved = (sigil: string, tok: string): void => {
    // A hex colour that binds to no style is a colour, not a mistyped tag.
    // See isHexColorToken — the text is unchanged either way; this is the note.
    if (isHexColorToken(sigil, tok)) return
    const key = normToken(`${sigil}${tok}`)
    if (unresolvedSeen.has(key)) return
    unresolvedSeen.add(key)
    unresolvedTokens.push(`${sigil}${tok}`)
  }

  // First strip "in/with the style of #tag" phrases so the style reads as a
  // clean trailing clause, not a dangling preposition (legacy cleanPrompt
  // behaviour). ONLY when the tag resolves: an unresolved one leaves the whole
  // phrase exactly as authored and falls through to the token pass below, which
  // reports it and sends it as written.
  let body = rawPrompt.replace(
    /\s+(with|in)\s+the\s+style\s+of\s+([@#])([\w-]+(?:\.[\w-]+)*)/gi,
    (_full, _prep, sigil, tok) => {
      const g = byNorm.get(normToken(`${sigil}${tok}`))
      if (g && g.kind === 'style') {
        matchedInPrompt.add(normToken(`${sigil}${tok}`))
        return ''
      }
      return _full
    }
  )

  body = body.replace(TOKEN_RE, (_full, _sigil: string, tok: string) => {
    const key = normToken(`${_sigil}${tok}`)
    const g = byNorm.get(key)
    if (!g) {
      // Not a mention — see TOKEN_RE. Reported, returned byte-identical.
      noteUnresolved(_sigil, tok)
      return _full
    }
    matchedInPrompt.add(key)
    if (g.kind === 'style') return '' // styles never inline — trailing clause only
    if (!seenFirst.has(key)) {
      seenFirst.add(key)
      // 🚨 ONE BINDING SITE PER ENTITY, CARRYING EVERY MEDIUM SHE OWNS
      // (2026-09-09). The mention attaches her face AND her voice, so both are
      // cited where her name appears rather than one inline and the other in a
      // preamble sentence above the user's own words. That split was the first
      // shape this shipped in, and it read backwards: a two-speaker prompt made
      // you hold two name→audio mappings in your head before you reached the
      // sentence, and a character with a voice and no photo said her name twice
      // while citing nothing.
      //
      // It is also closer to the vendor, not further. BytePlus's binding
      // example is ONE sentence covering both media — "Image 1 depicts the
      // protagonist John and uses the voice timbre from Audio 1." — and the
      // preamble form had already split it in half.
      //
      // 🚨 EMPTY MEANS OMITTED, NEVER AN EMPTY PARENTHESIS. A voice-only
      // character has no `imageNums` and `citeImages([])` would compose the
      // literal "images " — a citation pointing at nothing, inside the one
      // function whose whole job is that citations point at what is sent.
      const cites: string[] = []
      if (g.imageNums.length > 0) cites.push(citeImages(g.imageNums))
      if (g.audioNums.length > 0) cites.push(citeVoice(g.audioNums))
      return cites.length > 0 ? `${g.name} (${cites.join(', ')})` : g.name
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

  // Reference clips ("Video 2 is a provided reference."). This line SURVIVES
  // the 2026-08-10 cull of null-role key lines because it is not one: the
  // "motion source" wording above belongs to the edit path alone, so a video
  // attachment has two possible roles and the sentence says which. The pinned
  // IMAGE line had no such contrast partner and was deleted (see step 3).
  for (const g of numbered) {
    if (g.kind === 'video-ref' && g.videoNums.length > 0) {
      const noun = g.videoNums.length === 1 ? 'Video' : 'Videos'
      const tail = g.videoNums.length === 1 ? 'is a provided reference.' : 'are provided references.'
      topKeys.push(`${noun} ${joinNums(g.videoNums)} ${tail}`)
    }
  }

  // 🚨 A PINNED REFERENCE IMAGE GETS NO KEY LINE, DELIBERATELY (2026-08-10).
  // It used to emit "Image 1 is a provided reference." — the only branch here
  // that assigns NO role, and therefore says nothing: every image in the request
  // IS a provided reference, so the sentence restated the transport. Its
  // siblings all carry information — "is the motion source" contrasts with a
  // reference clip, "is the subject" / "is Marcus" name the thing, the style
  // clause assigns a job. This one was the null member of that set, and unlike
  // video there is no competing numbered image role for it to disambiguate
  // against (frames ride dedicated slots and are never numbered).
  //
  // It was also actively wrong for the case pinned-first exists to serve: the
  // desktop's `referenceGroups.ts` orders these images FIRST for the
  // edit/injection case (the movie still you paint over reads as image 1) —
  // where image 1 is the CANVAS, not a reference, and the line asserted the
  // opposite.
  //
  // Every vendor assigns roles inline in natural language instead. Google's own
  // multi-reference example is "the attached napkin sketch as the structure and
  // the attached fabric sample as the texture"; ByteDance's is "use @Image 2 as
  // the dormitory scene style reference". Nobody declares a null role. Our own
  // skills say the same thing: "the model does NOT infer a reference's role from
  // its position; the NAME carries it" — and this line had no name to carry.
  //
  // Do not add it back. Attaching an image already means "here is an image"; if
  // a reference needs a role, it gets one from a role badge or from the user's
  // own words, both of which compose into real sentences above.

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

  // ── Every AUDIO line, in one pass, in audio-NUMBER order ────────────────
  //
  // 🚨 AFTER the subject lines, deliberately. A key line that names a subject
  // ("Image 1 is Marcus.") has to come before a line that gives that subject's
  // media a job, or the prompt describes a voice before it says whose face it
  // belongs to. Binding is carried by the SENTENCE rather than by adjacency —
  // the vendor states that outright — so nothing on the wire depends on this;
  // what depends on it is whether the composed preview can be read top to
  // bottom, and that preview is the surface the transparency invariant rests
  // on.
  //
  // 🚨 ONE LOOP OVER THE GROUPS, NOT ONE LOOP PER KIND, AND THAT IS THE WHOLE
  // POINT OF ITS SHAPE. There are two audio sentences — a hand-attached clip's
  // neutral "Audio N is a provided reference." and a character's roled
  // "Sarah uses the voice timbre from Audio N." — and they draw their numbers
  // from the SAME counter walking THIS list. Emitting them in two passes
  // printed them in kind order instead of number order, so a request with two
  // voices and one room-tone clip opened with "Audio 3 is a provided
  // reference." and named Audio 1 and Audio 2 after it. Nothing was wrong on
  // the wire — binding is carried by the sentence, not by adjacency, which the
  // vendor states outright — but a prompt that counts backwards is a prompt
  // nobody can proofread, and the composed preview is the surface the whole
  // transparency invariant rests on. One pass over `numbered` IS number order,
  // because the numbers were assigned by the same walk.
  for (const g of numbered) {
    if (g.audioNums.length === 0) continue
    const noun = g.audioNums.length === 1 ? 'Audio' : 'Audios'
    if (g.kind === 'character') {
      // A CHARACTER'S VOICE. When her token appears in the prompt the binding
      // rides INLINE on her name (step 2) and there is nothing to say up here.
      // This is the same duality her IMAGE already has — "Sarah (image 1)"
      // inline versus "Image 1 is Sarah." when the prompt never names her — so
      // it is the existing pattern rather than a second grammar.
      //
      // Emitted from THIS pass, not from a block of its own, so it keeps its
      // place in audio-NUMBER order among the neutral lines. See the header.
      const namedInPrompt = g.token && matchedInPrompt.has(normToken(g.token))
      if (!namedInPrompt) {
        topKeys.push(`${g.name} uses the ${citeVoice(g.audioNums)}.`)
      }
      continue
    }
    if (g.kind !== 'audio-ref') continue
    // A clip the user dragged on declared no role, so it keeps the neutral
    // line, plus THE WORDS when the user has typed them — see
    // ReferenceGroup.spokenText for why the words have to travel as text as
    // well as audio.
    const tail = g.audioNums.length === 1 ? 'is a provided reference.' : 'are provided references.'
    topKeys.push(`${noun} ${joinNums(g.audioNums)} ${tail}`)
    // Trimmed, never rewritten: the words between the quotes are the user's
    // exactly as typed. The delimiters are CURLY on purpose — a straight
    // quote inside the user's own line then sits beside them without
    // colliding, so nothing has to be escaped and nothing is edited.
    const spoken = (g.spokenText ?? '').trim()
    if (spoken) {
      const lower = g.audioNums.length === 1 ? 'audio' : 'audios'
      topKeys.push(`The words spoken in ${lower} ${joinNums(g.audioNums)} are exactly: “${spoken}”`)
    }
  }


  // ── 3e. WHY A CHARACTER'S VOICE GETS A ROLE AT ALL (2026-09-09) ──────────
  //
  // The binding itself is composed INLINE beside her name (step 2), or as a
  // fallback line in the audio pass above when the prompt never names her.
  // This is the receipt for why composing a role is legal at all.
  //
  // 🚨 AUDIO IS THE ONE MODALITY WHERE THE NEUTRAL LINE UNDER-SPECIFIES, and
  // this is the sentence that closes it. An image is definitionally a
  // reference and a video has two possible roles, so both are settled by a
  // neutral line. An audio attachment has FIVE — BytePlus's own capability
  // table lists "music, dialogue, voice, tone, or timbre" — so
  // "Audio 1 is a provided reference." distinguishes a clip from nothing while
  // leaving four roles open, and an unroled clip falls back to DIALOGUE: the
  // model re-transcribes it and speaks ITS words. That is the shipped defect
  // where a supplied take came back as "a map called Slates" for "an app
  // called Slates" (2026-08-28).
  //
  // The wording is the vendor's, not ours. BytePlus's own binding sentence is
  // "Image 1 depicts the protagonist John and uses the voice timbre from
  // Audio 1."; MiniMax builds the same primitive into H3's notation
  // ("<Audio 1> is the voice-timbre reference for <Subject 1>"). Two vendors,
  // independently. The DIALOGUE therefore comes from the prompt and the clip
  // carries only the voice — receipts and line refs:
  // second-brain/business/projects/slates/research/model-prompting-research.md
  // § 2026-09-09 Multimodal reference GRAMMAR, facts 2 and 3.
  //
  // 🚨 IT IS LEGAL COMPOSITION ONLY BECAUSE THE ROLE WAS DECLARED. Assigning a
  // voice to a character IS the declaration; a clip dragged onto the rail is
  // not, and keeps the neutral line above. Inferring a role nobody declared
  // stays forbidden (`slate/.claude/rules/prompt-surface.md`).
  //
  // The citation is lowercase (`voice timbre from audio 1`) like every other
  // inline citation this composer emits. An earlier draft capitalised it to
  // match the vendor's example verbatim, which left a single capitalised
  // `Audio 1` sitting mid-sentence among lowercase `image 1`s; moving the
  // binding inline removed the reason for the exception along with the
  // exception.

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
    orderedAudioPaths,
    unresolvedTokens,
  }
}

// ═══════════════════════════════════════════════════════════════
// Seed Audio VOICE transport adapter
// ═══════════════════════════════════════════════════════════════

/** One character's voice sample, in the order it is attached. */
export interface VoiceCitation {
  /**
   * The mention this voice answers to — '@sarah', or null when the character
   * is attached without being mentioned.
   *
   * Matched through `normToken`, so '@Big Red', '@big_red' and '@big-red' are
   * the same token. It is therefore NOT guaranteed byte-equal to what the
   * prompt authored: the desktop builds it from the character's NAME while the
   * agent passes the token as typed, and both resolve identically. Do not echo
   * it back to a user as "what they wrote".
   */
  token: string | null
  /** 'Sarah' — the character's name, used verbatim. */
  name: string
}

/**
 * Translate `@character` mentions into Seed Audio's OWN `@AudioN` notation.
 *
 * 🚨 AN ADAPTER, NOT A SECOND COMPOSER — the same relationship
 * `composeKlingEdit` has to `composeReferences`. Seed Audio does not read
 * "audio 1"; it reads `@Audio1`-`@Audio3`, and a clip the prompt never cites is
 * a clip the model ignores. Attaching a voice without citing it would be the
 * silent-drop failure this repo catalogues by name: attach the reference, get
 * no error, get no warning, and get a request that does nothing with it.
 *
 * It emits the SAME grammar the image composer uses — the first mention
 * becomes `Sarah (@Audio1)`, later ones stay `Sarah` — so the NAME still
 * carries the identity and the citation carries the slot. A voice that is
 * attached but never mentioned gets one short key line instead, exactly as an
 * unmentioned character's image does.
 *
 * Everything else is left as authored: an `@token` that is not one of these
 * voices is not ours to touch.
 *
 * A `null` slot means "this position is a clip the caller cites itself" — it
 * holds its @AudioN number and is otherwise ignored.
 */
export function composeVoiceCitations(
  rawPrompt: string,
  voices: Array<VoiceCitation | null>
): string {
  if (voices.length === 0) return rawPrompt

  const byNorm = new Map<string, { n: number; name: string }>()
  voices.forEach((v, i) => {
    if (v?.token) byNorm.set(normToken(v.token), { n: i + 1, name: v.name })
  })

  const seen = new Set<string>()
  const body = rawPrompt.replace(/@([\w-]+)/g, (full, tok: string) => {
    const key = normToken(`@${tok}`)
    const v = byNorm.get(key)
    if (!v) return full
    if (seen.has(key)) return v.name
    seen.add(key)
    return `${v.name} (@Audio${v.n})`
  })

  const keys: string[] = []
  voices.forEach((v, i) => {
    // A null slot is a clip the CALLER already cited itself (the agent route
    // passes its own `audioReferenceAssetIds` this way). It still occupies its
    // @AudioN position — renumbering would repoint every citation a published
    // CLI build wrote — but it is not ours to name.
    if (!v) return
    if (v.token && seen.has(normToken(v.token))) return
    keys.push(`${v.name} is @Audio${i + 1}.`)
  })
  if (keys.length === 0) return body

  const trimmed = body.trim()
  return trimmed ? `${keys.join(' ')}\n\n${trimmed}` : keys.join(' ')
}

// ═══════════════════════════════════════════════════════════════
// Kling O3 video-to-video EDIT transport adapter
// ═══════════════════════════════════════════════════════════════

export interface KlingEditElement {
  /** Frontal image path/URL (element primary view) */
  frontal: string
  /** Up to 3 additional angle images */
  angles: string[]
  /** Display name (for logging/echo) */
  name: string
}

export interface KlingEditComposition {
  /** Prompt in Kling's edit notation: @Video1 (source), @ElementN, @ImageN */
  prompt: string
  /** Subject elements in cited order (@Element1..) */
  elements: KlingEditElement[]
  /** Style/appearance reference image paths in cited order (@Image1..) */
  styleImages: string[]
}

/** fal cap: max 4 combined element + style-image references per edit request. */
export const KLING_EDIT_MAX_REFS = 4

/**
 * Compose references for the Kling O3 edit endpoint. Unlike the "image N"
 * naming every other model parses, Kling's edit endpoint has its OWN official
 * notation: `@Video1` (the source clip), `@Element1..` (subjects, frontal +
 * angle images), `@Image1..` (style/appearance refs). This adapter translates
 * the one-ordered-list groups into that notation — the same prompt-is-law
 * principle, different citation tokens.
 *
 * - character/environment groups → elements (media[0] = frontal, rest = angles,
 *   max 3 angles per fal's schema)
 * - style/pinned image groups → @ImageN style refs
 * - video groups are ignored here — the source clip is transported separately
 *   and is always @Video1
 * - combined element+image count is capped at KLING_EDIT_MAX_REFS (style refs
 *   trimmed first — subjects are the feature)
 */
export function composeKlingEdit(rawPrompt: string, groups: ReferenceGroup[]): KlingEditComposition {
  const elements: KlingEditElement[] = []
  const styleImages: string[] = []
  const styleNums: number[] = []
  let body = rawPrompt

  // Subjects first — they own the @ElementN numbering.
  const subjectGroups = groups.filter(
    (g) => (g.kind === 'character' || g.kind === 'environment') && g.media.some((m) => m.mediaKind === 'image')
  )
  for (const g of subjectGroups) {
    if (elements.length >= KLING_EDIT_MAX_REFS) break
    const imgs = g.media.filter((m) => m.mediaKind === 'image').map((m) => m.path)
    if (imgs.length === 0) continue
    const n = elements.length + 1
    elements.push({ frontal: imgs[0], angles: imgs.slice(1, 4), name: g.name })
    if (g.token) {
      // Replace every @token occurrence with the element citation.
      const escaped = g.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`${escaped}\\b`, 'gi')
      if (re.test(body)) {
        body = body.replace(re, `@Element${n}`)
      } else {
        body = `${body}\n@Element${n} is ${g.name}.`
      }
    } else {
      body = `${body}\n@Element${n} is ${g.name}.`
    }
  }

  // Style / pinned refs take the remaining slots as @ImageN.
  for (const g of groups) {
    if (g.kind !== 'style' && g.kind !== 'pinned') continue
    for (const m of g.media) {
      if (m.mediaKind !== 'image') continue
      if (elements.length + styleImages.length >= KLING_EDIT_MAX_REFS) break
      styleImages.push(m.path)
      const n = styleImages.length
      if (g.kind === 'style') styleNums.push(n)
      if (g.token) {
        const escaped = g.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        body = body.replace(new RegExp(`${escaped}\\b`, 'gi'), `@Image${n}`)
      }
    }
  }

  if (styleNums.length > 0) {
    const cites = styleNums.map((n) => `@Image${n}`).join(' and ')
    body = `${body}\nApply the visual style of ${cites}.`
  }

  // The source clip is always @Video1 — anchor the instruction to it.
  if (!/@Video1\b/i.test(body)) {
    body = `Edit @Video1: ${body}`
  }

  return {
    prompt: body.replace(/[ \t]{2,}/g, ' ').trim(),
    elements,
    styleImages,
  }
}
