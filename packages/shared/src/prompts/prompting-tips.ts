// Per-model PROMPTING TIPS — the user-facing card content rendered by the
// desktop app's "See prompting tips" modals. SINGLE SOURCE OF TRUTH: this
// file. The desktop renders whatever this exports (no hand-written tips JSX
// in slate — that's how the Omni Flash / Veo / Kling chimera modal shipped).
//
// Relationship to the skills: packages/shared/skills/slates-prompting-*.md
// are the LONG-FORM agent guidance; these tips are the curated end-user
// subset of the same knowledge. When a skill's rules change, update the
// matching entry here in the same pass. Keys are model FAMILIES — the
// desktop maps concrete model ids to a family key with its MODEL_REGISTRY
// helpers (the runtime truth for ids lives in slate/src/shared/pricing.ts).

export interface PromptingTipCard {
  heading: string
  /** Monospace example line(s). \n renders as a line break. */
  example?: string
  note: string
  /** Render highlighted as a critical/mandatory card. */
  critical?: boolean
}

export interface PromptingTipsEntry {
  /** Family label for the modal title ("Prompting Tips — {label}"). */
  label: string
  /** Intro paragraphs above the cards. */
  intro: string[]
  /** Two columns of tip cards. */
  columns: [PromptingTipCard[], PromptingTipCard[]]
  /** Footer callout paragraphs. */
  footer?: string[]
}

export type PromptingTipsKey =
  | 'seedance'
  | 'kling'
  | 'kling-edit'
  | 'veo'
  | 'omni-flash'
  | 'omni-flash-edit'
  | 'nano-banana'
  | 'nano-banana-lite'

const SEEDANCE: PromptingTipsEntry = {
  label: 'Seedance 2.0',
  intro: [
    'Seedance 2.0 wants natural prose with narrative timing beats. Not shot brackets, not bullet points. Audio is always generated alongside video at no extra cost.',
    "Follow ByteDance's official 6-step formula: Subject, Action, Environment, Camera, Style, Constraints. Sweet spot 60-150 words for single shots, longer for multi-shot.",
  ],
  columns: [
    [
      {
        heading: 'Pin the subject in the first sentence',
        example: 'A matte black earbud case sits on a polished obsidian surface...',
        note: "The first 20-30 words are the identity anchor. If the subject isn't locked in immediately, Seedance will hallucinate new subjects mid-generation.",
      },
      {
        heading: 'Narrative timing beats',
        example: 'At 2 seconds, the camera begins a slow dolly forward. At 4 seconds, the lid opens in slow-motion...',
        note: 'Use "At N seconds" — not SHOT brackets. 2 beats for a 5s clip, 3 for 10s, 4-5 for 15s.',
      },
      {
        heading: 'Lighting is the #1 quality lever',
        example: 'A cool-white diagonal beam from upper left, dust particles drifting through...',
        note: 'ByteDance says lighting has the biggest impact on quality of any prompt element. Describe it before or alongside the subject.',
      },
    ],
    [
      {
        heading: '8 supported camera moves',
        example: 'push-in · pull-out · pan · tracking · orbit · aerial · handheld · fixed',
        note: 'Use these exact terms. "Dolly in" not "zoom in." "Orbit" not "circle." One primary camera move per beat — never stack them.',
      },
      {
        heading: 'Slow-motion works ("fast" doesn\'t)',
        example: 'the lid opens in slow-motion · the blade whips through the air',
        note: 'Speed ramps and slow-motion are supported in natural language. Avoid the word "fast" — it\'s ByteDance\'s #1 quality-degrading keyword.',
      },
      {
        heading: 'Separate camera from subject motion',
        example: 'The earbud rises smoothly. The camera tracks upward.',
        note: 'Two different sentences. Mixing them ("the camera speed ramps as the earbud rises") is the #1 cause of shaky, glitchy output.',
      },
    ],
  ],
  footer: [
    'Style block at the end: one primary anchor plus 2-3 supporting details. End with "Single continuous take" if you want one shot with no cuts. Never write "no cut" or "seamless transition" — those aren\'t in the training vocabulary.',
    'Multi-modal: up to 9 images + 1 video + audio refs. Reference in prompt with @character, @environment, @audio1. Max length: 4,000 characters.',
  ],
}

const KLING: PromptingTipsEntry = {
  label: 'Kling 3.0',
  intro: [
    'Kling 3.0 features native audio-visual co-generation with dialogue, sound effects, and music (Omni tier). Define your core subjects clearly at the beginning of the prompt and keep descriptions consistent across shots.',
  ],
  columns: [
    [
      {
        heading: 'Dialogue',
        example: 'Character says, "exact words here"',
        note: 'Use quotation marks for precise speech. Languages (Omni only): English, Chinese, Japanese, Korean, Spanish.',
      },
      {
        heading: 'Voice Quality',
        example: 'with a trembling voice, "I\'m scared"',
        note: "Describe emotional tone, pitch, or speaking style before the dialogue. No pronouns or synonyms after a character's first introduction — they cause voice drift.",
      },
      {
        heading: 'Sound Effects',
        example: 'SFX: heavy boots on wet pavement, distant siren wailing',
        note: 'Use the "SFX:" prefix, with physical-cause specificity — "SFX: footsteps" is too vague.',
      },
    ],
    [
      {
        heading: 'Multi-Character Dialogue (Omni)',
        example: 'Alice says in English, "Hello!" Immediately, Bob replies in Spanish, "¡Hola!"',
        note: 'The "Immediately" keyword makes lines back-to-back; without it Kling adds a natural conversational beat.',
      },
      {
        heading: 'Ambient Noise & Music',
        example: 'Ambient noise: city traffic, birds chirping\nBackground music: tense orchestral strings',
        note: 'Set the background soundscape and request specific music styles or moods.',
      },
      {
        heading: 'Multi-shot',
        example: 'Shot 1: ... Shot 2: ...',
        note: 'Max 6 cuts, 15s total. One primary action and ONE camera move per shot; describe the subject identically in every shot block.',
      },
    ],
  ],
  footer: [
    'Keep dialogue concise (under 10 seconds per line). Use the Language and Accent settings in Audio Controls to control speech characteristics.',
  ],
}

const KLING_EDIT: PromptingTipsEntry = {
  ...KLING,
  label: 'Kling O3 Edit',
  columns: [
    KLING.columns[0],
    [
      ...KLING.columns[1],
      {
        heading: 'Video edit — name the change, keep the rest',
        example: 'Replace the man in @Video1 with @Element1, keeping his walk cycle, the camera move, and the rain unchanged.',
        note: '@Video1 is your clip; attached subject refs compile to @Element1..; style refs to @Image1.. (max 4 combined). One edit intent per pass — chain passes for compound changes. Original audio is preserved verbatim.',
        critical: true,
      },
    ],
  ],
}

const VEO: PromptingTipsEntry = {
  label: 'Veo 3.1',
  intro: [
    'Veo 3.1 generates synchronized audio directly with video. Aspect ratio: 16:9 only (for 9:16 vertical, use Kling or Seedance). Native single-clip duration: 4, 6, or 8 seconds — longer durations require chaining clips via last-frame reuse.',
    'Official Cloud formula: [Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance]. Sweet spot ~50-150 words.',
  ],
  columns: [
    [
      {
        heading: 'Dialogue',
        example: 'Character says, "exact words"',
        note: 'Use quotation marks for exact speech. Keep voice direction terse: "says in a weary voice", "whispers", "shouts". 2-3 speakers max — sync degrades past that.',
      },
      {
        heading: 'Sound Effects — with cause',
        example: 'SFX: thunder cracks in the distance',
        note: 'Always specify direction or distance — "SFX: thunder" alone is too vague.',
      },
      {
        heading: 'Ambient is mandatory',
        example: 'Soft office ambience. · Wind on the open ridge.',
        note: 'Include an ambience line in every scene — without it the audio mix feels dead.',
      },
    ],
    [
      {
        heading: 'No subtitles — MANDATORY',
        example: 'The founder says, "..." (no subtitles). Soft office ambience.',
        note: 'Without (no subtitles) after every dialogue line, Veo bakes subtitle text into the video. This is genuinely critical and underspecified in most guides.',
        critical: true,
      },
      {
        heading: 'Cinematography vocabulary',
        example: '85mm · shallow depth of field · Rembrandt lighting · dolly in · whip pan',
        note: 'Veo responds to real lens, lighting, and camera-move terms — lead the prompt with them.',
      },
    ],
  ],
  footer: [
    "First-frame + last-frame is Veo's strongest workflow. Generate a start frame, generate an end frame, then animate with both as anchors. Motion-Lock hack: keep ~60% of the same background pixels between start and end to prevent latent drift.",
    'Keep dialogue under one natural breath — lines fit the 8s clip ceiling. Texture-realism phrases: fine skin pores, visible fabric weave, subtle contrast, no gloss or sharpening.',
  ],
}

const OMNI_FLASH: PromptingTipsEntry = {
  label: 'Gemini Omni Flash',
  intro: [
    'Gemini Omni Flash is the cheap 720p tier with native synced audio included — dialogue, SFX, and ambient generate WITH the video at no extra cost. 3-10s, 16:9 or 9:16. Text-to-video, one start frame, or up to 7 reference images. No last frame, no video/audio references.',
  ],
  columns: [
    [
      {
        heading: 'Structure like a shot brief',
        example: 'subject + action + setting + camera + lighting + tone',
        note: 'Descriptive prompts are fine for generation (the short-prompt rule is edit-only).',
      },
      {
        heading: 'Dialogue',
        example: 'The barista says, "Your usual?"',
        note: 'Audio is prompt-driven — there are no audio parameters. Dialogue in quotes.',
      },
      {
        heading: 'Sound in plain language',
        example: 'rain patters on the tin roof · distant traffic hum',
        note: 'Describe sounds directly in the prose — no SFX: prefix needed.',
      },
    ],
    [
      {
        heading: 'Name references inline',
        example: 'Marcus (images 1 and 2) walks into the cafe...',
        note: 'Up to 7 reference images merge into one list — refer to them by number in the prompt.',
      },
      {
        heading: 'Negatives as plain instructions',
        example: 'Do not show text.',
        note: 'No negative-prompt field — write what to avoid as a direct instruction.',
      },
      {
        heading: 'Know its seat',
        note: 'Cheap drafts, iteration volume, and audio-in-one-gen at low cost. For hero shots, Kling 3.0 (general default) or Seedance 2.0 (premium/physics) still win.',
      },
    ],
  ],
}

const OMNI_FLASH_EDIT: PromptingTipsEntry = {
  label: 'Omni Flash Edit',
  intro: [
    'Omni Flash Edit changes what the prompt names in an existing 3-10s clip, footage-synced — prop, effect, environment, and lighting swaps. Prompt + source clip only: no reference images (identity swaps that need refs → Kling O3 Edit). 720p output; voice editing unsupported.',
  ],
  columns: [
    [
      {
        heading: 'One short change — MANDATORY',
        example: 'Small magical flames appear on his fingertips when he snaps his fingers, and vanish when he blows on them. Keep everything else the same.',
        note: "Google's own doc: simple prompts work best; overly descriptive prompts cause unintended changes. Long \"keep every frame identical\" preambles make drift WORSE. One change, then the magic phrase.",
        critical: true,
      },
      {
        heading: 'Always end with the preservation phrase',
        example: '...Keep everything else the same.',
        note: 'The one documented preservation lever. Every edit prompt ends with it.',
      },
      {
        heading: 'Never name objects as metaphors',
        example: '❌ a candle-like flame  →  ✅ small magical flames on his fingertips',
        note: '"Candle-like" renders a literal candle in his hand. Describe the effect itself.',
      },
    ],
    [
      {
        heading: 'No conditional timing cues',
        example: '❌ ...appears WHEN he calls it, perches AS he walks',
        note: "Beat-by-beat stage directions cued to moments in the footage hard-fail the request. Collapse to one continuous action; the model syncs it to the footage's own motion.",
      },
      {
        heading: 'Frame effects as harmless VFX',
        example: '❌ his fingertips catch fire  →  ✅ magical flames appear on his fingertips',
        note: "Google's safety filter is strict about harm-to-person phrasing. Magical/harmless framing passes.",
      },
      {
        heading: 'Expect a possible tail artifact',
        note: "Occasional jitter or a doubled final speech beat in the last ~0.5s. Trim the tail on the timeline — don't burn a re-roll on it.",
      },
    ],
  ],
  footer: [
    'Ship via segment-splice: edit only the seconds where the change happens (Trim / Split first), then splice back over the original on the timeline with the original audio underneath. Chain edits one change at a time — each edit saves as a new clip linked to its parent.',
  ],
}

const NANO_BANANA: PromptingTipsEntry = {
  label: 'Nano Banana 2',
  intro: [
    'Nano Banana 2 is a language model that outputs pixels. Brief it like a creative director, not like a Stable-Diffusion tag tool. The biggest realism lever: specificity that mimics how real photographers describe their work.',
    "Google's 4 official rules: Be specific. Use positive framing (describe what you want, not what you don't). Control the camera with cinematic terms. Iterate conversationally.",
  ],
  columns: [
    [
      {
        heading: 'Cinematic prompt formula',
        example: 'Film still from [Director] [genre]. Shot on [camera] with [lens]. [Subject + action]. [3-5 details]. [Lighting]. [Color palette]. [Film stock].',
        note: 'Specific gear beats generic descriptors. "ARRI Alexa 65 with Panavision anamorphic" outperforms "cinematic camera."',
      },
      {
        heading: 'Named lenses + apertures',
        example: '85mm f/1.4 · 135mm f/2.8 · 50mm f/1.2 · 35mm f/2 · Panavision anamorphic · 400mm telephoto',
        note: '135mm f/2.8 is the cheat code for skin texture and intimate compression. Anamorphic for cinematic width + horizontal flares.',
      },
      {
        heading: 'Named film stocks (one per prompt)',
        example: 'Kodak Portra 400 · Fuji Velvia 50 · Ilford HP5 Plus · CineStill 800T',
        note: 'Portra = natural skin warmth. Velvia = saturated landscape. HP5 = gritty B&W grain. CineStill 800T = tungsten night with halation. Never mix stocks.',
      },
      {
        heading: 'Physics-based lighting',
        example: 'Single key light at 45 degrees from upper left. Color temperature 4500K. Crisp catchlights in the eyes.',
        note: 'Direction + Kelvin temp + named source. "Single key light at 10 o\'clock" beats "soft lighting" every time.',
      },
      {
        heading: 'Imperfection vocabulary',
        example: 'visible pores · peach fuzz · ISO noise · sweat beading · slight hyperpigmentation · unretouched raw photography',
        note: 'Forces the model away from AI-clean skin. The default is too smooth — you have to ask for the imperfections that real photos have.',
      },
    ],
    [
      {
        heading: '❌ The anti-list — avoid these',
        example: '8k · masterpiece · hyperrealistic · ultra-detailed · trending on ArtStation · perfect skin · flawless · airbrushed · cinematic (alone)',
        note: 'Tag-soup phrases from the Stable-Diffusion era. Measured success ~60-70% with these vs ~95%+ with positive description. Always specify which cinema — director, lens, era, stock.',
        critical: true,
      },
      {
        heading: 'No negative-prompt field',
        example: '✅ "empty street" not "no cars"\n✅ "without people, vehicles, or signage"\n❌ "not anime, not cartoon, not 3D"',
        note: 'Reframe positively first. Use inline "without" / "free of" only when positive framing can\'t suppress the unwanted element.',
      },
      {
        heading: 'Reference images — label every role',
        example: 'Image 1: Character ref — facial features, body proportions\nImage 2: Environment ref — architecture, lighting\nImage 3: Style ref — mood, aesthetic',
        note: "Up to 14 refs (10 object + 4 character — caps don't trade). The @ and # mention system labels these automatically. Start with 2-3 focused refs.",
      },
      {
        heading: 'Common fixes',
        example: 'Hands → "five fingers, natural proportions"\nText → quote-wrap "HEADLINE" + specify font\nLeft/right → "from the character\'s perspective"',
        note: "Default left/right is the viewer's perspective. Surreal prompts trip uncanny valley — the model drags toward realism. For surrealism, lean hard into \"painted\" / \"illustrated\".",
      },
      {
        heading: 'Resolution tactics',
        example: '1k = drafts · 2k = hero · 4k = print/final',
        note: 'Pick by need. 2K+ allocates more tokens to surface detail, so texture vocab (pores, fabric weave, grain) compounds at higher resolution.',
      },
    ],
  ],
  footer: [
    'Boring vs Cinema. Boring: "Wide shot of man on dock looking at forest." Cinema: "Direct overhead drone shot on weathered dock. Single figure climbing up frame bottom. Boot prints leading toward shore. Pale winter light. Anamorphic flare. Desaturated blue/slate palette. Kodak Portra 400 grain. Map of threat."',
    "3-strike rule. If three iterations on the same prompt haven't landed, stop. The slot machine doesn't converge — the prompt structure is wrong, not the seed.",
  ],
}

const NANO_BANANA_LITE: PromptingTipsEntry = {
  ...NANO_BANANA,
  label: 'Nano Banana 2 Lite',
  columns: [
    NANO_BANANA.columns[0],
    NANO_BANANA.columns[1].map((card) =>
      card.heading === 'Resolution tactics'
        ? {
            heading: 'Resolution tactics',
            example: '1k only on Lite',
            note: 'Lite outputs 1K only — use it for iteration volume and drafts, then switch to Nano Banana 2 for 2K/4K finals.',
          }
        : card
    ),
  ],
}

export const PROMPTING_TIPS: Record<PromptingTipsKey, PromptingTipsEntry> = {
  seedance: SEEDANCE,
  kling: KLING,
  'kling-edit': KLING_EDIT,
  veo: VEO,
  'omni-flash': OMNI_FLASH,
  'omni-flash-edit': OMNI_FLASH_EDIT,
  'nano-banana': NANO_BANANA,
  'nano-banana-lite': NANO_BANANA_LITE,
}

/** Null when no tips exist for the key — callers render an honest fallback. */
export function getPromptingTips(key: string): PromptingTipsEntry | null {
  return (PROMPTING_TIPS as Record<string, PromptingTipsEntry>)[key] ?? null
}
