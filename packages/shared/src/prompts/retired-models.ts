// ─────────────────────────────────────────────────────────────────────────────
// RETIRED SEATS — the one list of models that left the roster.
//
// Everything a retirement changes reads this file: the label an old take keeps
// (slate `modelLabel`), the seat a saved recipe moves to (slate
// `migrateRetiredModel`), the cost keys the server still bills older desktops
// for and hides from the agent's model list (slates-api `agent-models.ts`), the
// guide name an older client's agent still asks for (slates-api `brain.ts`), and
// the words the static check counts across the four repos
// (`scripts/retired-model-check.mjs`). slates-api's `model-lifecycle-check.mjs`
// fails a retired id still offered anywhere.
//
// Retiring a model is: delete its rows, add its entry here, run
// `npm run check:model-lifecycle` in slates-api.
//
// LEAF MODULE: no imports. `model-capabilities.ts` re-exports it, and the
// desktop renderer bundles both.
// ─────────────────────────────────────────────────────────────────────────────

export interface RetiredSeat {
  /** The live seat a saved recipe, template or default moves to. */
  readonly replacement: string
  /** What an old take made by this seat is still called. */
  readonly label: string
  readonly retiredOn: string
  /**
   * `'update-floor'`: the server still bills this seat's cost keys, because
   * desktops released before the retirement still send them, until the first
   * desktop without the seat is the oldest one supported. `null`: its keys are
   * gone from `CREDIT_COSTS`.
   */
  readonly keysBilledUntil: 'update-floor' | null
  /** The guide name a published client's agent still asks for; the server answers it with the replacement's guide. */
  readonly oldGuide?: string
  /**
   * What the static check counts as a mention, when the whole family left.
   * Empty when the family lives on under a newer version (`nano-banana-2` beside
   * `nano-banana-2-1`), where a word match would count the live seat.
   */
  readonly terms: readonly RegExp[]
  /** Files the server keeps while `keysBilledUntil` holds; the static check does not count them. */
  readonly serverFiles?: readonly string[]
}

// Two expressions per family, because only the first may ignore case: `/i` on
// the second would let lowercase `veo` inside `curveOut` match.
const VEO_TERMS = [/(?<![A-Za-z])veo/gi, /(?<=[a-z])Veo/g] as const
const LTX_TERMS = [/(?<![A-Za-z])ltx/gi, /(?<=[a-z])Ltx/g] as const
const LTX_SERVER_FILES = ['slates-api/src/lib/ltx-keys.ts', 'slates-api/scripts/ltx-billing-gate-check.mjs'] as const

export const RETIRED_SEATS: Readonly<Record<string, RetiredSeat>> = {
  // 2026-09-09: GPT Image 2.5 replaced it; Sunburst is the seat that does not
  // downgrade. 2026-11-10 (Eric): GPT Image 2.6 replaced 2.5, seat for seat.
  'gpt-image-2': { replacement: 'gpt-image-2-6-sunburst', label: 'GPT Image 2', retiredOn: '2026-09-09', keysBilledUntil: 'update-floor', terms: [] },
  'gpt-image-2-5-flare': { replacement: 'gpt-image-2-6-flare', label: 'GPT Image 2.5 Flare', retiredOn: '2026-11-10', keysBilledUntil: 'update-floor', oldGuide: 'slates-prompting-gpt-image-2-5', terms: [] },
  'gpt-image-2-5-sunburst': { replacement: 'gpt-image-2-6-sunburst', label: 'GPT Image 2.5 Sunburst', retiredOn: '2026-11-10', keysBilledUntil: 'update-floor', oldGuide: 'slates-prompting-gpt-image-2-5', terms: [] },
  // 2026-10-02 (Eric): Seedance 2.5 is the default video seat and takes every Veo
  // duration (4-8s inside its 4-30s) and both of Veo's ratios on the credits route.
  'veo-3.1-fast': { replacement: 'seedance-2.5', label: 'Veo 3.1 Fast', retiredOn: '2026-10-02', keysBilledUntil: 'update-floor', terms: VEO_TERMS, serverFiles: ['slates-api/src/lib/veo-keys.ts'] },
  'veo-3.1-standard': { replacement: 'seedance-2.5', label: 'Veo 3.1 Standard', retiredOn: '2026-10-02', keysBilledUntil: 'update-floor', terms: VEO_TERMS, serverFiles: ['slates-api/src/lib/veo-keys.ts'] },
  // 2026-10-23 (Eric): Nano Banana 2.1 replaced every Nano Banana row, FLUX 3 Image replaced FLUX.2 Max.
  'nano-banana-2': { replacement: 'nano-banana-2-1', label: 'Nano Banana 2', retiredOn: '2026-10-23', keysBilledUntil: 'update-floor', terms: [] },
  'nano-banana-2-lite': { replacement: 'nano-banana-2-1', label: 'Nano Banana 2 Lite', retiredOn: '2026-10-23', keysBilledUntil: 'update-floor', terms: [] },
  'nano-banana-pro': { replacement: 'nano-banana-2-1', label: 'Nano Banana Pro', retiredOn: '2026-10-23', keysBilledUntil: 'update-floor', terms: [] },
  'flux-2-max': { replacement: 'flux-3', label: 'FLUX.2 Max', retiredOn: '2026-10-23', keysBilledUntil: 'update-floor', terms: [] },
  // 2026-11-10 (Eric, "Yes, same release"): Gemini Omni Flash 1.2 replaced 1.1, seat for seat.
  'omni-flash': { replacement: 'omni-flash-1-2', label: 'Gemini Omni Flash 1.1', retiredOn: '2026-11-10', keysBilledUntil: 'update-floor', terms: [] },
  'omni-flash-edit': { replacement: 'omni-flash-1-2-edit', label: 'Omni Flash 1.1 Edit', retiredOn: '2026-11-10', keysBilledUntil: 'update-floor', terms: [] },
  // 2026-11-16 (Eric): Seedream 5.5 replaced Seedream 5 Lite and became the default image seat.
  'seedream-5-lite': { replacement: 'seedream-5-5', label: 'Seedream 5 Lite', retiredOn: '2026-11-16', keysBilledUntil: 'update-floor', oldGuide: 'slates-prompting-seedream-5-lite', terms: [] },
  // 2026-11-24 (Eric, "I would just remove LTX 2.5 completely"): both seats, nothing replaces them. A saved
  // recipe lands on Seedance 2.5, which takes every LTX length (6-20s inside its 4-30s); a 1440p Shot is clamped
  // to the nearest rung Seedance has.
  'ltx-2-5': { replacement: 'seedance-2.5', label: 'LTX-2.5', retiredOn: '2026-11-25', keysBilledUntil: 'update-floor', oldGuide: 'slates-prompting-ltx-2-5', terms: LTX_TERMS, serverFiles: LTX_SERVER_FILES },
  'ltx-2-5-pro': { replacement: 'seedance-2.5', label: 'LTX-2.5 Pro', retiredOn: '2026-11-25', keysBilledUntil: 'update-floor', oldGuide: 'slates-prompting-ltx-2-5', terms: LTX_TERMS, serverFiles: LTX_SERVER_FILES },
}

/**
 * Older roster changes with no seat to move to: only their labels survive, on
 * takes made before them. `kling-v2-1` is how such takes are stamped; the dotted
 * spelling is the one older rows and the 1.5.8 usage table used.
 */
export const HISTORY_MODEL_LABELS: Readonly<Record<string, string>> = {
  'kling-image-o1': 'Kling Image O1',
  'kling-v2-1': 'Kling V2.1',
  'kling-v2.1': 'Kling V2.1',
  'kling-v2.5-turbo-std': 'Kling V2.5 Turbo Std',
  'kling-v2.5-turbo-pro': 'Kling V2.5 Turbo Pro',
  'kling-v2.6-std': 'Kling V2.6 Std',
  'kling-v2.6-pro': 'Kling V2.6 Pro',
  'kling-v2.6-audio': 'Kling V2.6 + Audio',
}

/** Retired id → the seat that replaced it. */
export const RETIRED_MODELS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(RETIRED_SEATS).map(([id, seat]) => [id, seat.replacement]),
)
