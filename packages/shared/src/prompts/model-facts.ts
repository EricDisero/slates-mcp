// Per-model prompting facts — reference/ingredient limits and the prompt
// formula, as KNOWLEDGE (for skills + lead-magnet + desktop tooltips). The
// RUNTIME source of truth for limits is slate/src/shared/pricing.ts
// (MODEL_REGISTRY.maxRefImages / maxIngredientImages); these mirror it for
// documentation. Code-verified 2026-06-25.
//
// Prose that ALSO appears in a skill or the tips card comes from
// skills/_partials/*.md via PARTIALS — never restated here. A `notes` string is
// a third rendering of a fact, and a third rendering is a third thing that can
// survive a doctrine reversal the other two got.

import { PARTIALS } from './partials.generated.js'

export interface ModelFact {
  id: string
  label: string
  kind: 'image' | 'video' | 'audio'
  /** Max reference images (image models) — null if not applicable. */
  maxRefImages: number | null
  /** Max ingredient images (video models) — null if not applicable. */
  maxIngredients: number | null
  // ── Multimodal reference capacity (video models that read clips + audio) ──
  //
  // Mirrors `MODEL_REGISTRY.maxReference*` in slate/src/shared/pricing.ts, which
  // is the RUNTIME truth (and is itself locked against the server's constants by
  // slates-api/scripts/reference-caps-lockstep-check.mjs). These exist so op
  // descriptions and skills can DERIVE the numbers instead of hand-typing them —
  // the root CLAUDE.md rule: never hand-type a fact an LLM will read.
  /** Reference VIDEOS accepted in one generation. null/absent = none. */
  maxReferenceVideos?: number | null
  /** Reference AUDIO clips accepted in one generation. null/absent = none. */
  maxReferenceAudio?: number | null
  /** Combined seconds across every reference video. */
  maxReferenceVideoSeconds?: number | null
  /** Combined seconds across every reference audio clip. */
  maxReferenceAudioSeconds?: number | null
  /** Ceiling on TOTAL reference files across all modalities. */
  maxReferenceFilesTotal?: number | null
  /** An audio reference needs at least one image or video reference alongside. */
  audioRefNeedsCompanion?: boolean
  notes: string
}

/**
 * One sentence of multimodal-reference capacity for a model, derived. Returns
 * an empty string for a model that takes none, so a caller can append it
 * unconditionally.
 */
export function multimodalRefSummary(id: string): string {
  const f = MODEL_FACTS.find((m) => m.id === id)
  if (!f) return ''
  const v = f.maxReferenceVideos ?? 0
  const a = f.maxReferenceAudio ?? 0
  if (v === 0 && a === 0) return ''
  const parts: string[] = []
  if (v > 0) parts.push(`${v} reference video${v === 1 ? '' : 's'} (${f.maxReferenceVideoSeconds}s combined)`)
  if (a > 0) parts.push(`${a} reference audio clip${a === 1 ? '' : 's'} (${f.maxReferenceAudioSeconds}s combined)`)
  const total = f.maxReferenceFilesTotal ? `, ${f.maxReferenceFilesTotal} files max across all modalities` : ''
  const companion = f.audioRefNeedsCompanion
    ? ' Audio needs at least one image or video reference alongside it.'
    : ' Audio-only references are allowed.'
  return `${f.label}: up to ${parts.join(' and ')}${total}.${companion}`
}

/**
 * The prompt words that make Seedance 2.5 reclassify a reference-carrying
 * request as a video EDIT or EXTEND — after which it fails on task-type
 * constraints it never set, ASYNCHRONOUSLY, once the job has queued.
 *
 * 🚨 THIS DRIVES A WARNING THAT NAMES THE WORDS. It must never drive a rewrite:
 * silently mutating the user's prompt to dodge a provider classifier is banned
 * by the prompt-transparency invariant (slate/CLAUDE.md). "Remove the tripod" is
 * the user's sentence; the honest move is to say what will happen.
 *
 * ⚠️ MIRRORED, and the mirror is deliberate. The desktop's copy is
 * `SEEDANCE_EDIT_INTENT_KEYWORDS` + `SEEDANCE_EXTEND_INTENT_KEYWORDS` in
 * `slate/src/shared/pricing.ts`, which cannot import from this package (it is
 * loaded by the renderer through the `@shared/*` alias, with no npm dependency).
 * Same situation as `promptComposition.ts` ↔ `reference-composer.ts`. Change one,
 * change the other in the same pass. Both sides match on a WORD BOUNDARY, so
 * "added" and "readdress" are not hits.
 */
export const SEEDANCE_TASK_INTENT_WORDS = [
  // The edit half and the extension half of ByteDance's own trigger lists
  // (Seedance 2.5 prompt guide → "Trigger keywords in prompt"). 'insert',
  // 'delete' and 'modify' are named there and were missing here; 'change to',
  // 'extend forward/backward', 'continue from' and 'extend the story' are all
  // caught by the shorter word already in the list.
  'add', 'insert', 'remove', 'delete', 'modify', 'replace', 'change', 'edit the video',
  'extend', 'continue', 'continue the story',
] as const

/** Which trigger words a prompt actually contains, so a warning can name them.
 *  Mirrors `seedanceTaskIntentWords()` in slate/src/shared/pricing.ts. */
export function seedanceTaskIntentWords(prompt: string): string[] {
  return SEEDANCE_TASK_INTENT_WORDS.filter((w) =>
    new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(prompt)
  )
}

/** Every model that reads reference video and/or audio, for op descriptions. */
export function multimodalRefModels(): string[] {
  return MODEL_FACTS
    .filter((m) => (m.maxReferenceVideos ?? 0) > 0 || (m.maxReferenceAudio ?? 0) > 0)
    .map((m) => m.id)
}

export const MODEL_FACTS: ModelFact[] = [
  {
    id: 'nano-banana-2',
    // Gemini 3.1 FLASH Image — verified against the runtime slug map in
    // slate/src/main/api/google.ts. Nano Banana PRO is a different model
    // (gemini-3-pro-image-preview); do not conflate them.
    label: 'Nano Banana 2 (Gemini 3.1 Flash Image)',
    kind: 'image',
    maxRefImages: 14, // 10 object-fidelity + 4 character-consistency; categories don't trade.
    maxIngredients: null,
    notes:
      'Default image model. 14 refs hard cap (10 object + 4 character). Brief it like a creative director, not tag soup. No negativePrompt field — use positive reframing. Best image start-frame for legible text. Knowledge cutoff Jan 2025.',
  },
  {
    id: 'nano-banana-2-lite',
    label: 'Nano Banana 2 Lite',
    kind: 'image',
    maxRefImages: 4,
    maxIngredients: null,
    notes:
      'FAST/DRAFT image tier — ~half the price of NB2 full, ~2.7× faster, 1K output ONLY. Same Gemini content filter as NB2. Route here for iteration volume and drafts where 1K is fine; keep NB2 full for final 2K/4K. Character consistency + legible text hold up.',
  },
  {
    id: 'nano-banana-pro',
    label: 'Nano Banana Pro',
    kind: 'image',
    maxRefImages: 14,
    maxIngredients: null,
    notes:
      'HERO-FRAME / typography PREMIUM image tier (Gemini 3 Pro backbone; ~2× NB2 price). NB2 ≈ 95% of Pro — route here only when spatial composition, cinematic lighting/skin, fine typography-in-scene, or deep multi-element reasoning must be perfect. Up to 14 reference images (character locking, multi-subject fusion). Native 16:9 + 4K.',
  },
  {
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    kind: 'image',
    maxRefImages: 10,
    maxIngredients: null,
    notes:
      'TEXT/DIAGRAM/PANEL king — near-perfect character-level text, ordered panels, exact placement (~3s gens). Route here for character sheets, shot grids, and text-bearing panels. Quality tiers: medium (default, the value seat — half NB2 price at 1080p) / high (~4×, max text precision). Third filter regime (OpenAI moderate). 4K is API-only — even paid ChatGPT can\'t render it. Photoreal/character-locked/edit-heavy → Banana line instead.',
  },
  {
    id: 'flux-2-max',
    label: 'FLUX.2 Max',
    kind: 'image',
    maxRefImages: 4,
    maxIngredients: null,
    notes: 'Photoreal, less censored, up to ~4MP. Auto-routes to its edit endpoint when references are present. Lower ref cap than NB2.',
  },
  {
    id: 'seedream-5-lite',
    label: 'Seedream 5 Lite',
    kind: 'image',
    maxRefImages: 10,
    maxIngredients: null,
    notes: 'Cheapest image model (~flat price). Less censored. Routes to its edit endpoint with references.',
  },
  {
    id: 'seedance-2',
    label: 'Seedance 2.0',
    kind: 'video',
    maxRefImages: null,
    maxIngredients: 9, // ingredient images per video gen
    maxReferenceVideos: 3,
    maxReferenceAudio: 3,
    maxReferenceVideoSeconds: 15,
    maxReferenceAudioSeconds: 15,
    maxReferenceFilesTotal: 12,
    audioRefNeedsCompanion: true,
    notes: 'PREMIUM video tier and the DEFAULT video model — route here the moment physics, effects, destruction, or scale matter, and for hero shots. VIDEO-ONLY: cannot generate standalone images (use NB2/FLUX.2/Seedream for those). 4-15s, up to 9 ingredient images. Strong I2V / own-footage restyle. Native 4K, but 4K VIDEO is a Pro-only tier gate (base maxes at 1080p; server returns PRO_REQUIRED) — default 1080p unless the user is on Pro. Attaching a clip as a video reference (own-footage restyle, motion or dialogue conditioning) bills combined input+output seconds. 2.0 STAYS THE DEFAULT over 2.5 because it is the only Seedance with 1080p and 4K.',
  },
  {
    id: 'seedance-2.5',
    label: 'Seedance 2.5',
    kind: 'video',
    maxRefImages: null,
    maxIngredients: 30, // 30 image refs; the model also takes 10 video + 10 audio (50 total)
    maxReferenceVideos: 10,
    maxReferenceAudio: 10,
    maxReferenceVideoSeconds: 30,
    maxReferenceAudioSeconds: 30,
    maxReferenceFilesTotal: 50,
    // No companion requirement — audio-only references are one of the things
    // the second seat actually buys.
    notes:
      `A SECOND SEAT NEXT TO 2.0, NOT AN UPGRADE OF IT — and the single most important fact is that it is 480p/720p ONLY. No 1080p, no 4K, on any provider. Pick 2.5 over 2.0 when the shot needs LENGTH (one 30s take vs 15s), MANY REFERENCES (30 images, plus video and audio references — 50 total), an AUDIO-ONLY reference (2.0 requires an image or video alongside audio; 2.5 does not), TIMED BEATS, or tighter prompt adherence. Pick 2.0 when resolution matters at all. VIDEO-ONLY. TIMESTAMPS: ${PARTIALS['seedance-25-timestamps-short']} Multi-view subject reference images are also supported on 2.5 (up to 5 subjects) where 2.0 wanted one view per subject. 🚨 COST DISCIPLINE: 720p STOPS READING AS "THE CHEAP ONE" HERE. A 30s 720p clip on the real-face route is 710 credits and on the AI-face route 484 — more than a 15s 1080p Seedance 2.0 face generation (411), against a 1,000-credit welcome grant. Always quote with slates_estimate_generation_cost before a long take, and draft at 480p/4-8s. 🚨 PROMPT INTENT IS A TASK-TYPE TRIGGER: when a request carries reference images/video/audio, the words "add", "remove", "replace", "change", "edit the video", "extend" or "continue" make the provider reclassify it as a video EDIT or EXTEND and fail it AFTER the job queues (credits are refunded, but the run stalls). If you mean to edit an existing clip, use slates_edit_video with model seedance-2.5-edit. If you mean a fresh shot, describe the finished frame rather than an instruction to change one.`,
  },
  {
    id: 'seedance-2.5-edit',
    label: 'Seedance 2.5 Edit',
    kind: 'video',
    maxRefImages: null,
    maxIngredients: 0, // prompt + source clip only on slates_edit_video
    notes:
      'VIDEO-TO-VIDEO EDIT via slates_edit_video — the ONLY edit engine that accepts a clip LONGER THAN 15 SECONDS (4-30s vs Kling O3 edit 3-15s and Omni Flash edit 3-10s), though ByteDance recommends staying inside 20s for quality. That length is the whole reason to route here; for a clip inside the others\' range compare on fidelity instead (Omni Flash edit won the 7/09 prompt-only head-to-head; Kling edit is the one that takes element/style reference images). 480p/720p output, native audio. Prompt + source clip only on this op — no reference images (the MODEL takes 1-5 reference images on an edit; Slates has not wired that path). Phrase the change as "from A to B", and TIMESTAMP a partial edit ("…from 4-6 seconds…") — 2.5 reads whole-second timestamps on edits, and without a range the instruction applies to the whole clip. AUDIO is editable on this same row: change a line, change an accent, translate dialogue with re-fitted lips, strip or replace BGM and sound effects. Output length follows the SOURCE clip and is billed as the ceiled source length, on the video-reference rate tier: an edit costs roughly DOUBLE a plain 2.5 generation of the same length, because every provider bills an edit on input + output seconds. Set seedanceFace:true when a character face is visible in the clip — the faceless provider blocks faces outright. There is no consented-real-face route for editing.',
  },
  {
    id: 'kling-v3',
    label: 'Kling 3.0',
    kind: 'video',
    maxRefImages: null,
    maxIngredients: 4,
    notes: 'DEFAULT general-purpose video model — cost-effective, strong start-frame adherence (identity/layout/text), acting, dialogue, lip-sync, any aspect ratio. Escalate to Seedance for physics. Kling is also the ONLY engine behind the Motion Transfer and Lip Sync tools (MC std/pro, lip-sync, avatar) — those two tools are Kling-only.',
  },
  {
    id: 'kling-v3-edit',
    label: 'Kling O3 Video Edit',
    kind: 'video',
    maxRefImages: null,
    maxIngredients: 4, // combined subject elements + style refs per edit
    notes:
      'VIDEO-TO-VIDEO EDIT — the REF-DRIVEN edit tool: takes an EXISTING 3–15s clip and changes what the prompt names, with element/style reference images (@ElementN = frontal + angles) locking subject identity; max 4 combined refs. keep_audio preserves the ORIGINAL audio verbatim (spoken words cannot drift) — but video lips can drift slightly against it, and multi-beat instructions get under-executed (7/09 receipt: missed a second action beat Omni Flash edit landed) — ONE beat per pass. Route here when an edit NEEDS reference images or bit-exact audio; for prompt-only footage-synced VFX, omni-flash-edit won the 7/09 fidelity head-to-head. Billed per second of output (≈ clip length, rounded up). Seedance edit/relocate is the alternative for style-transfer-heavy jobs.',
  },
  {
    id: 'veo-3.1',
    label: 'Veo 3.1',
    kind: 'video',
    maxRefImages: null,
    maxIngredients: 3,
    notes: 'NICHE, never the default — pick only when native synchronized audio must generate WITH the video in one gen. 16:9 only, 4/6/8s only. Otherwise Kling (default) or Seedance (physics/premium) win.',
  },
  {
    id: 'omni-flash',
    label: 'Gemini Omni Flash',
    kind: 'video',
    maxRefImages: null,
    maxIngredients: 7, // ref2v image_urls; 7 mirrors Google's own reference limit
    notes:
      'CHEAP 720p tier with native synced audio included — t2v, single-start-frame i2v, or reference-to-video with up to 7 reference images. 3-10s, 16:9/9:16 only. No last frame, no video/audio references. VIDEO-ONLY. New seat: quality vs Kling/Seedance unproven pending comparison gens — do not route hero shots here; use it for cheap drafts, audio-in-one-gen at low cost, ref2v character consistency trials, and its edit variant.',
  },
  {
    id: 'omni-flash-edit',
    label: 'Omni Flash Edit',
    kind: 'video',
    maxRefImages: null,
    maxIngredients: 0, // prompt + source clip ONLY — no element/style refs on this endpoint
    notes:
      'VIDEO-TO-VIDEO EDIT, prompt-only — THE EDIT-FIDELITY WINNER (7/09 head-to-head vs Kling edit on real talking footage: lips held perfectly, audio near-identical, both action beats landed). Takes an EXISTING 3-10s clip and changes what the prompt names, footage-synced (prop/effect/environment/lighting swaps). Fidelity is EARNED by prompt discipline: ONE short instruction + "Keep everything else the same." — long descriptive prompts DESTROY it (Google-documented + 7/09 receipt). Never name objects as metaphors ("candle-like" → literal candle). Quirk: occasional tail jitter/doubled last speech beat — trim the tail. NO reference images (identity swaps needing refs → Kling edit); bit-exact audio needs → Kling keep_audio or segment-splice. 720p output, cheapest edit seat (~2/3 of Kling edit Std).',
  },
  {
    id: 'seed-audio',
    label: 'Seed Audio 1.0',
    kind: 'audio',
    maxRefImages: 1, // ONE image XOR up to 3 audio clips — the two inputs are mutually exclusive.
    maxIngredients: null,
    notes:
      'DEFAULT audio model — the one-pass SCENE workhorse: dialogue, SFX, and ambience together from ONE plain sentence. Route here for continuity beds, room tone, crowd/nature soundscapes, and quick scratch VO. AUDIO-ONLY: cannot generate images or video. 🚨 THERE IS NO DURATION PARAMETER — length comes from the words, so you MUST NAME THE LENGTH IN THE PROMPT TEXT ("... 15 seconds"). Slates appends the requested length automatically and BILLS the requested seconds, so a prompt that fights the number wastes credits. Prompts are ONE plain sentence, no production jargon and no SFX:/Ambient: prefixes (those are Kling syntax and hurt here). Say the crowd size out loud — "applause" returns a full room when the joke was three people. 1-120s. Inputs: ONE image (describe-what-you-see scoring) XOR up to 3 audio clips referenced in the prompt as @Audio1-@Audio3, never both. 20 preset voices, or leave voice unset and let the scene cast itself.',
  },
  {
    id: 'eleven-sfx',
    label: 'ElevenLabs Sound Effects v2',
    kind: 'audio',
    maxRefImages: null,
    maxIngredients: null,
    notes:
      'ONE-SHOT SOUND EFFECT with an EXACT duration — route here for a single hit that must land on a frame (door slam, whoosh, impact, UI blip) or for a seamless loop. AUDIO-ONLY. 0.5-22s, and Slates always sends the duration explicitly (a null duration means a non-deterministic charge, so it is never left to the model). Describe the physical CAUSE, not the label: "heavy oak door slams shut in a stone hallway" beats "door sound". Text caps at 450 characters. loop=true produces a seamless bed. prompt_influence 0-1: higher hugs the prompt with less variation, lower explores. For layered scenes with dialogue or room tone, seed-audio does it in one pass instead.',
  },
]

const FACT_BY_ID = new Map(MODEL_FACTS.map((m) => [m.id, m]))

export function getModelFact(id: string): ModelFact | undefined {
  return FACT_BY_ID.get(id)
}

/** The official NB2 / general image prompt formula (subject-first). */
export const IMAGE_PROMPT_FORMULA =
  '[Subject] + [Action] + [Location/context] + [Composition] + [Style]'

/** The expanded cinematic/photoreal formula for NB2 start frames. */
export const CINEMATIC_IMAGE_FORMULA =
  'Film still from [DIRECTOR] [GENRE]. Shot on [CAMERA] with [LENS]. [SUBJECT and action]. [3-5 specific visual details]. [LIGHTING — direction + quality]. [COLOR PALETTE]. [FILM STOCK or sensor language]. [1-2 word emotional tone].'
