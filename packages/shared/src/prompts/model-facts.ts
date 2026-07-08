// Per-model prompting facts — reference/ingredient limits and the prompt
// formula, as KNOWLEDGE (for skills + lead-magnet + desktop tooltips). The
// RUNTIME source of truth for limits is slate/src/shared/pricing.ts
// (MODEL_REGISTRY.maxRefImages / maxIngredientImages); these mirror it for
// documentation. Code-verified 2026-06-25.

export interface ModelFact {
  id: string
  label: string
  kind: 'image' | 'video'
  /** Max reference images (image models) — null if not applicable. */
  maxRefImages: number | null
  /** Max ingredient images (video models) — null if not applicable. */
  maxIngredients: number | null
  notes: string
}

export const MODEL_FACTS: ModelFact[] = [
  {
    id: 'nano-banana-2',
    label: 'Nano Banana 2 (Gemini 3 Image)',
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
    notes: 'PREMIUM video tier — route here the moment physics, effects, destruction, or scale matter, and for hero shots. VIDEO-ONLY: cannot generate standalone images (use NB2/FLUX.2/Seedream for those). Up to 9 ingredient images. Strong I2V / own-footage restyle. Native 4K, but 4K VIDEO is a Pro-only tier gate (base maxes at 1080p; server returns PRO_REQUIRED) — default 1080p unless the user is on Pro. Also the PREMIUM engine inside the Motion Transfer and Lip Sync tools (single-pass: driving video / dialogue are native conditioning signals — better motion fidelity, natural speech, voice cloned from a video source; video references bill input+output seconds).',
  },
  {
    id: 'kling-v3',
    label: 'Kling 3.0',
    kind: 'video',
    maxRefImages: null,
    maxIngredients: 4,
    notes: 'DEFAULT general-purpose video model — cost-effective, strong start-frame adherence (identity/layout/text), acting, dialogue, lip-sync, any aspect ratio. Escalate to Seedance for physics. In the Motion Transfer / Lip Sync tools, Kling (MC / lip-sync / avatar) is the cheap utility lane; Seedance is the premium single-pass lane.',
  },
  {
    id: 'kling-v3-edit',
    label: 'Kling O3 Video Edit',
    kind: 'video',
    maxRefImages: null,
    maxIngredients: 4, // combined subject elements + style refs per edit
    notes:
      'VIDEO-TO-VIDEO EDIT (default edit tool) — takes an EXISTING 3–15s clip and changes only what the prompt names: character swap, environment change, style transfer. Original motion/camera/audio preserved. One pass, no masking. Use to FIX a 90%-right clip instead of re-rolling it, or to AI-edit the user\'s own footage. Elements (@ElementN = frontal + angles) lock subject identity; max 4 combined refs. Billed per second of output (≈ clip length, rounded up). Seedance edit/relocate is the alternative for style-transfer-heavy jobs.',
  },
  {
    id: 'veo-3.1',
    label: 'Veo 3.1',
    kind: 'video',
    maxRefImages: null,
    maxIngredients: 3,
    notes: 'NICHE, never the default — pick only when native synchronized audio must generate WITH the video in one gen. 16:9 only, 4/6/8s only. Otherwise Kling (default) or Seedance (physics/premium) win.',
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
