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
 */
export type VideoResolution = '480p' | '720p' | '768p' | '1080p' | '2k' | '4k'

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

  'gpt-image-2': {
    // FIVE, not ten. The op's flat enum offered eleven for every image model.
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    maxRefImages: 10,
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
  //   minimax/h3-max/{text-to-video,image-to-video}
  // `minimax/h3-max/reference-to-video` returns 404 — it does not exist, which
  // is why the Max row declares no reference capacity at all.
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
    // 480p/768p ONLY — fal's post-train of the open weights, and the 2K
    // upscaler was never open-sourced. Declaring the shorter ladder here IS the
    // whole Max-seat mechanism: `assertVideoCapabilities` refuses 2K/4K on this
    // id, the desktop picker renders only what this entry declares, and the
    // agent's Zod enum stays the union while the per-model guard narrows.
    // Anything shaped like "disable the higher tiers when Max is selected" is
    // re-implementing a guard that already exists.
    videoResolution: { options: ['480p', '768p'], default: '768p' },
    duration: { min: 5, max: 15, mode: 'continuous' },
    // NO reference caps, deliberately: fal publishes text-to-video and
    // image-to-video for h3-max and NOTHING else (reference-to-video 404s), so
    // there is no transport for a reference of any modality. A cap declared
    // above what the handler sends is a SILENT DROP — the exact failure
    // `seedance-2.5-edit` shipped with. Absent means the composer refuses.
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
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function getModelCapability(model: string): ModelCapability | undefined {
  return MODEL_CAPABILITIES[model]
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
  // 720p and 1080p; 2k (≈2560×1440) between 1080p and 4k.
  const order: VideoResolution[] = ['480p', '720p', '768p', '1080p', '2k', '4k']
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
