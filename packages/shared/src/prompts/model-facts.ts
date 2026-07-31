// Per-model prompting facts — reference/ingredient limits and the prompt
// formula, as KNOWLEDGE (for skills + lead-magnet + desktop tooltips). The
// RUNTIME source of truth for limits is slate/src/shared/pricing.ts
// (MODEL_REGISTRY.maxRefImages / maxIngredientImages); these mirror it for
// documentation. Code-verified 2026-06-25.

export interface ModelFact {
  id: string
  label: string
  kind: 'image' | 'video' | 'audio'
  /** Max reference images (image models) — null if not applicable. */
  maxRefImages: number | null
  /** Max ingredient images (video models) — null if not applicable. */
  maxIngredients: number | null
  notes: string
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
    id: 'eleven-v3',
    label: 'ElevenLabs Eleven v3 (TTS)',
    kind: 'audio',
    maxRefImages: null,
    maxIngredients: null,
    notes:
      'CONTROLLED, REPEATABLE named-voice VOICEOVER — route here whenever the exact words matter and must be re-renderable in the same voice (ad reads, narration, character lines to lip-sync against). AUDIO-ONLY. The text field IS the script: it is spoken verbatim, so never put stage directions in it. 1-5000 characters, billed per 100-character bucket, so trimming a sentence genuinely saves credits. 20 preset voices (Rachel default) — pick one and keep it for the whole piece. stability 0-1 trades consistency against expressiveness (low = more emotive and more variable). No voice cloning on this route. Word-level timestamps come back free and are what a future caption pass consumes. For scene ambience or SFX rather than speech, use seed-audio / eleven-sfx.',
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
  {
    id: 'suno',
    label: 'Suno',
    kind: 'audio',
    maxRefImages: null,
    maxIngredients: null,
    notes:
      'FULL MUSIC TRACKS with structure — route here for anything a listener would call a song or a score. AUDIO-ONLY. EVERY call returns TWO variations for one flat price, and duration is FREE up to 360s (measured 2026-07-31: a 240s track costs the same as a default one), which makes it the cheapest way to get a bed that outlasts a cut. Two modes: DESCRIPTION mode (customMode=false, prompt is a <=500-char description and the lyrics get written for you) and CUSTOM mode (customMode=true, needs style + title; prompt then holds the EXACT LYRICS, sung as written — never put a description there). instrumental=true scores a scene with no vocals. Steer with style/negativeTags rather than piling adjectives into the prompt. duration 10-360s is V5_5 + custom mode only. Unofficial API wrapper, so treat availability as best-effort.',
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
