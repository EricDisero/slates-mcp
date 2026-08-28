// Per-model PROMPTING TIPS — the short, curated, FREE prompting guidance.
// SINGLE SOURCE OF TRUTH: this file. Nothing downstream authors tips copy (no
// hand-written tips JSX or prose anywhere — that's how the Omni Flash / Veo /
// Kling chimera modal shipped).
//
// WHERE IT RENDERS (changed 2026-08-10): exactly one place, the generated page
// https://slates.video/docs/prompting, emitted by slates-web
// scripts/build-llm-docs.mjs via scripts/llm-docs/extract-tips.ts. It used to
// render inside the desktop app's Settings modal — 92 cards, 12 families,
// two-up, in a 448px drawer. It is documentation, so it lives on the web; the
// app links to it. Do not add an in-app renderer back (slate/CLAUDE.md →
// Prompting-tips SSOT).
//
// A NEW ENTRY NEEDS A READING GROUP. extract-tips.ts owns the order the page
// lists families in; a key that appears in no group ships in this package and
// renders on no page. The generator warns, it does not fail — check the
// `npm run build:llm-docs` output.
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
  | 'seedance-2-5'
  | 'seedance-2-5-edit'
  | 'kling'
  | 'kling-edit'
  | 'veo'
  | 'omni-flash'
  | 'omni-flash-edit'
  | 'minimax-h3'
  | 'nano-banana'
  | 'nano-banana-lite'
  | 'seed-audio'
  | 'eleven-sfx'

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
        note: 'ByteDance: write a "Shot 1 / Shot 2 / Shot 3" storyboard in the order events occur, then merge it into one prompt. Do NOT write "At 4 seconds" or "0:00–0:03" and do not set per-shot durations — Seedance 2.0 does not respond to timestamps at all, and forcing them "may lead to abnormal generation results." Let the plot set the pacing. (Seedance 2.5 is the exception: it does read integer-second timestamps.)',
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
        heading: 'Images, clips and audio in ONE generation',
        example: 'Marcus (image 1) performs the motion from video 1, speaking the line in audio 1.',
        note: 'Attaching a clip does NOT mean "edit this clip". A video or audio attachment is a REFERENCE, numbered in the rail exactly like an image, and it sits alongside your images in the same generation — the composer cites them as "image N", "video N", "audio N", in rail order, and shows you the exact sentence before you press Generate. Reorder the tiles to change what those numbers mean. To actually rewrite a clip, use Edit with AI instead — that is a different, deliberate choice.',
        critical: true,
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
    'Multi-modal: up to 9 images, 3 videos and 3 audio references — 12 files in total, with the reference video capped at 15 seconds combined and the audio at 15. An audio reference on 2.0 needs at least one image or video alongside it (2.5 accepts audio on its own). Cite them by type and index — "Zhang San@Image 1", or the "Marcus (image 1)" form Slates composes from your @mentions. Never cite an asset ID instead of the image number; the model can\'t associate the two. Max length: 4,000 characters.',
    'A reference VIDEO changes the price: it bills input seconds PLUS output seconds, summed across every clip attached. Two 5-second references on an 8-second generation bills 18 seconds, not 8. The Generate button and the duration menu both show that total before you commit. Over the cap is refused rather than trimmed, precisely so you are never charged for a clip the model never saw.',
    'Don\'t cross-pollinate image-model syntax: named lenses, apertures and film stocks ("85mm f/1.4", "Kodak Portra 400") are a Nano Banana lever and a Seedance anti-pattern. Translate them into shot size, depth of field and colour tone instead.',
  ],
}

/** The 2.0 tip that 2.5 REVERSES — 2.0 ignores timestamps, 2.5 acts on them.
 *  Matched by heading so the 2.5 entry drops it rather than contradicting it. */
const SEEDANCE_NO_TIMESTAMPS_HEADING = 'Shot 1 / Shot 2 / Shot 3 — never time stamps'

const SEEDANCE_25: PromptingTipsEntry = {
  ...SEEDANCE,
  label: 'Seedance 2.5',
  intro: [
    'Seedance 2.5 is a SECOND SEAT next to 2.0, not an upgrade of it. It buys one 30-second take instead of 15, up to 30 image references (plus 10 video and 10 audio), audio-only references and integer-second timestamps — and it gives up 4K. It runs at 480p, 720p or 1080p, and it costs more than 2.0 at every tier they share, so pick 2.0 when you want the same resolution cheaper or you want 4K.',
    "ByteDance's official advanced formula has 8 slots: precise subject + action details + scene/environment + lighting & color tone + camera movement + visual style + image quality + constraints. Sweet spot 60-150 words for a single shot, longer for multi-shot.",
  ],
  columns: [
    [
      {
        heading: 'Do not write edit instructions here',
        example: '\u274c a wide shot of the workshop, remove the tripod\n\u2705 the workshop bench, clear and uncluttered',
        note: 'With references attached, "add", "insert", "remove", "delete", "modify", "replace", "change", "extend" and "continue" make Seedance 2.5 treat the request as a video EDIT, and it then fails on constraints it never set — after the job has queued. Describe the finished frame instead. To actually edit a clip, attach it and pick Seedance 2.5 Edit.',
        critical: true,
      },
      {
        heading: 'Timestamps work here — they do not on 2.0',
        example: '0-3 seconds: he steps off the curb, rain starting.\n3-7 seconds: headlights sweep across him; he turns.\n7-15 seconds: he runs; the camera falls behind.',
        note: PARTIALS['seedance-25-timestamps-short'],
        critical: true,
      },
      ...SEEDANCE.columns[0].filter((t) => t.heading !== SEEDANCE_NO_TIMESTAMPS_HEADING),
    ],
    [
      {
        heading: '720p is not the cheap one here',
        example: '30s \u00b7 720p \u00b7 Face route = 484 credits\n15s \u00b7 1080p \u00b7 Seedance 2.0 Face = 411 credits',
        note: 'Length is what moves the price, and 2.5 doubles the length ceiling — so a 30-second 720p clip can cost more than a 15-second 1080p one, against a 1,000-credit starting balance. Explore at short LENGTH rather than low resolution: cut the seconds to 4-8 while you are finding the shot, and stay at the resolution you actually want. A 480p pass does not de-risk a 720p render — generation is stochastic, so the 720p run is a different take, not the same shot rendered better. The Generate button always shows the exact number first.',
        critical: true,
      },
      {
        heading: 'Audio-only references',
        example: 'Reference the timbre in audio 1 to generate...',
        note: '2.5 accepts an audio reference on its own — a voice line, a music bed, a room tone — with no image or video alongside it. 2.0 could not. Audio references never cost extra on any Seedance route.',
      },
      ...SEEDANCE.columns[1],
    ],
  ],
  footer: [
'30 image references is a budget, not a target — 2-4 strong references still beat both extremes, one per role. ByteDance\'s own ceilings for 2.5: 1-8 subjects bound by image reference stay stable (9-12 works but needs re-rolls), 1-5 subjects bound by video or audio reference, and 5-10 seconds is the sweet spot for a reference clip. Unlike 2.0, a multi-view turnaround sheet can be a single subject reference here — past 5 subjects, go back to one view per image. The larger budget is for long multi-shot takes and for video plus audio references alongside images.',
    'A reference VIDEO bills input seconds PLUS output seconds, and 2.5 accepts references up to 30s combined — so a 20-second reference driving a 20-second output bills 40 seconds. The Generate button shows the total.',
    ...(SEEDANCE.footer ?? []).slice(0, 2),
    'Frames and reference images stay mutually exclusive, and on a first/last-frame generation Seedance 2.5 chooses the aspect ratio itself — the ratio control shows "Adaptive" because the start frame decides the shape.',
  ],
}

const SEEDANCE_25_EDIT: PromptingTipsEntry = {
  ...SEEDANCE_25,
  label: 'Seedance 2.5 Edit',
  intro: [
    'Seedance 2.5 Edit changes an existing clip: attach the clip, describe only what should be different, and the original motion, framing and timing are kept. It is the only editor in Slates that takes a clip longer than 15 seconds — 4 to 30s, against Kling O3 Edit\'s 3-15s and Omni Flash Edit\'s 3-10s.',
    'Output length and aspect ratio follow the SOURCE clip, so there is no duration or ratio control — the clip you attach is the quote. Output is 480p, 720p or 1080p with native audio.',
  ],
  columns: [
    [
      {
        heading: 'Name the change, keep the rest',
        example: 'Strictly edit the clip, and change the blue jacket from navy to red.',
        note: 'The clip already carries its composition, motion, timing and performance — re-describing them fights the model. Say the change as "from A to B" rather than as an outcome: naming what it currently is tells the model what to overwrite. One change per pass; chain passes for compound edits. Never write "reference the video" in an edit: that phrasing gets the request re-read as a fresh generation inspired by your clip instead of an edit of it.',
        critical: true,
      },
      {
        heading: 'Scope the edit in time',
        example: 'Change the man\'s action from drinking coffee to mopping the floor from 4-6 seconds, and leave the rest of the clip unchanged.',
        note: PARTIALS['seedance-25-timestamps-short'],
        critical: true,
      },
      {
        heading: 'Turn Face on when a face is visible',
        note: 'The default provider blocks character faces outright — this is not a price optimisation, it is whether the job runs at all. There is no consented-real-face route for editing; real-person footage the Face route rejects has to go to Kling O3 Edit.',
        critical: true,
      },
      {
        heading: 'An edit costs about double a generation',
        note: 'Every provider bills an edit on the input clip AND the output, so a 20-second edit is priced like 40 seconds of generation. Read the number on the Generate button rather than reasoning from the generation rate.',
      },
    ],
    [
      {
        heading: 'When to use it instead of the others',
        note: 'Length is the reason: it is the only engine that accepts a clip over 15 seconds. Inside the others\' range, choose on fidelity — Omni Flash Edit is the prompt-only fidelity winner and the cheapest seat, and Kling O3 Edit is the one that takes subject and style reference images.',
      },
      {
        heading: 'It edits the audio too',
        example: 'Only edit the man\'s dialogue: change it to "Don\'t come over here," in an American accent. Keep everything else unchanged.',
        note: 'The same engine rewrites what is heard while the picture stays put — change a line, change an accent, translate the dialogue and re-fit the lip movement, or strip and replace music and sound effects. Priced like any other edit, on the source clip\'s length.',
      },
      {
        heading: 'Prompt and clip only',
        note: 'No character or style reference images on this engine in Slates today. If the edit needs a reference image to lock an identity, that is Kling O3 Edit\'s job.',
      },
    ],
  ],
  footer: [
    'Trim before you edit, not after: the bill is the source clip\'s length rounded up, so a 30-second clip you only needed 8 seconds of costs nearly four times what it had to.',
    'Clips under 20 seconds edit most reliably. Up to 30 is accepted, and the returned clip can land within about a third of a second of the source length — only transition frames are compressed, nothing is cut.',
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

// ── Audio lane ──────────────────────────────────────────────────
// The two audio surfaces prompt NOTHING like the video models. The single
// most expensive mistake is bringing Kling's "SFX:" / "Ambient noise:" syntax
// to Seed Audio, which reads it as literal text. Every entry below leads with
// what the surface actually wants.

const SEED_AUDIO: PromptingTipsEntry = {
  label: 'Seed Audio 1.0',
  intro: [
    'Seed Audio builds a whole audio scene — dialogue, effects and ambience together — from one plain sentence. Write it the way you would describe the moment to a person standing next to you, not the way you would write a video prompt.',
    'It has no duration setting. Length comes from the words, so Slates appends your chosen duration to the prompt ("… 15 seconds") and bills exactly that. Set the duration control to what you actually want and let the sentence stay clean.',
  ],
  columns: [
    [
      {
        heading: 'One plain sentence',
        example: 'nature soundscape, wide open field cicadas and birds and a loon.',
        note: 'No shot language, no production jargon, no formatting. Plain description outperforms anything that reads like a spec sheet.',
      },
      {
        heading: 'Duration lives in the prompt',
        example: 'tiny applause of 2 or 3 people at an open mic. 15 seconds',
        note: 'The duration control writes this for you. Do not also type a different length into your sentence — the two will fight and you pay for the one you selected.',
        critical: true,
      },
      {
        heading: 'Say the crowd size',
        example: 'tiny applause of 2 or 3 people  ·  a packed arena roaring',
        note: '"Applause" alone returns a full room. Scale words are the single highest-leverage edit on any crowd, traffic or nature bed.',
      },
      {
        heading: 'Cut beds longer than the shot',
        note: 'Ask for a few seconds more than the clip needs so the edit has handles to fade in and out of. Beds that end exactly on the cut always sound clipped.',
      },
    ],
    [
      {
        heading: 'No Kling syntax here',
        example: '✗ SFX: heavy boots\n✓ heavy boots on wet pavement, a siren far off',
        note: 'The "SFX:" and "Ambient noise:" prefixes belong to Kling video prompts. Seed Audio treats them as words in the scene and the result gets worse.',
        critical: true,
      },
      {
        heading: 'Dialogue in quotes',
        example: 'a tired bartender says, "we closed twenty minutes ago", glasses clinking behind him',
        note: 'Speech goes in quotes inside the same sentence as the room. Pick a preset voice for a specific speaker, or leave it unset and let the scene cast itself.',
      },
      {
        heading: 'References',
        example: 'match the room tone of @Audio1',
        note: 'Up to 3 audio clips (max 30s each), referenced as @Audio1–@Audio3 — OR one image to score what is in frame. Never both in the same generation.',
      },
      {
        heading: 'Know its seat',
        note: 'Scenes, beds, room tone and dialogue in one pass. For a single effect that has to land on a specific frame, use Sound Effects.',
      },
    ],
  ],
}

const ELEVEN_SFX: PromptingTipsEntry = {
  label: 'ElevenLabs Sound Effects',
  intro: [
    'Sound Effects makes one short sound with an exact length — the lane for a hit that has to land on a specific frame, or a seamless loop you can lay under a whole scene.',
    'Duration is always sent explicitly (0.5–22s). Billing is per second, so the length you pick is the price you pay.',
  ],
  columns: [
    [
      {
        heading: 'Describe the cause, not the label',
        example: '✗ door sound\n✓ heavy oak door slams shut in a stone hallway',
        note: 'Material, weight and room are what separate a usable effect from a stock-library shrug. Name all three.',
        critical: true,
      },
      {
        heading: 'One sound per generation',
        note: 'This surface makes a single event. A door, then footsteps, then a siren is three generations layered on the timeline — or one Seed Audio scene.',
      },
      {
        heading: 'Duration is the edit',
        example: '0.8s for an impact · 4s for a whoosh · 22s for a bed',
        note: 'Ask for roughly the length you need. A 4-second request for a door slam pads the tail with room tone you then have to trim.',
      },
    ],
    [
      {
        heading: 'Loops',
        example: 'steady rain on a canvas tent  (loop on, 12s)',
        note: 'Turn loop on for anything continuous — rain, engine hum, crowd murmur — and it will tile without a seam.',
      },
      {
        heading: 'Prompt influence',
        example: '0.3 default · 0.7 literal',
        note: 'Higher hugs your wording with less variation between takes; lower explores. Raise it when a re-roll keeps wandering off the brief.',
      },
      {
        heading: 'Know its seat',
        note: 'One precise effect on a known frame. Full rooms and layered scenes are cheaper and better in one Seed Audio pass.',
      },
    ],
  ],
}

const MINIMAX_H3: PromptingTipsEntry = {
  label: 'MiniMax H3',
  intro: [
    'MiniMax H3 generates picture and sound in one pass — 24fps, 32kHz stereo, 5-15 seconds, 11 stably-supported languages. It is the only video model in Slates where audio is AUTHORED rather than switched on: synchronised dialogue and action sounds go in the body of the prompt, ambience goes in a soundscape section, and audience-only music goes in a score section. Put a sound in the wrong section and it is dropped, doubled, or attributed to the wrong source.',
    'Two seats. Base H3 runs 480p / 768p / 2K / 4K and reads up to 9 reference images plus 3 video and 3 audio clips. H3 Max is fal\'s faster post-train: 768p ceiling, and dearer than base H3 at 768p — a deliberate speed pick, never the cheap one. It still animates a start frame and an end frame; what it does not have is the reference set (the extra identity, style, environment, video and audio references), which is base-H3 only. 768p is the default on both because it is the tier the model natively generates; 2K and 4K are upscales of a 768p base.',
  ],
  columns: [
    [
      {
        heading: 'Three audio layers, three places',
        example: 'body: "First batch of the morning."\nSoundscape: shutters scrape, trays clink\nScore: solo piano, slow, no swell',
        note: 'Dialogue, singing and diegetic music (a radio in the scene) go in the BODY on the beat they land. Ambience goes in the soundscape. The score is audience-only — name instruments and tempo, not moods.',
        critical: true,
      },
      {
        heading: 'Shots and cut times',
        example: '[Shot 2] At 00:03.500, the camera cuts to...',
        note: 'The first shot carries no timestamp; later shots open with the bracket and a rising cut time inside the clip length. Transition verbs: cuts to / transitions to / changes to / switches to.',
      },
      {
        heading: 'Write the camera into the sentence',
        example: 'The camera pushes in with small amplitude at slow speed toward the letter in her hands.',
        note: 'Named moves (push in, pull out, arc, tracking, POV, roll) with amplitude and speed modifiers. Never stack them as labels.',
      },
      {
        heading: 'Voiceover needs both halves',
        example: 'says in an off-screen voiceover: "..." — his lips remain completely closed.',
        note: 'The off-screen phrase alone still animates a mouth. State the closed lips explicitly.',
      },
    ],
    [
      {
        heading: 'Cite references by number',
        example: 'Marcus (image 1) walks into the workshop (image 2)...',
        note: `H3 takes references as typed slots and expects plain numbered prose — image 1, video 1, audio 1. Do not hand-write angle-bracket tags. ${PARTIALS['reference-tips-short']}`,
      },
      {
        heading: 'Say how much of a reference survives',
        example: 'Give the man in image 3 the weathered leather texture of the jacket in image 4.',
        note: 'H3 is the only seat that understands transferring a characteristic onto a DIFFERENT subject. State each reference\'s job and how much of it should carry through — kept whole, kept in part, transferred, or a loose echo.',
      },
      {
        heading: 'Reference images past the fifth cost extra',
        note: 'The first 5 are free; each one after that adds 4 credits at every resolution and length, and the model takes 9. Four extra images on a 10s 768p clip add 16 credits to a 30-credit generation. Attach what the shot needs, not the ceiling.',
        critical: true,
      },
      {
        heading: '2K and 4K are upscales, not bigger renders',
        note: 'Only 480p and 768p are generated natively; 2K and 4K enlarge a finished 768p take. In our own testing the 2K pass showed MORE artifacting than the 768p original while costing 33 credits for a 5-second take against 15. Generate and judge at 768p; step up only when a delivery spec demands the pixels.',
        critical: true,
      },
      {
        heading: 'Frames or references, never both',
        note: 'A start and/or end frame runs on a different endpoint from references — the reference endpoint has no frame slots. Slates refuses the combination rather than dropping one side. An audio reference also cannot travel alone: pair it with an image or video.',
      },
    ],
  ],
  footer: [
    'Slates disables the provider\'s prompt expander, so what you write is what the model reads — nothing will pad a thin prompt. Aim for a 350-500 word body on a reference-carrying shot, and let dialogue-heavy scenes run longer if that is what fits the spoken timeline.',
  ],
}

export const PROMPTING_TIPS: Record<PromptingTipsKey, PromptingTipsEntry> = {
  seedance: SEEDANCE,
  'seedance-2-5': SEEDANCE_25,
  'seedance-2-5-edit': SEEDANCE_25_EDIT,
  kling: KLING,
  'kling-edit': KLING_EDIT,
  veo: VEO,
  'omni-flash': OMNI_FLASH,
  'omni-flash-edit': OMNI_FLASH_EDIT,
  'minimax-h3': MINIMAX_H3,
  'nano-banana': NANO_BANANA,
  'nano-banana-lite': NANO_BANANA_LITE,
  'seed-audio': SEED_AUDIO,
  'eleven-sfx': ELEVEN_SFX,
}

/** Null when no tips exist for the key — callers render an honest fallback. */
export function getPromptingTips(key: string): PromptingTipsEntry | null {
  return (PROMPTING_TIPS as Record<string, PromptingTipsEntry>)[key] ?? null
}
