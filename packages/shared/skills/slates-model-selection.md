---
name: slates-model-selection
description: "Choose image, video, edit and audio models for the brief, including animating photos, making films or directing voices. Load before choosing or defaulting a model or quoting a plan; retrieve model-specific craft after selection."
---

# Model selection for the intended piece

Choose from the current catalogue using the brief, existing media and delivery requirements. The agent makes this production choice; the user supplies the vision, explicit preferences and approval. A named model takes priority when it can do the requested job. If it cannot, explain the specific conflict and choose a supported route within the brief.

## Decide from constraints and evidence

Name the primary must-preserve requirement and any other hard constraints: this face stays this face, the fluid behaves like fluid, text remains legible, the voice is specific, or the take remains unbroken. Budget and delivery format can be binding requirements rather than afterthoughts.

Choose a seat whose capability and observed craft fit those requirements. Inspect at the intended delivery crop: atmosphere, material texture and anchor objects for a location; identity, skin, pose and gradients for a character. A thumbnail is insufficient evidence for a large final frame. When the roster changes, repeat relevant comparisons rather than inheriting reputation.

The catalogue below is generated from the same model facts used by the tools. Current allowed settings and reference inputs come from the tool schemas and `slates_list_available_models`; current prices come from `slates_estimate_generation_cost`. Retrieve the selected model's craft card, then only the sections needed for the shot. Historical measurements below explain a choice; they are not current price quotes or permanent rankings.

## Current catalogue

<!-- @inject:model-routing -->
**Current model routing, generated from the operation routing source:**

### image generate

Nano Banana 2 (Gemini 3.1 Flash Image): The all-rounder and the only image seat with a headless path: holds many subjects coherently in one frame, and the start-frame for legible in-scene text. Knowledge cutoff Jan 2025: anything later needs reference images.
Nano Banana 2 Lite: FAST/DRAFT image tier — markedly cheaper and faster than NB2 full, at draft quality. Route here for iteration volume, then re-run the winner on NB2 full. Same Gemini content filter as NB2.
Nano Banana Pro: HERO-FRAME / typography PREMIUM image tier. NB2 is about 95% of Pro — escalate only when spatial composition, cinematic lighting/skin, fine typography-in-scene or deep multi-element reasoning must be perfect, and say why.
GPT Image 2.5 Flare: THE FAST GPT IMAGE SEAT — OpenAI's small model, optimized for SPEED, quality COMPARABLE to GPT Image 2 (not better) at roughly half the latency. Route here when speed matters: drafts, exploration, volume. TEXT / DIAGRAM / PANEL work — character sheets, shot grids, text-bearing panels. When quality outranks speed, escalate to Sunburst. Own content filter, distinct from Gemini's. Killed by a head-to-head at the intended crop going the other way.
GPT Image 2.5 Sunburst: THE QUALITY GPT IMAGE SEAT — OpenAI's most capable image model, higher quality than GPT Image 2, same price as Flare, deliberately SLOWER. Route here unless speed is the point: finals, hero frames, photoreal people, and multi-reference edits where every reference must survive into one frame — its widest lead. Explore on Flare, finish on Sunburst.
FLUX.2 Max: Photoreal image seat, less censored than the Gemini rails. Auto-routes to its edit endpoint when references are present.
Seedream 5 Lite: Cheapest flat-priced image seat (GPT Image 2.5 at low quality costs less per image). Less censored. Routes to its edit endpoint when references are present.

### video generate

Seedance 2.0: THE 4K AND VALUE SEAT beside the 2.5 default — the only Seedance with native 4K (Pro-gated; base accounts get PRO_REQUIRED) and cheaper than 2.5 at every resolution they share, with the same physics, effects and scale strengths; shorter takes, fewer references, no timestamps. VIDEO-ONLY. A bare "seedance" still resolves here for older CLIs that expect 4K.
Seedance 2.5: DEFAULT VIDEO MODEL — the strongest seat for physics, effects, scale and hero shots, and the only Seedance that takes long single takes, many references, audio-only references and integer-second timestamps. No 4K, and dearer than 2.0 at every shared resolution: go to 2.0 for 4K or the same resolution cheaper. LENGTH is the price dial — quote long takes first. VIDEO-ONLY. Timestamp grammar and the edit/extend words that make the provider reclassify and fail a generation are in slates-prompting-seedance-2-5.
Kling 3.0: THE COST-EFFECTIVE SEAT — strong start-frame adherence (identity, layout, text), acting, dialogue and lip-sync; pick it when the budget matters and the shot is a performance or a start-frame animation. Kling is also the ONLY engine behind the Motion Transfer and Lip Sync tools.
Gemini Omni Flash: 720p seat with native synced audio included. Route here for drafts with sound in one pass and reference-to-video character-consistency trials; LTX, H3 and H3 Max Turbo cost less per second. VIDEO-ONLY. Quality against Kling/Seedance is unproven — do not route hero shots here.
MiniMax H3: THE AUTHORED-AUDIO SEAT — reach for H3 when the sound is part of the shot rather than a switch on it: synchronised dialogue, scene sound and an audience-only score directed as three separate layers in ONE pass, across eleven languages. Kling and Seedance treat audio as on/off. Only H3 also carries a DECLARED REFERENCE RELATIONSHIP (kept whole, partly kept, transferred, or a loose echo). VIDEO-ONLY. Its top two resolution tiers are UPSCALES of the native render, not larger generations — judge at native and upscale in post. Reference images past the fifth are a PAID key dimension: pass referenceImages when quoting.
MiniMax H3 Max: THE SPEED SEAT, dearer than base H3 at 768p and equal at 480p — never the cheap H3 and never the default. fal's post-train of the H3 weights: MEASURED 2026-08-27 at about 12x faster than base H3 on the same prompt and params, queue to finished file, plus a thin vendor-reported quality edge. It tops out at a 1080p refinement of its 768p render. It takes the same omni-reference set as base H3 and animates start and end frames — but not both in one call, the same as base H3: frames and references go to different endpoints. Never describe this row as taking no image or reference input. Route here when a fast turnaround on text-to-video or a start-frame shot is worth the premium.
MiniMax H3 Max Turbo: THE BUDGET SEAT of the MiniMax family: a second fal post-train of the H3 weights, billed at half H3 Max's rate at every tier. Its 1080p is a refinement of the native 768p render, not a native 1080p generation. INPUTS ARE FRAMES, NOT REFERENCES: text-to-video and start/end frames only, with no reference endpoint, so reference-driven consistency goes to H3 Max or base H3. Route here for drafts, volume and cheap coverage, then re-run the keeper on H3 Max or a hero seat.
LTX-2.5: THE VOLUME SEAT — the cheapest 1080p second with sound included, and the row for MANY takes rather than one hero shot. Native synced audio is included free at every tier, unlike Kling where sound is a paid key dimension. It supports native high-resolution output and longer takes than most seats; use the capability surface for its resolution-dependent duration limits. VIDEO-ONLY. INPUTS ARE FRAMES, NOT REFERENCES: start frame plus an optional end frame, and no reference endpoint at all — for character consistency across shots use H3 or Kling. Route here for batch coverage, long takes, and anything where the credit budget is the binding constraint.
LTX-2.5 Pro: THE FIDELITY SEAT of the LTX pair — the full diffusion build against the base row's distilled one. 🚨 IT IS NOT A SUPERSET OF THE BASE ROW, which is the opposite of every other Pro seat here: it reaches a SHORTER resolution ladder and makes SHORTER clips, and it costs more at both tiers they share. Reaching for it because the name says Pro costs more AND takes away reach. Everything else matches the base row. Route here only when a specific shot needs the fidelity and fits inside its narrower envelope.

### video edit

Seedance 2.5 Edit: VIDEO-TO-VIDEO EDIT via slates_edit_video, and the only edit engine that takes a clip longer than the other two reach — that length is the whole reason to route here. Inside their range, compare on fidelity instead: Omni Flash edit won the prompt-only head-to-head, and Kling edit is the one that takes reference images. Edits audio on the same row (re-voice, re-accent, translate with re-fitted lips, replace BGM). Costs about 1.2x a plain 2.5 generation of the same length: an edit bills at twice the reduced video-reference rate.
Kling O3 Video Edit: VIDEO-TO-VIDEO EDIT, the REF-DRIVEN one: it is the only edit seat that takes element/style reference images to lock subject identity, and its keepAudio preserves the original audio verbatim. Route here when an edit NEEDS reference images or bit-exact audio; for prompt-only footage-synced VFX, omni-flash-edit won the fidelity head-to-head. One instruction beat per pass — multi-beat prompts get under-executed.
Omni Flash Edit: VIDEO-TO-VIDEO EDIT, prompt-only — THE EDIT-FIDELITY WINNER (head-to-head vs Kling edit on real talking footage: lips held, audio near-identical, both action beats landed), priced level with Kling O3 Edit Standard. Footage-synced prop, effect, environment and lighting swaps. Takes NO reference images — identity swaps needing refs go to Kling edit. Fidelity is EARNED by prompt discipline; the exact form is in slates-prompting-omni-flash.

### audio generate

Seed Audio 1.0: DEFAULT audio model — the one-pass SCENE workhorse: dialogue, SFX and ambience together from ONE plain sentence. Route here for continuity beds, room tone, crowd and nature soundscapes, and quick scratch VO. AUDIO-ONLY. Takes one image XOR up to three audio clips as references, never both. Prompt form and the length rule are in slates-prompting-seed-audio.
ElevenLabs Sound Effects v2: ONE-SHOT SOUND EFFECT with an EXACT duration — route here for a single hit that must land on a frame (door slam, whoosh, impact, UI blip) or for a seamless loop. AUDIO-ONLY. For layered scenes with dialogue or room tone, seed-audio does it in one pass instead.
Inworld Realtime TTS-2: THE VOICE SEAT — one named voice saying one line, billed per CHARACTER not per second. Route here when WHO is speaking matters. NOT scene audio — that is seed-audio; a single effect is eleven-sfx.
<!-- @end:model-routing -->

## Seedance craft triggers

Slates field experience identifies these useful beats:

- Real-time to slow-motion contrast.
- A moving camera while debris, meteors, sparks or particles move around the subject.
- Massive scale whose size is the point of the shot.
- A continuous unbroken take.

These concrete cues are more useful than an abstract label such as “physics.” Compare them with the user's budget, sound, reference and delivery constraints. They suggest a candidate; they do not override an explicitly chosen model or establish that every other seat fails.

## Dated production comparisons

| Receipt | What was observed | How to use it |
|---|---|---|
| MiniMax turnaround, 2026-08-27 | Same prompt and parameters: a five-second 768p H3 Max clip reached the finished file in 4.8 seconds, against 57 seconds on base H3, about twelve times faster. | Evidence for a turnaround requirement. The then-observed rates were $0.080/s on Max against $0.060/s on base, a premium rather than a saving. Re-quote current settings; queue conditions and provider revisions can change the result. |
| Prompt-only footage VFX, 2026-07-09 | Omni Flash Edit preserved lip movement, returned near-identical audio and landed both action beats; Kling missed a beat and drifted the lips. Omni sometimes doubled a final speech beat or jittered at the tail. | Use the short change-only prompt demonstrated in `slates-prompting-omni-flash`; trim a defective tail where that solves it. This comparison does not prove exact audio preservation. |
| Style-heavy relocation, 2026-07-09 | Seedance video-reference regeneration lost to Omni Flash Edit on the tested photoreal insert at 720p, while costing about three times as much in that comparison. | Transfer intensity and reconstruction are different jobs from surgical edits. Choose for the required change and current endpoint, not the historical label “premium.” The video-reference lane regenerates, bills input plus output seconds (at face-lane rates when people are in frame) and takes long descriptive prompts without Omni's hard-fail on timing phrasing; 2.5's lane reached 1080p on 2026-08-24. Route there for transfer intensity or a higher resolution ceiling, never as the cheap default. |
| Photoreal skin, 2026-08-24 | One comparison favoured GPT Image 2 at its then-high tier. | This is evidence about that old model, crop and comparison. It does not establish the quality tier either GPT Image 2.5 variant needs. Raise quality to address an observed shortfall. |

## Existing footage and edit fidelity

Read the current video-edit catalogue before choosing an engine. Reference-driven identity changes, exact original audio, clip length and output size are distinct constraints; an engine that handles one may not handle the others. Use `slates_edit_video` for an edit endpoint, and the selected guide for its request syntax.

When a clip is mostly right, compare an edit with a new generation before gambling away the useful parts. Every video edit engine can re-synthesise the whole clip: “change only this” describes the intention, not a pixel-level guarantee. For a critical deliverable, consider segment-splicing: edit the affected seconds, retain the original outside the change, and preserve the original audio underneath when needed. Phone footage must be rotation-normalised because players can honour a rotation flag that a model ignores.

The July comparison found Kling's original audio track retained verbatim with `keepAudio`, while regenerated lips could drift against it. Near-identical Omni audio was an observation, not a guarantee. For exact legal copy, narration or music, retain the original track and inspect the assembled playback.

Omni Flash Edit needs a short change instruction plus “Keep everything else the same”; long identity-lock preambles worsened fidelity in that receipt. Kling multi-beat edits can drop an instruction, so a focused pass can be useful. Video edits can form a lineage of passes when that serves the work; this is distinct from the image master-edit rule in `slates-edit-and-iterate`. Every additional pass still needs the existing generation consent.

## Motion transfer and lip sync

`slates_generate_motion_transfer` and `slates_generate_lip_sync` expose dedicated Kling endpoints. The former retargets a driving clip onto a character image; the latter re-voices a clip or animates a portrait. Consult their schemas and guides for the current input and output limits, tiers and cost.

A Seedance alternative is a normal `slates_generate_video` call with a video reference and explicit motion or dialogue direction, for example “the character from image 1 performs the exact motion from video 1.” This preserves an editable prompt and conditions the generation in one pass. Field experience favours it for fast choreography, contact, cloth and hair where post-hoc retargeting loses fidelity; compare for the specific performance rather than promising a universal win.

Video-reference calls bill from both input and output duration. Pass the actual reference durations when quoting; do not assume the output length is the whole charge. Face flags and any consented real-face route follow the selected endpoint's requirements and returned gate. A provider's face rejection is not permission for a more expensive retry.

## Image and style production

Image, video and audio are separate output lanes. A hero reference still is an image request, even when its final destination is video. Use the current image default for ordinary work and choose another seat when speed, supported shape, reference fidelity or an observed shortfall supplies a reason.

<!-- @inject:image-defaults -->
**Image default:** gpt-image-2-5-sunburst, quality `high`, 3k. User overrides take priority. Without a project, generation uses the headless Nano Banana 2 seat.

| Model | Default resolution |
|---|---|
| nano-banana-2 | 2k |
| nano-banana-2-lite | 1k |
| nano-banana-pro | 2k |
| gpt-image-2-5-flare | 2k |
| gpt-image-2-5-sunburst | 3k |
| flux-2-max | 1k |
| seedream-5-lite | 2k |
<!-- @end:image-defaults -->

A styled start frame is useful when composition, exact in-scene text or an approved look must hold. It is optional for a video brief; direct text-to-video, imported footage and reference-video direction are other valid entries. `slates-style-prompting` supplies model-specific style craft after the route is chosen.

## Sound as a production choice

Determine whether sound must generate with the picture, or become a separate editable asset. Native video sound can lock to visible action; a separate voice, effect or ambience bed can be moved, trimmed and reused on the timeline. The generated catalogue owns which models support each job.

- “It needs to sound like a place” calls for a scene, not automatically several separately billed effects. Seed Audio can render dialogue, effects and room tone together from a plain sentence.
- “Read this line” needs a voice decision: Inworld TTS-2 for a specified voice or clean narration; Seed Audio when the line belongs inside a scene. Measure and listen to the take before lip sync.
- “That needs a thump right there” calls for a physical cause, the event's length and an exact placement in the cut. A dedicated effect can serve that job.
- “Give it a track” requires an imported song: there is no standalone music-generation model in Slates. Video models' scene scores are a different capability.

Seed Audio has no model duration parameter: Slates writes the requested length into the prompt and bills the requested duration. Never add a conflicting second duration to the sentence. Kling video labels such as `SFX:` and `Ambient noise:` do not transfer to Seed Audio; describe the sound directly. For fade handles, request extra bed length only when useful and include it in the quote.

Use `slates-prompting-seed-audio`, `slates-prompting-inworld-tts` and `slates-prompting-elevenlabs` for their distinct sound and voice grammar. Return to the selected video guide for sound generated with video.

## Spend and delivery

Route by the requirements, then compare quotes for settings that satisfy them. A cheaper unusable render costs more after correction, but a binding budget is itself part of the brief. Do not launch paid head-to-head comparisons merely because a table could be fresher. Follow `slates-cost-discipline` and the current generation authorization for the exact requested set.
