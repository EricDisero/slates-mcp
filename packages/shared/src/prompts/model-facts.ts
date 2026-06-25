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
    notes: 'Hero video model — physics, effects, scale. Up to 9 ingredient images. Strong I2V / own-footage restyle.',
  },
  {
    id: 'kling-v3',
    label: 'Kling 3.0',
    kind: 'video',
    maxRefImages: null,
    maxIngredients: 4,
    notes: 'Budget-cinematic video — acting, dialogue, lip-sync. Strong start-frame adherence.',
  },
  {
    id: 'veo-3.1',
    label: 'Veo 3.1',
    kind: 'video',
    maxRefImages: null,
    maxIngredients: 3,
    notes: 'Native audio. Default audio-on. Strong prompt adherence; treats the prompt as scene direction.',
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
