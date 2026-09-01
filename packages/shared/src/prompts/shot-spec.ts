// The Shot — the prompt bar, serialized.
//
// THE PRINCIPLE: a generation's full recipe already exists (the desktop writes
// `referenceGroups` into every `settings_json`), but only as a byproduct of
// spending money on it. This module gives that structure a NAME, so it can be
// listed, forked, agent-authored and restored without loss — before anything
// has been generated.
//
// This is the canonical implementation. It is mirrored byte-for-byte into the
// desktop app's `slate/src/shared/shotSpec.ts` (the desktop installs the
// published @slatesvideo/shared from npm and cannot file-import this source, so
// the mirror carries a header pointing here — the same rule
// `reference-composer.ts` follows). `slate/scripts/composer-mirror-check.mjs`
// asserts the two agree; do not invent a second sync mechanism.
//
// 🚨 KEEP THIS A DEPENDENCY-FREE LEAF. It imports nothing, in either repo. The
// desktop's renderer bundles its mirror, the desktop's MAIN process reads it,
// and the op surface here builds Zod schemas from it — a single `node:` import
// would break the first of those.

/**
 * Role an attachment carries in the composer tray. User-set, never inferred.
 *
 * 🚨 THIS UNION IS THE ONE ROLE LIST. The desktop's
 * `slate/src/shared/attachmentRoles.ts` derives every map from it with
 * `satisfies Record<AttachmentRole, …>`, so adding a role here is a COMPILE
 * ERROR in the store buckets, the group kinds, the group names, the storage
 * writer and the ops — never a silent gap. It used to be defined in the
 * desktop renderer; it moved here when `ShotSpec` needed to be keyed by it in
 * both repos.
 *
 * `video-reference` / `audio-reference` are REFERENCE roles, not modes:
 * attaching a clip as a reference leaves the create surface alone, while "Edit
 * with AI" is the separate, deliberate choice that swaps the surface.
 */
export type AttachmentRole =
  | 'reference'
  | 'first-frame'
  | 'last-frame'
  | 'subject'
  | 'style'
  | 'video-reference'
  | 'audio-reference'

/**
 * The roles that hold an ORDERED, multi-occupancy list.
 *
 * Derived from the union by subtraction, never retyped: the two frame slots are
 * scalars (single-occupancy, no order to change and no index to address), and a
 * hand-written second union would be the exact hand-typed re-derivation this
 * module exists to prevent.
 */
export type OrderedAttachmentRole = Exclude<AttachmentRole, 'first-frame' | 'last-frame'>

/**
 * Emission ORDER of the ordered roles — the order `buildReferenceGroups` pushes
 * them in, which is the order the composer numbers them in, which is the order
 * the rail badges them in. Changing a number here changes what the model is
 * told, so treat it exactly like the composer's own ordering.
 *
 * `satisfies Record<OrderedAttachmentRole, number>` is what makes a new role a
 * compile error here rather than a missing bucket at runtime.
 */
export const ORDERED_ROLE_EMISSION = {
  reference: 0,
  subject: 1,
  style: 2,
  'video-reference': 3,
  'audio-reference': 4,
} as const satisfies Record<OrderedAttachmentRole, number>

/** The ordered roles, in emission order. Sorted from the map above so the two
 *  cannot disagree — never a second hand-written array. */
export const ORDERED_ATTACHMENT_ROLES: readonly OrderedAttachmentRole[] = (
  Object.keys(ORDERED_ROLE_EMISSION) as OrderedAttachmentRole[]
).sort((a, b) => ORDERED_ROLE_EMISSION[a] - ORDERED_ROLE_EMISSION[b])

/**
 * Everything on the prompt bar that is NOT the prompt, the model or an
 * attachment. Every field is optional and every field is a value the composer
 * already persists into `settings_json` today — this is a rename, not a new
 * vocabulary.
 *
 * 🚨 NO INDEX SIGNATURE, DELIBERATELY. An open record would let a param be
 * written that nothing downstream restores, which is the shape of the live
 * reuse bug this whole plan starts from: persisted, never read, invisible.
 * Adding a param to the prompt bar means adding it HERE and to the desktop's
 * `applyShotParams`, in the same pass.
 */
export interface ShotParams {
  aspectRatio?: string
  /** Image models (Nano Banana 2 &co) — `1k` / `2k` / `4k`. */
  imageResolution?: string
  videoResolution?: string
  quality?: string
  /** gpt-image-2's tier. Always sent explicitly: fal's own default is `high`. */
  gptQuality?: 'medium' | 'high'
  duration?: number
  imageQuantity?: number
  gridMode?: 'off' | '2x2' | '3x3'
  negativePrompt?: string
  sound?: boolean
  audioLanguage?: string
  audioAccent?: string
  generateMusic?: boolean
  seedanceFace?: boolean
  multiShot?: boolean
  multiShotSegments?: Array<{ prompt: string; duration: number; camera: string; shotSize: string }> | null
  cameraControls?: {
    horizontal: number
    vertical: number
    pan: number
    tilt: number
    roll: number
    zoom: number
  }
  /** Audio lane. On seed-audio the requested duration IS the bill. */
  audioDurationSeconds?: number
  audioLoop?: boolean
  audioPromptInfluence?: number
  audioMultilingual?: boolean
}

/** Prompt-owned identity — the entities the prompt text NAMES. */
export interface ShotMentions {
  characterIds: string[]
  environmentIds: string[]
  styleIds: string[]
}

export interface ShotSpec {
  /** RAW prompt, `@mentions` intact. Never a composed one: the composer is the
   *  only thing that may number anything, and a stored "image 3" would be a
   *  lie the moment a reference is added, removed or reordered. */
  prompt: string
  model: string | null
  /**
   * The model the PROMPT WAS AUTHORED FOR. Never auto-rewritten.
   *
   * MiniMax H3 takes tagged `<Subject N>` references, `(S1)` speaker labels and
   * `<d>[lang]…</d>` dialogue; Seedance does not. A prompt authored for one and
   * replayed on another is not merely suboptimal — it can carry literal syntax
   * the new model reads as text. Rewriting it would be prompt enhancement, the
   * thing this codebase deleted on 2026-08-01. Record it, show it when it
   * diverges from `model`, and leave the user's words alone.
   */
  authoredFor: string | null
  params: ShotParams
  /** ENTITY ids, never flattened paths — update the character and every Shot
   *  that mentions it updates with it. */
  mentions: ShotMentions
  /** Attachment-owned refs as ASSET IDS, ordered within each role. Keyed by
   *  `OrderedAttachmentRole` so `ORDERED_ROLE_EMISSION` stays the ONE role
   *  list; a sixth role is a compile error here too. */
  refs: Record<OrderedAttachmentRole, string[]>
  firstFrameAssetId: string | null
  lastFrameAssetId: string | null
  /**
   * What is SAID in each reference-audio clip, keyed by its ASSET ID.
   *
   * 🚨 KEYED, NOT INDEX-ALIGNED. A parallel array desyncs on a single drag and
   * then tells the model one clip's words over another clip — silently. Its
   * worst failure keyed is a stale entry, which composes as nothing.
   */
  audioRefSpokenText: Record<string, string>

  // ── The script layer ─────────────────────────────────────────────
  //
  // 🚨 A ROW OWNS ITS TEXT. NOTHING POINTS INTO A SIBLING ROW'S CONTENT.
  // There is no script blob, no screenplay field, no offsets and no spans.
  // "The full script" is these rows rendered in order. The obvious
  // implementation — one text blob with cut points as character offsets — is
  // the one design that cannot be made safe: every edit shifts every
  // downstream offset and one bad edit orphans every shot after it. If a
  // proposed feature needs an offset, a span, or a range into another row,
  // it is that design in disguise; reject it.
  //
  // 🚨 THE SCRIPT IS AUTHORED. THE PROMPT IS DERIVED FROM IT (2026-08-31).
  // This block used to say the opposite — "a planning and counting surface …
  // none of them reaches a model" — and that was the mistake. It made the
  // script and the prompt TWO STORES OF THE SAME CONTENT with nothing joining
  // them: `paste script` filled `line`/`speaker`/`delivery`, `composeShot` read
  // only `prompt`, and eight beats of real script rendered eight rows of "No
  // prompt yet". A duplicate encoding, which is the exact bug class
  // `frame_type` / `motion_prompt` was deleted for.
  //
  // The direction matters and only one of the two works. Prompt → script means
  // parsing prose back into speaker/action/framing, which needs a model, and
  // there is no model in this app (it is why paste-a-script is a dumb parser).
  // Script → prompt is a deterministic composition — the same thing the
  // composer already does for references. So `scriptPromptBody()` below is the
  // one derivation, and `prompt` stops being a parallel copy of the script:
  // it is the CRAFT DIRECTION a screenplay cannot hold (lens, grain, lighting,
  // the specific quality of a move), layered on top.
  //
  // Every one is nullable and nothing ever asks for one — a visuals-only piece
  // must look finished (no empty state, no "add a line", no completeness
  // meter).

  /** Who speaks: an entity id, a bare name, the literal `VO`, or null. A name
   *  matching no character is a working state, not an error — it renders as
   *  plain text and offers "make this a character". */
  speaker: string | null
  /** What is said, verbatim. No camera, no scene, no prompt bloat — this is
   *  the half a person reads aloud. */
  line: string | null
  /** The parenthetical: how it is said. `(flat, exhausted)` */
  delivery: string | null
  /** What happens in the shot, screenplay-style. ONE field: an action line
   *  already describes everyone in frame, and splitting out the non-speakers
   *  invents a distinction writers do not make. */
  action: string | null
  /** The one readable object carrying the beat. */
  prop: string | null
  /** Framing, FREE TEXT. Bucketed for counting by
   *  `@slatesvideo/shared/shot-grammar`; never constrained by it. */
  shotSize: string | null
  /** Camera move, FREE TEXT. Same rule as `shotSize`. */
  camera: string | null
  /**
   * This row's line runs on from the previous row's — one sentence, two cuts.
   *
   * ONE FLAG, NO OFFSETS. It says "these two rows are one sentence" without
   * either row pointing into the other's text. Set by a mid-sentence split,
   * editable by hand, and cleared on both sides when a move breaks the run.
   * `heinrich-ad-prompting.md` §0a is built on exactly this move, so script →
   * cut is many-to-many and must stay that way.
   */
  continues: boolean
}

/**
 * What each script field MEANS, in one sentence — the prose the op surface
 * shows an agent for that parameter.
 *
 * It lives beside the fields because `satisfies Record<ScriptField, string>` is
 * what makes a new field a compile error in the DESCRIPTIONS too. An op that
 * hand-typed these would ship a ninth field with no explanation, which is the
 * same failure as a column nothing renders.
 */
export const SCRIPT_FIELD_DESCRIPTION = {
  speaker:
    'Who says the line — a character id, a bare name (a character that does not exist yet is fine), or "VO". Null for a shot with no words.',
  line: 'What is SAID, verbatim. Never camera, scene or prompt language — this is the half a person reads aloud.',
  delivery: 'The parenthetical: how it is said. "(flat, exhausted)"',
  action: 'What happens in the shot, screenplay-style. One line covering everyone in frame.',
  prop: 'The one readable object carrying the beat.',
  shotSize:
    'Framing, in your own words — "wide", "long-lens CU, other head blurred". FREE TEXT: it is bucketed for the variety count and never rejected or rewritten.',
  camera:
    'Camera move, in your own words — "slow push in", "through the rearview, eyes only". FREE TEXT, same rule as shotSize.',
  continues:
    'True when this row\'s line runs on from the previous row\'s — one sentence split across two cuts. The signature VO move; set it deliberately.',
} as const satisfies Record<ScriptField, string>

/** The script fields, as a list. Sorted from the description map so the two
 *  cannot disagree — never a second hand-written array. */
export type ScriptField =
  | 'speaker'
  | 'line'
  | 'delivery'
  | 'action'
  | 'prop'
  | 'shotSize'
  | 'camera'
  | 'continues'

/** The seven free-text script fields (everything but the `continues` flag) —
 *  the set an op accepts as `string | null` and a layer renders as text. */
export const SCRIPT_TEXT_FIELDS = [
  'speaker',
  'line',
  'delivery',
  'action',
  'prop',
  'shotSize',
  'camera',
] as const satisfies ReadonlyArray<Exclude<ScriptField, 'continues'>>

export type ScriptTextField = (typeof SCRIPT_TEXT_FIELDS)[number]

/**
 * The script, composed into prompt prose. **The one derivation, mirrored in
 * both repos**, so the desktop, `slates_get_shot` and the generation handler
 * cannot disagree about what a scripted Shot sends.
 *
 * 🚨 IT IS A TEMPLATE, NOT A WRITER. Deterministic, inspectable, no model. It
 * orders the fields the way a shot is actually described — what the camera is
 * doing, what happens, then who says what — and does nothing else. It never
 * invents adjectives, never "enhances", and never reorders a sentence the user
 * wrote. That is the prompt-transparency invariant: Slates may compose, and
 * every composed character has to be visible in the composer before Generate.
 *
 * 🚨 AND IT ONLY FIRES WHEN `prompt` IS EMPTY. A Shot that carries an authored
 * prompt keeps it byte-for-byte — which is what makes this safe to ship to live
 * users with no migration. `prompt` wins because it is the more specific
 * statement of intent; the script still counts, still fits, still reads.
 *
 * Dialogue is quoted so a model receives it as speech rather than as
 * description — the one piece of grammar this adds, and the reason it is not
 * just `join(' ')`.
 */
export function scriptPromptBody(spec: Pick<ShotSpec, ScriptTextField>): string {
  const clean = (v: string | null): string => (v ?? '').trim()
  const parts: string[] = []

  // Framing first: it is the camera instruction, and every model's own docs
  // put shot size and movement at the head of the prompt.
  const framing = [clean(spec.shotSize), clean(spec.camera)].filter(Boolean).join(', ')
  if (framing) parts.push(`${framing}.`)

  const action = clean(spec.action)
  if (action) parts.push(/[.!?]$/.test(action) ? action : `${action}.`)

  const prop = clean(spec.prop)
  if (prop) parts.push(`${prop} is visible in frame.`)

  const line = clean(spec.line)
  if (line) {
    const speaker = clean(spec.speaker)
    const delivery = clean(spec.delivery).replace(/^\(|\)$/g, '').trim()
    // "VO" is a screenplay abbreviation, not something to send to a model.
    const who = !speaker || speaker.toUpperCase() === 'VO' ? 'A voice' : speaker
    const how = delivery ? `, ${delivery},` : ''
    parts.push(`${who} says${how} "${line}"`)
  }

  return parts.join(' ')
}

/**
 * What this Shot actually sends: the authored prompt, or the script composed
 * into one. Every consumer calls THIS, never `spec.prompt` directly — a reader
 * that reached past it would be the surface that still says "No prompt yet"
 * while the row plainly has a script in it.
 */
export function effectivePrompt(spec: ShotSpec): string {
  const authored = spec.prompt.trim()
  return authored || scriptPromptBody(spec)
}

/** An empty Shot: a prompt bar nobody has touched. Every reader starts here and
 *  overlays what it actually found, so a missing field is never `undefined`
 *  leaking into a request. */
export function emptyShotSpec(): ShotSpec {
  const refs = {} as Record<OrderedAttachmentRole, string[]>
  for (const role of ORDERED_ATTACHMENT_ROLES) refs[role] = []
  return {
    prompt: '',
    model: null,
    authoredFor: null,
    params: {},
    mentions: { characterIds: [], environmentIds: [], styleIds: [] },
    refs,
    firstFrameAssetId: null,
    lastFrameAssetId: null,
    audioRefSpokenText: {},
    speaker: null,
    line: null,
    delivery: null,
    action: null,
    prop: null,
    shotSize: null,
    camera: null,
    continues: false,
  }
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : []

function readParams(v: unknown): ShotParams {
  if (!v || typeof v !== 'object') return {}
  const raw = v as Record<string, unknown>
  const out: ShotParams = {}
  const s = (k: 'aspectRatio' | 'imageResolution' | 'videoResolution' | 'quality' | 'audioLanguage' | 'audioAccent' | 'negativePrompt'): void => {
    if (typeof raw[k] === 'string') out[k] = raw[k] as string
  }
  const n = (k: 'duration' | 'imageQuantity' | 'audioDurationSeconds' | 'audioPromptInfluence'): void => {
    if (typeof raw[k] === 'number' && Number.isFinite(raw[k])) out[k] = raw[k] as number
  }
  const b = (k: 'sound' | 'generateMusic' | 'seedanceFace' | 'multiShot' | 'audioLoop' | 'audioMultilingual'): void => {
    if (typeof raw[k] === 'boolean') out[k] = raw[k] as boolean
  }
  s('aspectRatio'); s('imageResolution'); s('videoResolution'); s('quality')
  s('audioLanguage'); s('audioAccent'); s('negativePrompt')
  n('duration'); n('imageQuantity'); n('audioDurationSeconds'); n('audioPromptInfluence')
  b('sound'); b('generateMusic'); b('seedanceFace'); b('multiShot'); b('audioLoop'); b('audioMultilingual')
  if (raw.gptQuality === 'medium' || raw.gptQuality === 'high') out.gptQuality = raw.gptQuality
  if (raw.gridMode === 'off' || raw.gridMode === '2x2' || raw.gridMode === '3x3') out.gridMode = raw.gridMode
  if (Array.isArray(raw.multiShotSegments)) {
    out.multiShotSegments = raw.multiShotSegments as ShotParams['multiShotSegments']
  }
  const cc = raw.cameraControls as Record<string, unknown> | undefined
  if (cc && typeof cc === 'object') {
    const keys = ['horizontal', 'vertical', 'pan', 'tilt', 'roll', 'zoom'] as const
    if (keys.every((k) => typeof cc[k] === 'number')) {
      out.cameraControls = {
        horizontal: cc.horizontal as number, vertical: cc.vertical as number,
        pan: cc.pan as number, tilt: cc.tilt as number,
        roll: cc.roll as number, zoom: cc.zoom as number,
      }
    }
  }
  return out
}

/**
 * Read a `ShotSpec` out of whatever is on disk — a row written by an older
 * build, a partial object from an op, `null`.
 *
 * TOLERANT ON PURPOSE (invariant 7: a Shot that cannot currently fire still
 * loads). A missing role, an unknown key, a string where an array belongs —
 * none of them may throw, because the one thing worse than a degraded Shot is a
 * Shots list that will not open.
 */
export function normalizeShotSpec(raw: unknown): ShotSpec {
  const base = emptyShotSpec()
  if (!raw || typeof raw !== 'object') return base
  const v = raw as Record<string, unknown>
  const mentions = (v.mentions ?? {}) as Record<string, unknown>
  const refs = (v.refs ?? {}) as Record<string, unknown>
  const spoken: Record<string, string> = {}
  if (v.audioRefSpokenText && typeof v.audioRefSpokenText === 'object') {
    for (const [k, text] of Object.entries(v.audioRefSpokenText as Record<string, unknown>)) {
      // Trimmed on the way in, exactly as the composer trims it on the way out,
      // so a value that round-trips through a save cannot come back different.
      if (typeof text === 'string' && text.trim()) spoken[k] = text.trim()
    }
  }
  const out: ShotSpec = {
    prompt: typeof v.prompt === 'string' ? v.prompt : '',
    model: str(v.model),
    authoredFor: str(v.authoredFor),
    params: readParams(v.params),
    mentions: {
      characterIds: strArray(mentions.characterIds),
      environmentIds: strArray(mentions.environmentIds),
      styleIds: strArray(mentions.styleIds),
    },
    refs: base.refs,
    firstFrameAssetId: str(v.firstFrameAssetId),
    lastFrameAssetId: str(v.lastFrameAssetId),
    audioRefSpokenText: spoken,
    // The script layer reads through the same tolerant `str()` as everything
    // else: a row written before these existed comes back with nulls, which is
    // exactly right — it had no line and never claimed one.
    speaker: str(v.speaker),
    line: str(v.line),
    delivery: str(v.delivery),
    action: str(v.action),
    prop: str(v.prop),
    shotSize: str(v.shotSize),
    camera: str(v.camera),
    continues: v.continues === true,
  }
  for (const role of ORDERED_ATTACHMENT_ROLES) out.refs[role] = strArray(refs[role])
  return out
}

/** Every asset id a Shot references, deduped, in emission order then frames.
 *
 *  🚨 THIS IS THE INPUT TO THE FK MIRROR. `refs_json` is a JSON blob and is
 *  therefore INVISIBLE to the desktop's runtime FK classifier
 *  (`storage/assetReferences.ts` walks `PRAGMA foreign_key_list`), so a Shot's
 *  references would not block a cross-project move and the asset's file would
 *  be relocated out from under it. `shot_assets` is the visible mirror, and
 *  this function is the ONE place its row set is derived. */
export function shotAssetIds(spec: ShotSpec): string[] {
  const ids: string[] = []
  for (const role of ORDERED_ATTACHMENT_ROLES) ids.push(...spec.refs[role])
  if (spec.firstFrameAssetId) ids.push(spec.firstFrameAssetId)
  if (spec.lastFrameAssetId) ids.push(spec.lastFrameAssetId)
  return [...new Set(ids.filter(Boolean))]
}

/** Total attachment count — what a list row shows without composing anything. */
export function shotRefCount(spec: ShotSpec): number {
  return shotAssetIds(spec).length
}

/**
 * What each role MEANS, in one sentence — the prose the op surface shows an
 * agent for that parameter.
 *
 * It lives here, beside the union, because `satisfies Record<AttachmentRole,
 * string>` is what makes a new role a compile error in the DESCRIPTIONS too. An
 * op that hand-typed these would silently ship a seventh role with no
 * explanation, which is the same failure as a bucket nobody wired up.
 */
export const ATTACHMENT_ROLE_DESCRIPTION = {
  reference:
    'Plain reference images, in send order — cited in the prompt as "image 1", "image 2"…',
  subject:
    'Reference images that ARE the subject — composed as "Image N is the subject", so the model knows who the shot is about.',
  style:
    'Reference images the look is taken from — composed as one trailing "Render in the visual style of image N" clause.',
  'video-reference':
    'Reference CLIPS read alongside the images — cited as "video 1", "video 2"…',
  'audio-reference':
    'Reference AUDIO clips — cited as "audio 1", "audio 2"…. Pair each with audioRefSpokenText when it contains speech.',
  'first-frame': 'The starting frame for image-to-video.',
  'last-frame': 'The ending frame for image-to-video.',
} as const satisfies Record<AttachmentRole, string>
