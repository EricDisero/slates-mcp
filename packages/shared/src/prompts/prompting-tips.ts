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
//
// Cards whose content is ALSO doctrine (not just model trivia) compose their
// copy from skills/_partials/*.md via PARTIALS rather than restating it. The
// NANO_BANANA reference card is why: it shipped "label every role" — retired
// doctrine — for thirteen months after the reversal, in the same package as
// the rule forbidding it. Hand-sync didn't merely drift, it survived a
// reversal. Add a short partial; don't hand-copy a rule into a card.

import { PARTIALS } from './partials.generated.js'

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
    'Seedance 2.0 is a multimodal director: it reads your text, images, video and audio at once and splits them into a "spatial layer" (what is in frame) and a "temporal layer" (how it changes). So a good prompt is an engineering-style instruction, not a piece of copywriting. Audio is always generated alongside video at no extra cost.',
    "ByteDance's official advanced formula has 8 slots: precise subject + action details + scene/environment + lighting & color tone + camera movement + visual style + image quality + constraints. Sweet spot 60-150 words for a single shot, longer for multi-shot.",
  ],
  columns: [
    [
      {
        heading: 'Pin the subject in the first sentence',
        example: 'A matte black earbud case sits on a polished obsidian surface...',
        note: "The first 20-30 words are the identity anchor. If the subject isn't locked in immediately, Seedance will hallucinate new subjects mid-generation.",
      },
      {
        heading: 'Shot 1 / Shot 2 / Shot 3 — never time stamps',
        example: 'Shot 1: Side shot of the alley; the man slowly starts running.\nShot 2: He knocks over a fruit stand; the camera shakes and cuts to his face.\nShot 3: He climbs a low wall; the camera pulls back onto the empty street.',
        note: 'ByteDance: write a "Shot 1 / Shot 2 / Shot 3" storyboard in the order events occur, then merge it into one prompt. Do NOT write "At 4 seconds" or "0:00–0:03" and do not set per-shot durations — official docs say precise timing is unstable and forcing it "may lead to abnormal generation results." Let the plot set the pacing.',
        critical: true,
      },
      {
        heading: 'Order inside each shot',
        example: 'camera move → action + expression → position change → audio',
        note: "ByteDance's recommended per-shot order. Lead with the camera (\"slowly push in from a wide shot\", \"fixed camera position\", \"cut to...\"), then what the subject does, then where they end up, then the sound.",
      },
      {
        heading: 'Lighting is a top quality lever',
        example: 'A cool-white diagonal beam from upper left, dust particles drifting through...',
        note: 'Lighting & color tone has its own slot in the official formula. Describe it before or alongside the subject.',
      },
    ],
    [
      {
        heading: 'Standard camera terms — including shot size',
        example: 'medium shot · close-up · wide shot · slow push-in · smooth lateral tracking · fixed shot',
        note: 'ByteDance: the model has a strong understanding of camera terminology, so use it directly — this is an open vocabulary, not a fixed list, and shot size counts as camera direction. Only ONE camera movement per shot: asking for push, pull, pan and move at once increases image instability.',
      },
      {
        heading: 'Slow, gentle, continuous movement',
        example: 'slowly raise a hand · quickly turn the head · walk slowly · sit down naturally with the motion',
        note: 'Official rule: name the body part and quantify range, speed and force — and prefer small continuous movement over sprints, big jumps and violent rolls. Slow-motion is supported in natural language; "fast" is a known quality-degrading word.',
      },
      {
        heading: 'Externalize emotion',
        example: '❌ she looks very sad\n✅ head lowering, shoulders trembling slightly, eyes reddening, fingers clutching the corner of her clothing',
        note: 'Replace abstract emotion words with the physical detail that shows them. This is the single highest-leverage habit in ByteDance\'s guide — the model renders bodies, not adjectives.',
      },
      {
        heading: 'Separate camera from subject motion',
        example: 'The earbud rises smoothly. The camera tracks upward.',
        note: 'Two different sentences. Mixing them ("the camera speed ramps as the earbud rises") is a common cause of shaky, glitchy output.',
      },
      {
        heading: 'Multi-character shots — forbid twins',
        example: 'Throughout the video, characters with completely identical appearance, clothing, and accessories are prohibited. Do not generate duplicate avatars or a twin effect.',
        note: 'With several characters in frame, Seedance can render the same person twice. ByteDance\'s fix: bind each character to its image ("Marcus (image 1)"), append that constraint verbatim at the end, and prefer single-person reference photos. Past 4 reference people, stability drops — compose a group still first.',
      },
    ],
  ],
  footer: [
    'Quality and constraint slots have their own official vocabulary: ask for "HD, rich details, cinematic texture, natural colors, soft lighting" — not "8K / masterpiece / trending on artstation." Seedance has no negative-prompt field, so constraints go inline: "keep it subtitle-free", "do not generate a logo", "do not generate a watermark".',
    'Style block at the end: one primary anchor plus 2-3 supporting details. End with "Single continuous take" if you want one shot with no cuts. Never write "no cut" or "seamless transition" — those aren\'t in the training vocabulary.',
    'Multi-modal: up to 9 images, 3 videos and 3 audio references. Cite them by type and index — "Zhang San@Image 1", or the "Marcus (image 1)" form Slates composes from your @mentions. Never cite an asset ID instead of the image number; the model can\'t associate the two. Max length: 4,000 characters.',
    'Don\'t cross-pollinate image-model syntax: named lenses, apertures and film stocks ("85mm f/1.4", "Kodak Portra 400") are a Nano Banana lever and a Seedance anti-pattern. Translate them into shot size, depth of field and colour tone instead.',
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
        example: 'Marcus (image 1) walks into the cafe...',
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
        heading: "Don't carry lens + stock into a video prompt",
        example: '85mm f/1.4, Portra 400\n→ close-up, shallow depth of field, warm natural colors, cinematic texture',
        note: 'Lenses, apertures, film stocks and camera bodies are an image-model lever and a video-model anti-pattern — ByteDance\'s Seedance guide never mentions f-stops, lens millimetres, fps or shutter angle. When you animate a frame you made here, translate the look into shot size, depth of field and colour tone instead of pasting the gear list across.',
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
        heading: 'Reference images — name them, never label roles',
        example: 'Marcus (image 1) sits across from the woman (image 2) in the cafe (image 3).',
        note: `Up to 14 refs (10 object + 4 character — caps don't trade). ${PARTIALS['reference-tips-short']}`,
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
