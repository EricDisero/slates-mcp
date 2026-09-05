// Per-model prompting facts — routing doctrine and the prompt formula, as
// KNOWLEDGE (for skills + lead-magnet + op descriptions).
//
// 🚨 THE REFERENCE CAPS ARE NO LONGER TYPED HERE (2026-08-16). They are DERIVED
// from `MODEL_CAPABILITIES` in ./model-capabilities.ts, which is now the single
// definition — the same module `slate/src/shared/pricing.ts` spreads into every
// MODEL_REGISTRY entry. This file used to hand-mirror those numbers "for
// documentation"; a hand-mirror in the same package as the source is exactly the
// defect the capability SSOT exists to delete, so `caps()` below does the lookup
// and a wrong id throws at module load instead of shipping a stale number.
//
// 🚨 `notes` IS ROUTING ONLY — why you would pick THIS seat over its neighbour.
// Nothing else. Not capability numbers (MODEL_CAPABILITIES owns those and already
// GENERATES prose for them into every op's param descriptions), not prices (the
// rate functions own those, and the agent's own REAL NUMBERS ONLY rule forbids it
// repeating a figure it cannot point to in a tool result), not prompt craft (the
// matching slates-prompting-* skill owns that, loaded on demand).
//
// It was all four for a while: 16,799 characters of `notes` carried 80 resolution
// tokens, 42 duration claims, 23 hard-typed prices and two skills' worth of craft
// into a prompt prefix that is always in context. A `notes` string is a third
// rendering of a fact, and a third rendering is a third thing that can survive a
// doctrine reversal the other two got. `scripts/agent-surface-lockstep-check.mjs`
// check 5 now fails the build if a price or a capability number reappears here.
//
// Relative cost claims STAY ("dearer than 2.0 at every shared tier") — that is
// routing. The figures go, because those are data.

import { MODEL_CAPABILITIES } from './model-capabilities.js'

export interface ModelFact {
  id: string
  label: string
  kind: 'image' | 'video' | 'audio'
  /**
   * Which op this seat is reachable through. `edit` rows live on
   * slates_edit_video and must never appear in slates_generate_video's routing
   * list — they were mixed into one VIDEO block with nothing marking them.
   * Explicit rather than an id-suffix test: a structural test on "-edit" holds
   * only while that substring is unique, which is how isOmniFlashModel broke.
   */
  route: 'generate' | 'edit'
  // ── Reference caps — DERIVED, never typed. See `caps()` below. ──
  /** Max reference images (image models) — null if not applicable. */
  maxRefImages: number | null
  /** Max ingredient images (video models) — null if not applicable. */
  maxIngredients: number | null
  /** Reference VIDEOS accepted in one generation. null = none. */
  maxReferenceVideos?: number | null
  /** Reference AUDIO clips accepted in one generation. null = none. */
  maxReferenceAudio?: number | null
  /** Combined seconds across every reference video. */
  maxReferenceVideoSeconds?: number | null
  /** Combined seconds across every reference audio clip. */
  maxReferenceAudioSeconds?: number | null
  /** Ceiling on TOTAL reference files across all modalities. */
  maxReferenceFilesTotal?: number | null
  /**
   * An audio reference needs at least one image or video reference alongside.
   *
   * Still declared here rather than derived: it is a BEHAVIOURAL rule, not a
   * cap, and its runtime home is the registry FEATURE flag
   * `features.audioRefNeedsCompanion` (which gates composer affordances). Only
   * Seedance 2.0 sets it; 2.5 allowing audio-only references is one of the
   * things the second seat buys.
   */
  audioRefNeedsCompanion?: boolean
  notes: string
}

/**
 * Reference caps for a fact, read out of the capability SSOT.
 *
 * The argument is a `MODEL_CAPABILITIES` key, which is a REGISTRY model id — and
 * three facts here are FAMILY-level (`kling-v3`, `kling-v3-edit`, `veo-3.1`)
 * with no registry row of their own, so they name a representative variant.
 * That is safe because the caps are identical across the variants in each
 * family (std/pro/omni/omni-pro all take 4; both edit rows take 4; both Veo
 * seats take 3) — and if a future variant diverges, this becomes a wrong number
 * rather than a crash, so split the fact rather than picking a side.
 *
 * Throws on an unknown id: a typo must fail the build, not ship as `null` caps
 * that quietly tell an agent a model reads no references.
 */
function caps(capabilityId: string): Pick<
  ModelFact,
  | 'maxRefImages' | 'maxIngredients' | 'maxReferenceVideos' | 'maxReferenceAudio'
  | 'maxReferenceVideoSeconds' | 'maxReferenceAudioSeconds' | 'maxReferenceFilesTotal'
> {
  const c = MODEL_CAPABILITIES[capabilityId]
  if (!c) throw new Error(`MODEL_FACTS: no MODEL_CAPABILITIES entry for "${capabilityId}"`)
  return {
    maxRefImages: c.maxRefImages ?? null,
    maxIngredients: c.maxIngredientImages ?? null,
    maxReferenceVideos: c.maxReferenceVideos ?? null,
    maxReferenceAudio: c.maxReferenceAudio ?? null,
    maxReferenceVideoSeconds: c.maxReferenceVideoSeconds ?? null,
    maxReferenceAudioSeconds: c.maxReferenceAudioSeconds ?? null,
    maxReferenceFilesTotal: c.maxReferenceFilesTotal ?? null,
  }
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
    route: 'generate',
    // Gemini 3.1 FLASH Image — verified against the runtime slug map in
    // slate/src/main/api/google.ts. Nano Banana PRO is a different model
    // (gemini-3-pro-image-preview); do not conflate them.
    label: 'Nano Banana 2 (Gemini 3.1 Flash Image)',
    kind: 'image',
    // 14 = 10 object-fidelity + 4 character-consistency; the categories don't trade.
    ...caps('nano-banana-2'),
    notes: 'DEFAULT image model and the all-rounder — route here unless another seat\'s speciality is the point. Best start-frame for legible in-scene text. Knowledge cutoff Jan 2025: anything later needs reference images.',
  },
  {
    id: 'nano-banana-2-lite',
    route: 'generate',
    label: 'Nano Banana 2 Lite',
    kind: 'image',
    ...caps('nano-banana-2-lite'),
    notes: 'FAST/DRAFT image tier — markedly cheaper and faster than NB2 full, at draft quality. Route here for iteration volume, then re-run the winner on NB2 full. Same Gemini content filter as NB2.',
  },
  {
    id: 'nano-banana-pro',
    route: 'generate',
    label: 'Nano Banana Pro',
    kind: 'image',
    ...caps('nano-banana-pro'),
    notes: 'HERO-FRAME / typography PREMIUM image tier. NB2 is about 95% of Pro — escalate only when spatial composition, cinematic lighting/skin, fine typography-in-scene or deep multi-element reasoning must be perfect, and say why.',
  },
  {
    id: 'gpt-image-2',
    route: 'generate',
    label: 'GPT Image 2',
    kind: 'image',
    ...caps('gpt-image-2'),
    notes: 'TEXT / DIAGRAM / PANEL king — near-perfect character-level text, ordered panels, exact placement. Route here for character sheets, shot grids and text-bearing panels. ALSO THE PHOTOREAL FRONT-RUNNER (Eric, 2026-08-24): at quality high it beat both Nano Banana rails head-to-head on skin realism, so route photoreal people HERE rather than away. Banana still owns edit-heavy work and the largest reference ceiling. Its own content filter, distinct from Gemini\'s. Killed if a head-to-head at the intended crop goes the other way — re-run the evidence test, never carry this forward on reputation.',
  },
  {
    id: 'flux-2-max',
    route: 'generate',
    label: 'FLUX.2 Max',
    kind: 'image',
    ...caps('flux-2-max'),
    notes: 'Photoreal image seat, less censored than the Gemini rails. Auto-routes to its edit endpoint when references are present.',
  },
  {
    id: 'seedream-5-lite',
    route: 'generate',
    label: 'Seedream 5 Lite',
    kind: 'image',
    ...caps('seedream-5-lite'),
    notes: 'CHEAPEST image seat, flat-priced. Less censored. Routes to its edit endpoint when references are present.',
  },
  {
    id: 'seedance-2',
    route: 'generate',
    label: 'Seedance 2.0',
    kind: 'video',
    ...caps('seedance-2'),
    audioRefNeedsCompanion: true,
    notes: 'PREMIUM video tier and the DEFAULT video model — route here the moment physics, effects, destruction or scale matter, and for hero shots. VIDEO-ONLY. Strong image-to-video and own-footage restyle. 4K is Pro-gated (base accounts get PRO_REQUIRED). Stays the default over 2.5: it is the only Seedance with native 4K and it is cheaper at every tier the two share.',
  },
  {
    id: 'seedance-2.5',
    route: 'generate',
    label: 'Seedance 2.5',
    kind: 'video',
    ...caps('seedance-2.5'),
    // No companion requirement — audio-only references are one of the things
    // the second seat actually buys.
    notes: 'A SECOND SEAT NEXT TO 2.0, NOT AN UPGRADE — and the dearer one at every tier they share. Pick 2.5 when the shot needs LENGTH, MANY references, an AUDIO-ONLY reference, TIMED BEATS, or tighter prompt adherence; pick 2.0 for 4K and for the same resolution cheaper. VIDEO-ONLY. Timestamp grammar, and the edit/extend words that make the provider reclassify a fresh generation and fail it, are in slates-prompting-seedance-2-5.',
  },
  {
    id: 'seedance-2.5-edit',
    route: 'edit',
    label: 'Seedance 2.5 Edit',
    kind: 'video',
    // 0 ingredients: prompt + source clip only on slates_edit_video.
    ...caps('seedance-2.5-edit'),
    notes: 'VIDEO-TO-VIDEO EDIT via slates_edit_video, and the only edit engine that takes a clip longer than the other two reach — that length is the whole reason to route here. Inside their range, compare on fidelity instead: Omni Flash edit won the prompt-only head-to-head, and Kling edit is the one that takes reference images. Edits audio on the same row (re-voice, re-accent, translate with re-fitted lips, replace BGM). Costs roughly double a plain 2.5 generation of the same length, because an edit bills input plus output seconds.',
  },
  {
    id: 'kling-v3',
    route: 'generate',
    label: 'Kling 3.0',
    kind: 'video',
    // Family-level fact — caps are identical across std/pro/omni/omni-pro.
    ...caps('kling-v3.0-std'),
    notes: 'DEFAULT general-purpose video model — cost-effective, strong start-frame adherence (identity, layout, text), acting, dialogue, lip-sync, and the widest aspect-ratio set. Escalate to Seedance for physics. Kling is also the ONLY engine behind the Motion Transfer and Lip Sync tools.',
  },
  {
    id: 'kling-v3-edit',
    route: 'edit',
    label: 'Kling O3 Video Edit',
    kind: 'video',
    // Family-level fact; 4 = combined subject elements + style refs per edit.
    ...caps('kling-v3.0-omni-edit'),
    notes: 'VIDEO-TO-VIDEO EDIT, the REF-DRIVEN one: it is the only edit seat that takes element/style reference images to lock subject identity, and its keep_audio preserves the original audio verbatim. Route here when an edit NEEDS reference images or bit-exact audio; for prompt-only footage-synced VFX, omni-flash-edit won the fidelity head-to-head. One instruction beat per pass — multi-beat prompts get under-executed.',
  },
  {
    id: 'veo-3.1',
    route: 'generate',
    label: 'Veo 3.1',
    kind: 'video',
    // Family-level fact — fast and standard declare the same caps.
    ...caps('veo-3.1-fast'),
    notes: 'NICHE, never the default — pick only when native synchronized audio must generate WITH the video in one pass, and the narrowest aspect-ratio and duration sets in the catalogue are acceptable. Otherwise Kling (default) or Seedance (physics/premium) win.',
  },
  {
    id: 'omni-flash',
    route: 'generate',
    label: 'Gemini Omni Flash',
    kind: 'video',
    // 7 ref2v image_urls — mirrors Google's own reference limit.
    ...caps('omni-flash'),
    notes: 'CHEAP tier with native synced audio included. Route here for cheap drafts, audio-in-one-pass at low cost, and reference-to-video character-consistency trials. VIDEO-ONLY. Quality against Kling/Seedance is unproven — do not route hero shots here.',
  },
  {
    id: 'omni-flash-edit',
    route: 'edit',
    label: 'Omni Flash Edit',
    kind: 'video',
    // 0: prompt + source clip ONLY — no element/style refs on this endpoint.
    ...caps('omni-flash-edit'),
    notes: 'VIDEO-TO-VIDEO EDIT, prompt-only — THE EDIT-FIDELITY WINNER (head-to-head vs Kling edit on real talking footage: lips held, audio near-identical, both action beats landed) and the cheapest edit seat. Footage-synced prop, effect, environment and lighting swaps. Takes NO reference images — identity swaps needing refs go to Kling edit. Fidelity is EARNED by prompt discipline; the exact form is in slates-prompting-omni-flash.',
  },
  {
    id: 'minimax-h3',
    route: 'generate',
    label: 'MiniMax H3',
    kind: 'video',
    ...caps('minimax-h3'),
    // fal's reference-to-video refuses an audio-only reference: "Audio cannot
    // be the only reference input; provide at least one reference image or
    // video with it." Same behavioural rule as Seedance 2.0.
    audioRefNeedsCompanion: true,
    notes: 'THE AUTHORED-AUDIO SEAT — reach for H3 when the sound is part of the shot rather than a switch on it: synchronised dialogue, scene sound and an audience-only score directed as three separate layers in ONE pass, across eleven languages. Kling and Seedance treat audio as on/off; Veo generates it but gives you no way to direct the layers. Only H3 also carries a DECLARED REFERENCE RELATIONSHIP (kept whole, partly kept, transferred, or a loose echo). VIDEO-ONLY. Its top two resolution tiers are UPSCALES of the native render, not larger generations — judge at native and upscale in post. Reference images past the fifth are a PAID key dimension: pass referenceImages when quoting.',
  },
  {
    id: 'minimax-h3-max',
    route: 'generate',
    label: 'MiniMax H3 Max',
    kind: 'video',
    // No reference caps: fal publishes no reference-to-video endpoint for this
    // row, so `caps()` returns nulls and the composer refuses references.
    ...caps('minimax-h3-max'),
    notes: 'THE SPEED SEAT, and the DEARER one at the tier they share — never the cheap H3 and never the default. fal\'s post-train of the H3 weights: MEASURED 2026-08-27 at about 12x faster than base H3 on the same prompt and params, queue to finished file, plus a thin vendor-reported quality edge. It gives up the upper resolution tiers and the REFERENCE endpoint, so the omni-reference set is base-H3 only — but it still animates start and end frames, which is one of the two things it is FOR. Never describe this row as taking no image input. Route here when a fast turnaround on text-to-video or a start-frame shot is worth the premium.',
  },
  {
    id: 'ltx-2-5',
    route: 'generate',
    label: 'LTX-2.5',
    kind: 'video',
    // No reference caps: fal publishes text-to-video and image-to-video for LTX
    // and no reference endpoint at all, so `caps()` returns nulls and the
    // composer refuses references. Start/end FRAMES are unaffected.
    ...caps('ltx-2-5'),
    notes: 'THE VOLUME SEAT — the cheapest native 1080p second in the catalogue, and the row for MANY takes rather than one hero shot. Native synced audio is included free at every tier, unlike Kling where sound is a paid key dimension. It also reaches the highest resolution tier below 4K and makes the LONGEST clips in the catalogue. VIDEO-ONLY. INPUTS ARE FRAMES, NOT REFERENCES: start frame plus an optional end frame, and no reference endpoint at all — for character consistency across shots use H3 or Kling. Route here for batch coverage, long takes, and anything where the credit budget is the binding constraint.',
  },
  {
    id: 'ltx-2-5-pro',
    route: 'generate',
    label: 'LTX-2.5 Pro',
    kind: 'video',
    ...caps('ltx-2-5-pro'),
    notes: 'THE FIDELITY SEAT of the LTX pair — the full diffusion build against the base row\'s distilled one. 🚨 IT IS NOT A SUPERSET OF THE BASE ROW, which is the opposite of every other Pro seat here: it reaches a SHORTER resolution ladder and makes SHORTER clips, and it costs more at both tiers they share. Reaching for it because the name says Pro costs more AND takes away reach. Everything else matches the base row. Route here only when a specific shot needs the fidelity and fits inside its narrower envelope.',
  },
  {
    id: 'seed-audio',
    route: 'generate',
    label: 'Seed Audio 1.0',
    kind: 'audio',
    // ONE image XOR up to 3 audio clips — the two inputs are mutually exclusive.
    ...caps('seed-audio'),
    notes: 'DEFAULT audio model — the one-pass SCENE workhorse: dialogue, SFX and ambience together from ONE plain sentence. Route here for continuity beds, room tone, crowd and nature soundscapes, and quick scratch VO. AUDIO-ONLY. Takes one image XOR up to three audio clips as references, never both. Prompt form and the length rule are in slates-prompting-seed-audio.',
  },
  {
    id: 'eleven-sfx',
    route: 'generate',
    label: 'ElevenLabs Sound Effects v2',
    kind: 'audio',
    ...caps('eleven-sfx'),
    notes: 'ONE-SHOT SOUND EFFECT with an EXACT duration — route here for a single hit that must land on a frame (door slam, whoosh, impact, UI blip) or for a seamless loop. AUDIO-ONLY. For layered scenes with dialogue or room tone, seed-audio does it in one pass instead.',
  },
]

const FACT_BY_ID = new Map(MODEL_FACTS.map((m) => [m.id, m]))

/**
 * Routing prose for one lane, generated from the SSOT.
 *
 * THE ONE RENDERER. The Studio Agent's system prompt, the MCP server's
 * instructions and the generate/edit ops' `model` descriptions all call this —
 * so "never restate model routing in an op description" (slates-mcp/CLAUDE.md)
 * is now enforced by there being nothing to restate. Before this, the video op
 * carried 1,282 characters of hand-written routing that repeated MODEL_FACTS
 * phrase for phrase ("SECOND SEAT", "AUTHORED-AUDIO", "never the default"),
 * in the same file that forbids exactly that.
 */
export function describeRouting(
  kind: ModelFact['kind'],
  route: ModelFact['route'] = 'generate'
): string {
  return MODEL_FACTS.filter((f) => f.kind === kind && f.route === route)
    .map((f) => `${f.label}: ${f.notes}`)
    .join('\n')
}

export function getModelFact(id: string): ModelFact | undefined {
  return FACT_BY_ID.get(id)
}

