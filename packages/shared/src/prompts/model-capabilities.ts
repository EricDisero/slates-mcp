// ─────────────────────────────────────────────────────────────────────────────
// MODEL_CAPABILITIES — the SSOT for what a model will ACCEPT.
//
// Aspect ratios (including per-provider overrides), video resolutions, duration
// ranges and reference caps. One definition, imported by everything: the
// desktop's `MODEL_REGISTRY` (slate/src/shared/pricing.ts) spreads these fields
// into every entry, `MODEL_FACTS` derives its reference caps from them, and the
// MCP/CLI op surface both VALIDATES against them and GENERATES its `.describe()`
// prose from them.
//
// 🚨 WHY THIS FILE EXISTS. Until 2026-08-16 the op surface in
// `operations/index.ts` re-stated all of these constraints by hand, as flat Zod
// enums plus English prose, with no link of any kind back to the registry. It
// had drifted on every axis: an aspect-ratio enum offering `9:21` (a value that
// exists in NO model, invented here), "Kling/Seedance support all" when Seedance
// takes 6 of 11 and Kling-on-fal takes 3, "Veo locks to 16:9" when Veo on fal
// takes two, "Kling: 5-15" against a registry minimum of 3, and a
// `videoResolution` description that never mentioned Kling at all. A customer
// burned a round trip on 2026-08-16 passing `4:5` to Seedance: the op accepted
// it, the job queued, credits reserved, and the provider rejected it
// ASYNCHRONOUSLY. Client-side accept of a server-side reject is the worst shape
// a constraint bug can take.
//
// The fix is NOT a fourth mirror plus a fifth lockstep checker — a checker only
// proves two hand-written copies agree, it does not remove the second copy, and
// the second copy is the defect. So the values live HERE, once, and everything
// downstream imports them.
//
// 🚨 NEVER HAND-TYPE A CAPABILITY FACT AN LLM WILL READ. Op descriptions,
// clarification messages and skill prose all derive from the `describe*`
// helpers below. If you find yourself typing "4-15s" or "16:9/9:16" into a
// string, you are re-creating the bug this file deleted.
//
// Direction of dependency matches the settled precedent for MODEL_FACTS: this
// package owns the doctrine, slate DERIVES from the published package at
// runtime (`slate/src/main/studio-agent/context.ts` already imports
// `@slatesvideo/shared`). Rates, credit costs and cost-key builders deliberately
// did NOT move — billing stays in slate with its existing checkers.
//
// ⚠️ LEAF MODULE — no imports, no Node built-ins. The desktop RENDERER reaches
// this through `@slatesvideo/shared/prompts`, so anything pulled in here has to
// bundle for the browser.
//
// Verification that a change here is a pure relocation: the slates-api checkers
// read `MODEL_REGISTRY` and assert it against `CREDIT_COSTS` —
// `composition-matrix-check.mjs` (12,608 combinations),
// `reference-caps-lockstep-check.mjs`, `pricing-consistency-check.mjs`. If a
// value moved, they go red.
// ─────────────────────────────────────────────────────────────────────────────

/** Every aspect ratio any Slates model accepts. There is no `9:21`. */
export type AspectRatio =
  | '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9'

/**
 * 🚨 `768p` and `2k` entered this vocabulary with MiniMax H3 (2026-08-27) and
 * are NOT aliases of anything already here. 768p is H3's native generation tier
 * and prices between 480p and 2K ($0.060/s vs 720p Seedance's $0.15/s — a
 * different tier of a different model, not a rename); 2K is H3's upscaled tier.
 * Aliasing either onto 720p/1080p would build a cost key that does not exist.
 *
 * 🚨 `1440p` entered with LTX-2.5 (2026-08-29) and is likewise NOT an alias —
 * specifically it is NOT `2k`, despite both being ~1440 lines tall. `2k` is
 * H3's UPSCALED tier ($0.130/s, an H3-Regenerate-2K pass over a 768p base);
 * `1440p` is LTX's NATIVELY GENERATED tier ($0.190/s). Different models,
 * different mechanisms, different prices, and `ltx-2-5-2k-6s` is a key that
 * exists nowhere. Co-height is not sameness.
 *
 * ⚠️ Our `4k` is LTX's `2160p` ON THE WIRE. fal's enum literal for that tier is
 * `2160p` while its own pricing copy calls it "4K". `4k` stays the token here
 * because it is what every cost key, `is4kVideoKey` and the Pro gate already
 * speak; the handler translates at the request boundary.
 */
export type VideoResolution = '480p' | '720p' | '768p' | '1080p' | '1440p' | '2k' | '4k'

/**
 * The full ten, in display order. `9:21` was in the MCP op's enum and in NO
 * model — it was invented downstream. Do not add a ratio here that no model
 * declares; the op's enum is generated from the union of what models accept, so
 * a phantom entry here becomes a phantom entry an agent can pass.
 */
export const ALL_ASPECT_RATIOS: AspectRatio[] = [
  '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9',
]

// ── Shared ratio sets ────────────────────────────────────────────────────────
// Named rather than inlined because several models share a set and a set is the
// thing that changes (a provider adds a ratio, every model on it gains it).

/** Google / non-restricted models: all ten. */
const FULL_ASPECT_RATIOS: AspectRatio[] = ALL_ASPECT_RATIOS

/** Kling's DIRECT API: eight — no `5:4`, no `4:5`. */
const KLING_DIRECT_ASPECT_RATIOS: AspectRatio[] = [
  '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9',
]

/** Kling carried on fal: three. This is the set the CREDITS route uses. */
const KLING_FAL_ASPECT_RATIOS: AspectRatio[] = ['16:9', '9:16', '1:1']

/** Veo carried on fal: two. The credits route again — Veo direct takes all ten. */
const VEO_FAL_ASPECT_RATIOS: AspectRatio[] = ['16:9', '9:16']

/** Gemini Omni Flash (fal schema, 16:9 default): two. */
const OMNI_FLASH_ASPECT_RATIOS: AspectRatio[] = ['16:9', '9:16']

/** Seedance (both seats, and the edit row): six — notably NO `4:5`. */
const SEEDANCE_ASPECT_RATIOS: AspectRatio[] = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16']

/**
 * MiniMax H3, both seats: six. Read off fal's live OpenAPI 2026-08-27 for
 * `minimax/h3/text-to-video` and `minimax/h3-max/text-to-video` — identical
 * enums. It happens to be the same six Seedance takes; kept as its OWN constant
 * because a provider that adds a ratio adds it to ITS family, and sharing the
 * Seedance constant would silently move H3 the next time ByteDance moves.
 *
 * Two endpoint quirks the registry deliberately does not model:
 *   · `image-to-video` has NO `aspect_ratio` param at all — the output follows
 *     the start frame. The handler simply omits it there.
 *   · `reference-to-video` adds an `adaptive` value on top of these six. We
 *     never send it: the composer always has an explicit ratio, and `adaptive`
 *     is not an AspectRatio in this vocabulary.
 */
const MINIMAX_H3_ASPECT_RATIOS: AspectRatio[] = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16']

/**
 * LTX-2.5, all four integrated endpoints: TWO. Read off fal's live OpenAPI
 * 2026-08-29 — `text-to-video/{fast,pro}` declare exactly `['16:9','9:16']`,
 * the narrowest video set in the roster alongside Veo-on-fal.
 *
 * `image-to-video/{fast,pro}` additionally offer `auto` (follow the start
 * frame). We never send it and it is not an `AspectRatio` in this vocabulary —
 * identical treatment to H3's `adaptive`, and for the identical reason: the
 * composer always holds an explicit ratio, so `auto` would only ever be a way
 * to lose track of what was actually generated.
 */
const LTX_2_5_ASPECT_RATIOS: AspectRatio[] = ['16:9', '9:16']

// ── Shapes ───────────────────────────────────────────────────────────────────

/** Duration constraints for a video model. */
export interface DurationCapability {
  min: number
  max: number
  /** 'continuous' = every whole second from min to max; 'discrete' = `values` only. */
  mode: 'continuous' | 'discrete'
  /** For discrete mode: the exact allowed durations. */
  values?: number[]
  /** Resolution-dependent narrowing (Veo forces 8s at 1080p AND 4k). */
  resolutionOverrides?: Record<string, Pick<DurationCapability, 'min' | 'max' | 'mode' | 'values'>>
  /** Prompt-mode narrowing (Veo's reference-to-video endpoint is 8s only). */
  modeOverrides?: Record<string, Pick<DurationCapability, 'min' | 'max' | 'mode' | 'values'>>
}

/** Video resolution constraints. */
export interface VideoResolutionCapability {
  options: VideoResolution[]
  /** Set when the resolution is not selectable at all (Omni Flash is 720p, full stop). */
  fixed?: VideoResolution
  /** Default when this model is chosen (falls back to `options[0]`). */
  default?: VideoResolution
}

/** Everything a model will ACCEPT. Capability only — never a price. */
/**
 * What a TEXT-TO-SPEECH surface accepts. Every number here was MEASURED against
 * the live API on 2026-09-05, not read from documentation — the vendor's docs
 * omit the rate limit entirely and its API accepts an unknown `audioEncoding`
 * with a 200 rather than a 400, so anything taken on trust here is a guess that
 * bills.
 *
 * 🚨 `clonesPerMinute` IS A PRODUCT CONSTRAINT, NOT A TUNING KNOB. The vendor
 * rate-limits voice cloning WORKSPACE-WIDE (every Slates user shares our one
 * key), so it caps how many people can mint a voice in the same minute across
 * the whole product. It is surfaced here so the seat can say so in words rather
 * than failing opaquely.
 */
export interface VoiceCloneCapability {
  /** Reference-audio duration the clone endpoint accepts, in seconds. */
  minSeconds: number
  maxSeconds: number
  /** Ceiling on ONE reference sample, in bytes. */
  maxBytes: number
  /** Container formats the clone endpoint decodes. */
  formats: readonly string[]
  /** Clone requests per minute, WORKSPACE-WIDE (measured: a 429 names the limit). */
  clonesPerMinute: number
  /**
   * Stored custom voices the plan allows. The seat holds the steady-state count
   * near ZERO by deleting each voice after it renders (mint → synthesize →
   * delete), so this is the wall that argument exists to never reach.
   */
  maxStoredVoices: number
  /** Bounds on the voice-DESIGN prompt, the path that needs no reference audio. */
  designPromptChars: { min: number; max: number }
}

export interface ModelCapability {
  aspectRatios: AspectRatio[]
  /** Provider-keyed overrides. `fal` is the one that matters — see AGENT_ROUTE_PROVIDER. */
  providerAspectRatios?: Record<string, AspectRatio[]>
  videoResolution?: VideoResolutionCapability
  duration?: DurationCapability

  // ── Reference caps ──
  /** Max reference images in create-image mode (image models). */
  maxRefImages?: number
  /** Max ingredient / free reference images (video models). */
  maxIngredientImages?: number
  /** Reference VIDEOS accepted. Absent/0 = none. */
  maxReferenceVideos?: number
  /** Reference AUDIO clips accepted. Absent/0 = none. */
  maxReferenceAudio?: number
  /** Ceiling on TOTAL reference files across ALL modalities. */
  maxReferenceFilesTotal?: number
  /** Combined seconds across every reference video. */
  maxReferenceVideoSeconds?: number
  /** Combined seconds across every reference audio clip. */
  maxReferenceAudioSeconds?: number

  // ── Text-to-speech ──
  /**
   * Max characters in ONE synthesis request. Present ⟺ the surface is TTS.
   * This is the number the character BILLING BUCKET is sized against, so it
   * must never be hand-typed downstream — `slate`'s registry spreads it in.
   */
  maxCharacters?: number
  /** Reference-audio and voice-design spec. Present ⟺ the surface can clone. */
  voiceClone?: VoiceCloneCapability
}

/**
 * The provider every AGENT generation actually lands on for Kling and Veo.
 *
 * 🚨 THIS IS WHY `providerAspectRatios` MATTERS TO THE OP. MCP/CLI/Studio-Agent
 * generations are credits-only (BYOK is retired on the agent surface), and the
 * credits route carries Kling and Veo on fal: `slate/src/main/agent/routes.ts`
 * never sends `klingProvider`, so `handlers/video.ts` defaults it to `'fal'`,
 * and `generateVeoVideo`'s proxy arm builds a fal request
 * (`buildFalVeoRequest`). So an agent gets Kling's THREE fal ratios and Veo's
 * TWO — not the eight and ten those models take on their direct APIs. Validating
 * against the direct sets would accept a ratio fal rejects, which is the exact
 * failure this module exists to delete.
 */
export const AGENT_ROUTE_PROVIDER = 'fal'

// ── The data ─────────────────────────────────────────────────────────────────
//
// Moved VERBATIM from `MODEL_REGISTRY` in slate/src/shared/pricing.ts on
// 2026-08-16. A relocation, not a re-derivation — the three slates-api checkers
// prove it (see the header).

export const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  // ── Image models ───────────────────────────────────────────────────────────

  'nano-banana-2': {
    aspectRatios: FULL_ASPECT_RATIOS,
    maxRefImages: 14,
  },

  'nano-banana-2-lite': {
    aspectRatios: FULL_ASPECT_RATIOS,
    maxRefImages: 4, // fal edit endpoint caps input images at 4
  },

  'nano-banana-pro': {
    aspectRatios: FULL_ASPECT_RATIOS,
    maxRefImages: 14,
  },

  // `gpt-image-2` WAS HERE AND IS DELIBERATELY GONE (retired 2026-09-09).
  //
  // An earlier pass kept the row so that a Shot saved before the swap could
  // still resolve its caps by stored id. That was the wrong fix and the
  // desktop refuses it: `pricing.ts` throws at MODULE LOAD for any capability
  // row with no MODEL_REGISTRY entry, because an orphan row makes THIS op
  // advertise, validate and quote a model the desktop can no longer render —
  // the agent passes every gate and then hits 'Unsupported model' at the
  // handler.
  //
  // Old Shots are handled where they are READ instead: `migrateGptImageModel`
  // in slate/src/shared/pricing.ts rewrites the stored id to Flare inside
  // `transform` (slate/src/main/storage/shots.ts), the one place a DB row
  // becomes a Shot. That is strictly better than keeping the row — the Shot
  // comes back FIREABLE on a live model, rather than merely openable on a dead
  // one. Do not re-add this row to make a stale id resolve; migrate it.

  // GPT Image 2.5 — 16 references, which IS fal's documented ceiling rather
  // than a number of ours: `image_urls` carries `maxItems: 16` on both 2.5
  // endpoints AND on both gpt-image-2 endpoints (schema, read 2026-09-09,
  // ripped verbatim to second-brain/business/projects/slates/research/
  // fal-gpt-image-2-5-openapi-schemas.md).
  //
  // 🚨 IT WAS 10 UNTIL 2026-09-09, AND 10 WAS NEVER ANYBODY'S LIMIT. The
  // comment here used to call it "the 10-reference ceiling ... unchanged by the
  // version bump", which reads as a verified fal constraint and was not one —
  // nobody had checked. Six reference slots were being given away, worst on
  // Sunburst, whose entire reason for shipping is multi-reference edit work.
  // Raised by Eric 2026-09-09 ("did we go completely full-on with all of the
  // options on fal?").
  //
  // The five aspect ratios ARE a product choice; fal takes any custom size
  // inside its own bounds (see GPT_IMAGE_25_SIZES in slate/src/shared/
  // pricing.ts). Two SLATES caps sit outside this file and are not model
  // limits either: the MCP's 4,000-character prompt against fal's 32,000, and
  // image quantity, which is a fan-out and has no provider ceiling at all.
  'gpt-image-2-5-flare': {
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    maxRefImages: 16,
  },

  'gpt-image-2-5-sunburst': {
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    maxRefImages: 16,
  },

  'flux-2-max': {
    aspectRatios: FULL_ASPECT_RATIOS,
    maxRefImages: 4,
  },

  'seedream-5-lite': {
    aspectRatios: FULL_ASPECT_RATIOS,
    maxRefImages: 10,
  },

  // ── Kling video ────────────────────────────────────────────────────────────

  'kling-v3.0-std': {
    aspectRatios: KLING_DIRECT_ASPECT_RATIOS,
    providerAspectRatios: { fal: KLING_FAL_ASPECT_RATIOS },
    videoResolution: { options: ['1080p', '4k'] },
    // 3, not 5. The op claimed "Kling: 5-15" and refused legal 3-4s takes.
    duration: { min: 3, max: 15, mode: 'continuous' },
    maxIngredientImages: 4,
  },

  'kling-v3.0-pro': {
    aspectRatios: KLING_DIRECT_ASPECT_RATIOS,
    providerAspectRatios: { fal: KLING_FAL_ASPECT_RATIOS },
    videoResolution: { options: ['1080p', '4k'] },
    duration: { min: 3, max: 15, mode: 'continuous' },
    maxIngredientImages: 4,
  },

  'kling-v3.0-omni': {
    aspectRatios: KLING_DIRECT_ASPECT_RATIOS,
    providerAspectRatios: { fal: KLING_FAL_ASPECT_RATIOS },
    videoResolution: { options: ['1080p', '4k'] },
    duration: { min: 3, max: 15, mode: 'continuous' },
    maxIngredientImages: 4,
  },

  'kling-v3.0-omni-pro': {
    aspectRatios: KLING_DIRECT_ASPECT_RATIOS,
    providerAspectRatios: { fal: KLING_FAL_ASPECT_RATIOS },
    videoResolution: { options: ['1080p', '4k'] },
    duration: { min: 3, max: 15, mode: 'continuous' },
    maxIngredientImages: 4,
  },

  // Kling O3 video-to-video edit (fal-only; the source clip is the canvas, so
  // aspect/resolution/duration all follow it).
  'kling-v3.0-omni-edit': {
    aspectRatios: KLING_FAL_ASPECT_RATIOS,
    videoResolution: { options: ['1080p'], fixed: '1080p' },
    duration: { min: 3, max: 15, mode: 'continuous' },
    maxIngredientImages: 4, // elements + style refs combined (fal cap)
  },

  'kling-v3.0-omni-pro-edit': {
    aspectRatios: KLING_FAL_ASPECT_RATIOS,
    videoResolution: { options: ['1080p'], fixed: '1080p' },
    duration: { min: 3, max: 15, mode: 'continuous' },
    maxIngredientImages: 4,
  },

  // ── Gemini Omni Flash ──────────────────────────────────────────────────────

  'omni-flash': {
    aspectRatios: OMNI_FLASH_ASPECT_RATIOS,
    videoResolution: { options: ['720p'], fixed: '720p' },
    duration: { min: 3, max: 10, mode: 'continuous' },
    maxIngredientImages: 7,
  },

  'omni-flash-edit': {
    aspectRatios: OMNI_FLASH_ASPECT_RATIOS,
    videoResolution: { options: ['720p'], fixed: '720p' },
    duration: { min: 3, max: 10, mode: 'continuous' },
    maxIngredientImages: 0,
  },

  // ── Veo ────────────────────────────────────────────────────────────────────

  'veo-3.1-fast': {
    aspectRatios: FULL_ASPECT_RATIOS,
    providerAspectRatios: { fal: VEO_FAL_ASPECT_RATIOS },
    videoResolution: { options: ['720p', '1080p', '4k'] },
    duration: {
      min: 4, max: 8, mode: 'discrete',
      values: [4, 6, 8],
      // BOTH 1080p and 4k force 8s. The op said "4K only at 8s" and quoted 4s
      // at 1080p, which the provider rejects.
      resolutionOverrides: {
        '1080p': { min: 8, max: 8, mode: 'discrete', values: [8] },
        '4k': { min: 8, max: 8, mode: 'discrete', values: [8] },
      },
      modeOverrides: {
        ingredients: { min: 8, max: 8, mode: 'discrete', values: [8] },
      },
    },
    maxIngredientImages: 3,
  },

  'veo-3.1-standard': {
    aspectRatios: FULL_ASPECT_RATIOS,
    providerAspectRatios: { fal: VEO_FAL_ASPECT_RATIOS },
    videoResolution: { options: ['720p', '1080p', '4k'] },
    duration: {
      min: 4, max: 8, mode: 'discrete',
      values: [4, 6, 8],
      resolutionOverrides: {
        '1080p': { min: 8, max: 8, mode: 'discrete', values: [8] },
        '4k': { min: 8, max: 8, mode: 'discrete', values: [8] },
      },
      modeOverrides: {
        ingredients: { min: 8, max: 8, mode: 'discrete', values: [8] },
      },
    },
    maxIngredientImages: 3,
  },

  // ── Seedance ───────────────────────────────────────────────────────────────

  'seedance-2': {
    aspectRatios: SEEDANCE_ASPECT_RATIOS,
    videoResolution: { options: ['480p', '720p', '1080p', '4k'], default: '1080p' },
    duration: { min: 4, max: 15, mode: 'continuous' },
    maxIngredientImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudio: 3,
    // 12, and it is the FAL ceiling — not a BytePlus one. SETTLED 2026-08-10
    // against both providers' primary sources; do not "correct" it to 15.
    //
    //   BytePlus ModelArk (first party, docs → Multimodal reference):
    //     "You can combine the following modal content as needed…
    //      Images: 0–9 images · Videos: 0–3 videos · Audio: 0–3 audios"
    //     Per-arm ranges, combined AS NEEDED. No total is stated anywhere, so
    //     on BytePlus the effective maximum really is 9+3+3 = 15.
    //   fal live OpenAPI (bytedance/seedance-2.0/reference-to-video):
    //     same per-arm maxItems 9/3/3, PLUS an explicit
    //     "Total files across all modalities must not exceed 12."
    //   EvoLink (the third route): publishes NO numeric reference limits at
    //     all — checked 2026-08-10. Genuinely unknown, not assumed to be 15.
    //
    // So the providers that DO state a total disagree, and 12 binds because
    // **a single generation can change providers after the user has approved
    // it**: the real-face consent cascade resubmits an EvoLink rejection to fal
    // mid-flight. A 15-file composition would be quoted, accepted, rejected by
    // ByteDance's real-person classifier, re-quoted through the consent
    // interstitial, and only THEN refused by fal for a reason the user was
    // never shown. 12 is the minimum of the two documented ceilings, with the
    // third unknown — so it is a floor on what is safe, not a proven optimum.
    //
    // The older "the modalities trade against each other" reading was a guess
    // at why fal states 12; it is not what BytePlus documents. The "15" in the
    // 2.5 plan's capability table was a SUM, not a figure anyone read.
    // (2.5 is unaffected: fal states 50 and 30+10+10 = 50, so both agree.)
    maxReferenceFilesTotal: 12,
    maxReferenceVideoSeconds: 15,
    maxReferenceAudioSeconds: 15,
  },

  'seedance-2.5': {
    aspectRatios: SEEDANCE_ASPECT_RATIOS,
    // 1080p landed 2026-08-24 on ALL THREE rails — BytePlus and EvoLink publish
    // 1080p rate rows and fal's live OpenAPI enum reads
    // ['480p','720p','1080p']. There is still NO 4K on 2.5 (2.0 is the only
    // Seedance with one), which is what keeps `is4kVideoKey` version-blind.
    //
    // DEFAULT STAYS 720p, deliberately: a 30s take at 1080p is ~614 credits
    // against a 1,000-credit welcome grant, and that is at the promotional
    // 1080p rate — it rises when the promo lapses. Reaching a tier and
    // defaulting to it are different decisions.
    videoResolution: { options: ['480p', '720p', '1080p'], default: '720p' },
    duration: { min: 4, max: 30, mode: 'continuous' },
    maxIngredientImages: 30,
    maxReferenceVideos: 10,
    maxReferenceAudio: 10,
    // fal states 50 and 30+10+10 = 50, so both documented ceilings agree here.
    maxReferenceFilesTotal: 50,
    maxReferenceVideoSeconds: 30,
    maxReferenceAudioSeconds: 30,
  },

  'seedance-2.5-edit': {
    aspectRatios: SEEDANCE_ASPECT_RATIOS,
    // Same ladder as the generation row (1080p added 2026-08-24). EvoLink's
    // rate card carries 1080p on the edit/extend row and BytePlus's video-input
    // column runs the full tier list; an edit bills that tier × 2.
    videoResolution: { options: ['480p', '720p', '1080p'], default: '720p' },
    duration: { min: 4, max: 30, mode: 'continuous' },
    // 🚨 ZERO, AND IT MUST MATCH WHAT THE HANDLER SENDS. The model's edit task
    // type does accept reference images, but slate's
    // `generation/handlers/edit-video.ts` sends the prompt and the source clip
    // and NOTHING ELSE on this row — no `image_urls` on the EvoLink call, no
    // `image_url` items in the BytePlus content array. This declared 30 while
    // the handler sent 0, so attaching references produced no error, no
    // warning, and no images in the request: a silent drop, which is the one
    // outcome `validateComposition` exists to prevent. Both sibling edit rows
    // already model this correctly (Omni Flash Edit is 0 and warns "takes the
    // prompt + source clip only"; Kling O3 Edit is 4 and actually sends them).
    //
    // Raising it is a HANDLER change first: wire the refs, then move the cap.
    maxIngredientImages: 0,
    // NO multimodal reference caps, deliberately: on an edit row the clip IS the
    // canvas and arrives through `sourceVideo`, not as a reference.
  },

  // ── MiniMax H3 (both seats on fal — added 2026-08-27) ──────────────────────
  //
  // Every value below is READ OFF fal's live OpenAPI, fetched 2026-08-27:
  //   minimax/h3/{text-to-video,image-to-video,reference-to-video}
  //   minimax/h3-max/{text-to-video,image-to-video,reference-to-video}
  // 🚨 CORRECTED 2026-09-09: `minimax/h3-max/reference-to-video` DOES exist —
  // 9 images, 3 videos, 3 audio. The earlier note here said it 404s; the schema
  // had never been read. Both rows now declare the full omni-reference set, and
  // every cap on the Max row was re-read on the Max endpoint rather than copied
  // down from the base row.
  //
  // 🚨 NEVER PREFIX-MATCH THESE TWO IDS. `minimax-h3-max` starts with
  // `minimax-h3`, so any `startsWith('minimax-h3')` swallows the Max row into
  // the base row's branch — a different ladder AND a different price at the one
  // tier they share. Every lookup downstream is an exact-id map, not a prefix.

  'minimax-h3': {
    aspectRatios: MINIMAX_H3_ASPECT_RATIOS,
    // The full ladder. 480p/768p are NATIVE generation modes; 2K and 4K upscale
    // a 768p base result through H3-Regenerate-2K, which is API-only and not in
    // the open weights — that is why fal can undercut list at the bottom two
    // tiers and matches it exactly at the top two.
    //
    // DEFAULT 768p, NOT fal's own default of 2K. 768p is the tier the model was
    // trained to output and the one every benchmark quotes; 2K is a 2.2x price
    // step and 4K a 2.7x step, and reaching a tier is a different decision from
    // defaulting to it (same reasoning that keeps Seedance 2.5 on 720p).
    videoResolution: { options: ['480p', '768p', '2k', '4k'], default: '768p' },
    // 5, not 4. MiniMax's own model card says 4-15s; fal's schema — which is
    // what our request actually hits — says `minimum: 5`. The endpoint wins.
    duration: { min: 5, max: 15, mode: 'continuous' },
    // Ref2VA omni-reference caps, verbatim from the reference-to-video schema:
    // reference_image_urls maxItems 9, reference_video_urls maxItems 3,
    // reference_audio_urls maxItems 3, and in every one of the three
    // descriptions: "Reference images, videos, and audio clips must add up to
    // at most 12 files."
    maxIngredientImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudio: 3,
    maxReferenceFilesTotal: 12,
    // COMBINED, not per clip. fal states "2-15 seconds each, combined duration
    // at most 15 seconds" for both media arms — so the per-clip floor of 2s is
    // the shared reference-video minimum already enforced by the composer, and
    // 15 is the sum these fields have always meant.
    maxReferenceVideoSeconds: 15,
    maxReferenceAudioSeconds: 15,
  },

  'minimax-h3-max': {
    aspectRatios: MINIMAX_H3_ASPECT_RATIOS,
    // 🚨 REFERENCES LANDED 2026-09-09, AFTER A FALSE CLAIM WAS RETIRED. This row
    // shipped from v1.5.5 declaring zero reference capacity because a comment
    // asserted `minimax/h3-max/reference-to-video` "returns 404". It does not.
    // Nobody had read the schema. The rip is at
    // second-brain/business/projects/slates/provider-docs/fal-minimax-h3-openapi-schemas.md
    //
    // Caps verbatim from that endpoint's schema: reference_image_urls maxItems
    // 9, reference_video_urls maxItems 3, reference_audio_urls maxItems 3, and
    // in all three descriptions: "Reference images, videos, and audio clips
    // must add up to at most 12 files."
    //
    // These MATCH the base row exactly — and they were re-read on this endpoint
    // rather than copied across, because "same as the row above" is the tell
    // this whole file exists to delete.
    maxIngredientImages: 9,
    maxReferenceVideos: 3,
    maxReferenceAudio: 3,
    maxReferenceFilesTotal: 12,
    // "2-15 seconds each, combined duration at most 15 seconds" on BOTH media
    // arms — quoted off this endpoint, not inherited.
    maxReferenceVideoSeconds: 15,
    maxReferenceAudioSeconds: 15,
    // 1080P IS REAL ON THIS ROW and was missing until 2026-09-09. The schema's
    // resolution enum is ["480P","768P","1080P"] on all three h3-max endpoints.
    // 2K/4K genuinely are absent: the H3-Regenerate-2K upscaler is API-only and
    // is not in the open weights fal self-hosts, which is the actual mechanism
    // behind the shorter ladder — 1080p was never part of that story.
    //
    // DEFAULT stays 768p: it is the tier the model natively generates, and
    // 1080p is a 2x price step ($0.160/s against $0.080/s).
    videoResolution: { options: ['480p', '768p', '1080p'], default: '768p' },
    duration: { min: 5, max: 15, mode: 'continuous' },
  },

  // ── LTX-2.5 (both seats on fal — added 2026-08-29) ─────────────────────────
  //
  // Every value below is READ OFF fal's live OpenAPI, fetched 2026-08-29:
  //   lightricks/ltx-2.5/{text-to-video,image-to-video}/{fast,pro}
  // Note the owner namespace — no `fal-ai/` prefix, exactly like `minimax/h3/`.
  //
  // 🚨 SAME PREFIX COLLISION AS THE MINIMAX PAIR, AND IT IS WORSE HERE.
  // `ltx-2-5-pro` starts with `ltx-2-5`, so ANY `startsWith('ltx-2-5')` swallows
  // the Pro row into the Fast row's branch — a shorter ladder, a shorter
  // duration list AND a 31-33% higher price at both tiers they share. Every
  // lookup downstream is an exact-id map, never a prefix test.
  //
  // 🚨 THE CHEAP ROW IS THE ONE WITH THE LONGER REACH. Counter to how every
  // other Fast/Pro pair in this file behaves, `ltx-2-5` (the distilled 8-step
  // build) reaches 1440p, 4K and 20s while `ltx-2-5-pro` (full diffusion) stops
  // at 1080p and 10s. Pro buys fidelity on a NARROWER ladder. Do not "fix" this
  // by assuming Pro is a superset — it is not, on either axis.
  //
  // ⛔ `audio-to-video/{fast,pro}` EXIST AND ARE DELIBERATELY ABSENT from this
  // file. They carry no `resolution` and no `duration` parameter at all: output
  // length is dictated by the uploaded audio, so they bill per second of INPUT
  // while every credit key we own bills OUTPUT. That is a billing-SHAPE change,
  // not a missing row. See slates-api/PRICING.md.

  'ltx-2-5': {
    aspectRatios: LTX_2_5_ASPECT_RATIOS,
    // Full ladder, all four tiers NATIVELY generated (no upscale pass anywhere
    // — the contrast with H3's 2K/4K is the whole reason `1440p` is its own
    // token). DEFAULT 1080p, which is also fal's own schema default: unusually
    // for this file the default tier is not the floor. It is the cheapest
    // native 1080p second in the roster at $0.130/s.
    videoResolution: { options: ['720p', '1080p', '1440p', '4k'], default: '1080p' },
    // 🚨 DISCRETE AND EVEN-ONLY. There is NO 5s LTX clip and no odd duration of
    // any length — fal's enum is literally [6,8,10,12,14,16,18,20]. A
    // `{ min: 6, max: 20, mode: 'continuous' }` here would offer 7s in the
    // composer, quote a `ltx-2-5-1080p-7s` key that exists on no server, and
    // fail at the proxy after the user had already chosen it.
    //
    // The evenness is also what makes all 28 cost keys round exactly (every
    // basis is a multiple of CENTS_PER_CREDIT=3) — see PRICING.md. If fal ever
    // admits odd seconds, the rounding proof must be re-verified.
    duration: {
      min: 6,
      max: 20,
      mode: 'discrete',
      values: [6, 8, 10, 12, 14, 16, 18, 20],
      // fal: "At 720p and 1080p, 24 or 25 FPS supports up to 20 seconds […] At
      // 1440p and 2160p, all frame rates support up to 10 seconds."
      //
      // ⚠️ THE REAL CEILING IS A FUNCTION OF RESOLUTION *AND* FPS, and this
      // field can only express the resolution half. It is correct ONLY because
      // we pin fps to fal's default of 25 and never expose the control. If fps
      // is ever exposed, 48/50 drops the 720p/1080p ceiling to 10s too, and
      // that needs a second override axis — not a wider window here.
      resolutionOverrides: {
        '1440p': { min: 6, max: 10, mode: 'discrete', values: [6, 8, 10] },
        '4k': { min: 6, max: 10, mode: 'discrete', values: [6, 8, 10] },
      },
    },
    // NO reference caps of any kind, deliberately. fal publishes text-to-video
    // and image-to-video for LTX and NOTHING else — there is no
    // `reference-to-video` endpoint, so there is no transport for an ingredient
    // or a multimodal reference, and a cap declared above what the handler
    // sends is a SILENT DROP (the failure `seedance-2.5-edit` shipped with).
    // The start/end frames i2v does carry are FRAME SLOTS, not references, and
    // live in MODEL_REGISTRY.features.lastFrame — not here.
  },

  'ltx-2-5-pro': {
    aspectRatios: LTX_2_5_ASPECT_RATIOS,
    // 720p/1080p ONLY. Declaring the shorter ladder here IS the whole Pro-seat
    // mechanism: `assertVideoCapabilities` refuses 1440p/4K on this id, the
    // desktop picker renders only what this entry declares, and the agent's Zod
    // enum stays the union while the per-model guard narrows. Anything shaped
    // like "hide the top tiers when Pro is selected" re-implements a guard that
    // already exists.
    videoResolution: { options: ['720p', '1080p'], default: '1080p' },
    // Three values, full stop — fal's enum is [6,8,10] on both Pro endpoints,
    // with no resolution override needed because the ceiling is already 10s at
    // both tiers this row reaches.
    duration: { min: 6, max: 10, mode: 'discrete', values: [6, 8, 10] },
    // No reference caps — same reasoning as the Fast row above.
  },

  // ── Audio ──────────────────────────────────────────────────────────────────
  //
  // `aspectRatios: []` is deliberate, not an oversight: audio has no frame, and
  // an empty list is what makes the desktop composer HIDE the ratio control
  // instead of offering a meaningless one. Duration for these two lives in
  // `MODEL_REGISTRY.audio.durationSeconds` alongside the billing bounds, which
  // are mirrored in three repos and locked by `pricing-consistency-check.mjs` §4
  // — moving them here would split one clamp across two files.

  'seed-audio': {
    aspectRatios: [],
    // ONE image XOR up to 3 audio clips; the XOR is enforced by
    // `validateComposition`, this is only the image arm.
    maxRefImages: 1,
  },

  'eleven-sfx': {
    aspectRatios: [],
  },

  // ── Text-to-speech ─────────────────────────────────────────────────────────
  //
  // The TTS seat. `maxCharacters` is the one number the billing bucket is sized
  // against, and it is MEASURED: the API rejects 2,001 characters by name
  // ("text length should not exceed 2000 characters"). Do not raise it from a
  // docs page — raise it from a request that succeeds.
  //
  // ⚠️ NO `durationSeconds` HERE, and that is the shape of the surface rather
  // than an omission: speech length falls out of the text, so this row bills on
  // characters and has no duration dimension at all. Every derivation that
  // switches on an audio surface must read the BILLING UNIT, never assume one.

  'inworld-tts-2': {
    aspectRatios: [],
    maxCharacters: 2000,
    voiceClone: {
      // 5-15s of reference audio, ≤4 MB per sample — the vendor's documented
      // spec, and a 12.6s / 555 KB sample cloned successfully against it.
      minSeconds: 5,
      maxSeconds: 15,
      maxBytes: 4 * 1024 * 1024,
      formats: ['wav', 'mp3', 'webm'],
      // 🚨 MEASURED, and it appears in no documentation: the third clone inside
      // one minute returned 429 "limit: 2, time window: m". This is workspace-
      // wide, so it is shared across every Slates user.
      clonesPerMinute: 2,
      maxStoredVoices: 100,
      // Measured: the design endpoint rejects a prompt outside these bounds by
      // name ("design_prompt (Voice Description) must be between 7 and 1000").
      designPromptChars: { min: 7, max: 1000 },
    },
  },
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function getModelCapability(model: string): ModelCapability | undefined {
  return MODEL_CAPABILITIES[model]
}

/**
 * The voice-cloning spec for a TTS surface, or undefined for anything else.
 *
 * Exists so the desktop reads the reference-audio bounds, the design-prompt
 * bounds and the clone rate limit from HERE rather than retyping them into a
 * form control. A control whose limit disagrees with the vendor's is a limit
 * the user first meets AFTER pressing the button.
 */
export function voiceCloneFor(model: string): VoiceCloneCapability | undefined {
  return MODEL_CAPABILITIES[model]?.voiceClone
}

/** Aspect ratios a model accepts, honouring the provider override. */
export function aspectRatiosFor(model: string, provider?: string): AspectRatio[] {
  const cap = MODEL_CAPABILITIES[model]
  if (!cap) return ALL_ASPECT_RATIOS
  if (provider && cap.providerAspectRatios?.[provider]) return cap.providerAspectRatios[provider]
  return cap.aspectRatios
}

/** Video resolutions a model accepts. A FIXED model reports exactly its one value. */
export function videoResolutionsFor(model: string): VideoResolution[] {
  const vr = MODEL_CAPABILITIES[model]?.videoResolution
  if (!vr) return []
  return vr.fixed ? [vr.fixed] : vr.options
}

/** The resolution a model would actually run at. Fixed wins; else keep a legal
 *  current value; else the model's own default. Mirrors `clampVideoResolution`. */
export function defaultVideoResolutionFor(model: string): VideoResolution | undefined {
  const vr = MODEL_CAPABILITIES[model]?.videoResolution
  if (!vr) return undefined
  return vr.fixed ?? vr.default ?? vr.options[0]
}

/**
 * Duration constraints after applying overrides.
 *
 * ⚠️ ORDER IS LOAD-BEARING and mirrors `getAvailableDurations` in
 * slate/src/shared/pricing.ts EXACTLY: mode override first (more specific),
 * resolution override only if no mode override applied. Reversing them would
 * make the desktop and the agent disagree about the same generation.
 */
export function durationsFor(
  model: string,
  opts: { videoResolution?: string; promptMode?: string } = {}
): DurationCapability | undefined {
  const base = MODEL_CAPABILITIES[model]?.duration
  if (!base) return undefined
  if (opts.promptMode && base.modeOverrides?.[opts.promptMode]) {
    return { ...base, ...base.modeOverrides[opts.promptMode] }
  }
  if (opts.videoResolution && base.resolutionOverrides?.[opts.videoResolution]) {
    return { ...base, ...base.resolutionOverrides[opts.videoResolution] }
  }
  return base
}

/** Every legal whole-second duration. Mirrors `getAvailableDurations`. */
export function durationValuesFor(
  model: string,
  opts: { videoResolution?: string; promptMode?: string } = {}
): number[] {
  const d = durationsFor(model, opts)
  if (!d) return []
  if (d.mode === 'discrete' && d.values) return d.values
  const out: number[] = []
  for (let i = d.min; i <= d.max; i++) out.push(i)
  return out
}

/** Union of every ratio the given models accept — the legal universe for an enum. */
export function aspectRatioUnion(models: readonly string[], provider?: string): AspectRatio[] {
  const seen = new Set<AspectRatio>()
  for (const m of models) for (const r of aspectRatiosFor(m, provider)) seen.add(r)
  // Emit in ALL_ASPECT_RATIOS order so the enum is stable regardless of input order.
  return ALL_ASPECT_RATIOS.filter((r) => seen.has(r))
}

/** Union of every resolution the given models accept. */
export function videoResolutionUnion(models: readonly string[]): VideoResolution[] {
  // Ascending by output height, so an enum reads as a ladder. 768p sits between
  // 720p and 1080p; 1440p and 2k (≈2560×1440) are CO-HEIGHT and sit together
  // between 1080p and 4k — their relative order here is cosmetic, because no
  // model declares both (1440p is LTX-only, 2k is H3-only).
  const order: VideoResolution[] = ['480p', '720p', '768p', '1080p', '1440p', '2k', '4k']
  const seen = new Set<VideoResolution>()
  for (const m of models) for (const r of videoResolutionsFor(m)) seen.add(r)
  return order.filter((r) => seen.has(r))
}

/** Widest legal duration window across the given models, overrides included. */
export function durationBounds(models: readonly string[]): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (const m of models) {
    for (const v of durationValuesFor(m)) {
      if (v < min) min = v
      if (v > max) max = v
    }
    // Overrides can only narrow, never widen — but read them anyway so a future
    // widening override cannot silently fall outside the enum's bounds.
    const base = MODEL_CAPABILITIES[m]?.duration
    for (const o of [
      ...Object.values(base?.resolutionOverrides ?? {}),
      ...Object.values(base?.modeOverrides ?? {}),
    ]) {
      if (o.min < min) min = o.min
      if (o.max > max) max = o.max
    }
  }
  return Number.isFinite(min) ? { min, max } : { min: 0, max: 0 }
}

// ── Validation ───────────────────────────────────────────────────────────────
//
// Each returns an ACTIONABLE message naming the legal set, or null when the
// value is fine. The message is generated, so it can never name a set the data
// does not contain.

export function checkAspectRatio(
  model: string,
  aspectRatio: string | undefined,
  provider?: string
): string | null {
  if (!aspectRatio) return null
  const legal = aspectRatiosFor(model, provider)
  if (legal.length === 0 || legal.includes(aspectRatio as AspectRatio)) return null
  return `${model} does not accept aspectRatio "${aspectRatio}". It accepts ${legal.join(', ')}. Pick one of those, or switch to a model that takes the shape you want.`
}

export function checkVideoResolution(model: string, videoResolution: string | undefined): string | null {
  if (!videoResolution) return null
  const legal = videoResolutionsFor(model)
  if (legal.length === 0) return null
  if (legal.includes(videoResolution as VideoResolution)) return null
  const vr = MODEL_CAPABILITIES[model]?.videoResolution
  if (vr?.fixed) {
    return `${model} renders at ${vr.fixed} only — it has no resolution parameter, so videoResolution "${videoResolution}" cannot apply. Drop the param.`
  }
  return `${model} does not render at ${videoResolution}. It offers ${legal.join(', ')}. Pick one of those, or switch models.`
}

export function checkDuration(
  model: string,
  duration: number | undefined,
  opts: { videoResolution?: string; promptMode?: string } = {}
): string | null {
  if (duration == null) return null
  const d = durationsFor(model, opts)
  if (!d) return null
  const legal = durationValuesFor(model, opts)
  if (legal.includes(duration)) return null
  // Name WHY the window narrowed, and how to widen it again — otherwise the
  // message reads as a contradiction of the model's own advertised range.
  const base = MODEL_CAPABILITIES[model]?.duration
  let why = ''
  let escape = ''
  if (opts.promptMode && base?.modeOverrides?.[opts.promptMode]) {
    why = ' with reference images attached'
    escape = `, or drop the reference images to get back to ${fmtWindow(base)}`
  } else if (opts.videoResolution && base?.resolutionOverrides?.[opts.videoResolution]) {
    why = ` at ${opts.videoResolution}`
    escape = `, or pick a resolution without that restriction (${fmtWindow(base)} at the unrestricted ones)`
  }
  const allowed = legal.length === 1 ? `${legal[0]}s only` : d.mode === 'discrete' ? `${legal.join('s, ')}s` : `${d.min}-${d.max}s`
  return `${model}${why} accepts ${allowed} — ${duration}s is not legal. Pick a duration in range${escape}.`
}

// ── Generated prose ──────────────────────────────────────────────────────────
//
// Every `.describe()` string the LLM reads about these three params is built
// here, so prose CANNOT contradict the data. Grouping models that share a value
// keeps the desktop's cached token prefix small.

function groupBy(models: readonly string[], fn: (m: string) => string): string {
  const groups: Array<{ value: string; models: string[] }> = []
  for (const m of models) {
    const value = fn(m)
    if (!value) continue
    const existing = groups.find((g) => g.value === value)
    if (existing) existing.models.push(m)
    else groups.push({ value, models: [m] })
  }
  return groups.map((g) => `${g.models.join('/')}: ${g.value}`).join(' · ')
}

/** e.g. "kling-v3.0-std/kling-v3.0-pro: 16:9, 9:16, 1:1 · seedance-2: 21:9, …" */
export function describeAspectRatios(models: readonly string[], provider?: string): string {
  return groupBy(models, (m) => aspectRatiosFor(m, provider).join(', '))
}

/** e.g. "seedance-2: 480p, 720p, 1080p, 4k (default 1080p) · omni-flash: 720p only (fixed)" */
export function describeVideoResolutions(models: readonly string[]): string {
  return groupBy(models, (m) => {
    const vr = MODEL_CAPABILITIES[m]?.videoResolution
    if (!vr) return ''
    if (vr.fixed) return `${vr.fixed} only (fixed — do not pass videoResolution)`
    const def = vr.default ?? vr.options[0]
    return `${vr.options.join(', ')} (default ${def})`
  })
}

function fmtWindow(d: Pick<DurationCapability, 'min' | 'max' | 'mode' | 'values'>): string {
  return d.mode === 'discrete' && d.values ? `${d.values.join('s/')}s` : `${d.min}-${d.max}s`
}

/** e.g. "kling-v3.0-std: 3-15s · veo-3.1-fast: 4s/6s/8s (1080p/4k: 8s only; with reference images: 8s only)" */
export function describeDurations(models: readonly string[]): string {
  return groupBy(models, (m) => {
    const d = MODEL_CAPABILITIES[m]?.duration
    if (!d) return ''
    const clauses: string[] = []
    const resGroups: Array<{ value: string; keys: string[] }> = []
    for (const [res, o] of Object.entries(d.resolutionOverrides ?? {})) {
      const value = fmtWindow(o)
      const hit = resGroups.find((g) => g.value === value)
      if (hit) hit.keys.push(res)
      else resGroups.push({ value, keys: [res] })
    }
    for (const g of resGroups) clauses.push(`${g.keys.join('/')}: ${g.value} only`)
    if (d.modeOverrides?.ingredients) {
      clauses.push(`with reference images: ${fmtWindow(d.modeOverrides.ingredients)} only`)
    }
    return `${fmtWindow(d)}${clauses.length ? ` (${clauses.join('; ')})` : ''}`
  })
}

/** e.g. "seedance-2: 9 · seedance-2.5: 30 · omni-flash: 7 · seedance-2.5-edit: 0 (prompt + source clip only)" */
export function describeReferenceImageCaps(models: readonly string[]): string {
  return groupBy(models, (m) => {
    const cap = MODEL_CAPABILITIES[m]
    if (!cap) return ''
    const n = cap.maxIngredientImages ?? cap.maxRefImages
    if (n == null) return ''
    return n === 0 ? '0 (prompt + source clip only)' : String(n)
  })
}
