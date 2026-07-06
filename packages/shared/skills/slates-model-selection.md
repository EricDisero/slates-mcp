---
name: slates-model-selection
description: Which model to pick for a given job — the routing doctrine. Read BEFORE choosing any video or image model, before quoting a plan, and before defaulting anywhere. Kling 3.0 is the general-purpose video default; Seedance 2.0 is the premium tier for anything where physics, effects, or scale remotely matter; Veo 3.1 is a narrow niche (native synced audio in one gen, 16:9 only) and never the default.
---

# Model selection — the routing doctrine

Pick the model FIRST, deliberately, before writing a prompt or quoting a plan. Model routing is a core part of the intelligence users are paying for: the agent knows what each model is good at and which ones underperform for a job — defaulting to the wrong model burns the user's credits on a weaker result.

## Video routing

| Job | Model | Why |
|---|---|---|
| **General-purpose — the default for most shots** | **Kling 3.0 std** | Cost-effective workhorse. Strong image-to-video: preserves identity, layout, and text from the start frame. Any aspect ratio, 5–15s. |
| Higher visual polish, no physics demands | Kling 3.0 pro | Mid-price fidelity bump on the same strengths. |
| Multi-character dialogue / audio co-generation | Kling 3.0 omni | Dialogue syntax, voice direction, language codes, `@element` refs. |
| **Anything with remotely important physics** — effects, destruction, water/fire/smoke/cloth, creature motion, scale, complex simultaneous action | **Seedance 2.0** | The premium tier. Physics and effects are its whole edge; up to 9 ingredient refs, first+last frame, native 4K. |
| The premium hero shot a piece hangs on | Seedance 2.0 | Spend where it shows. |
| Native synchronized audio (dialogue + SFX generated WITH the video in one gen), 16:9, ≤8s | Veo 3.1 | The only job Veo wins. |

## Video EDIT routing (changing an existing clip)

| Job | Tool | Why |
|---|---|---|
| **Fix a 90%-right clip** — wrong shirt, one artifact, swap the subject, change the environment | **Kling O3 Edit** (`slates_edit_video`) | The default edit tool. Element lock (frontal + angles) holds identity; original motion, camera, and AUDIO preserved. One pass, no masking, ~19¢/s. |
| Style-transfer-heavy re-imagining, full relocate of the scene | Seedance edit/relocate (`videoReferenceAssetId` on `slates_generate_video`) | Seedance's strength is transfer intensity; it re-generates rather than surgically edits. |
| AI-edit the user's OWN footage (3–15s clips) | Kling O3 Edit | Takes any MP4/MOV 3–15s, 720–3840px — not just Slates gens. |

- **Edit before re-roll.** A re-roll gambles away the parts the user already likes; an edit changes only what the prompt names. Quote the edit first when a clip is mostly right.
- Edited clips are themselves editable ≤15s clips — chain passes; lineage links each output to its parent.

## Motion Transfer & Lip Sync routing (two engines per tool)

Both tools have a cheap Kling utility lane and a premium Seedance lane. The capability is the same; the execution model differs: Kling bolts motion/lip onto the source as a dedicated post-process; Seedance generates in a single pass with the driving clip / dialogue as native conditioning signals — better motion fidelity, natural speech delivery, audio included.

| Job | Engine | Why |
|---|---|---|
| Quick motion retarget, budget lane, or driving clip >15s | Kling MC std/pro (`slates_generate_motion_transfer`) | Structured skeleton/depth retarget, $0.95–1.26 / 5s, takes up to 30s driving clips. |
| **Motion transfer where fidelity or audio matters** — dance, choreography, cinematic action | **Seedance 2.0** (`motionModel=seedance-2`) | Single-pass conditioning beats post-hoc retargeting; prompt-driven; native audio. Driving clip 2–15s; bills input+output seconds (vref keys). |
| Cheap lip-sync utility (re-voice a clip, simple avatar) | Kling lip-sync / avatar (`slates_generate_lip_sync`) | $0.11–0.86 / 5s blocks. |
| **Natural speech, voice cloned from the source clip, premium delivery** | **Seedance 2.0** (`engine=seedance-2`) | The line is spoken IN the generation (no TTS layer); a video source keeps its own voice; uploaded ≤15s audio can drive it. |

- Faces: Seedance tool gens default `seedanceFace=true` (sources are people). A REAL person triggers the consent cascade (`[REAL_FACE_DETECTED]` → `seedanceRealFace` + `realFaceConsent`, premium realface pricing).
- Billing: any Seedance gen with a video reference bills COMBINED input+output seconds (`seedance-2*-vref-*` keys) — always pass the clip duration and quote before confirming.

**Rules:**

- **Default video = Kling 3.0 std.** Escalate to Seedance the moment the shot has physics/effects weight or is the hero moment — and say why in the plan ("physics-heavy, routing to Seedance").
- **Veo is never the default.** 16:9 only, 4/6/8s only, and it is not the quality pick — treat it as a single-purpose tool for native-synced-audio shots. If audio can be added after (Kling lip-sync, edit stage), prefer Kling or Seedance + audio in post.
- **9:16 vertical → Kling or Seedance.** Veo can't.
- **Image-to-video from an NB2 start frame** (the standard pipeline) → Kling by default, Seedance when the motion is physics-heavy. Not Veo.
- **User names a model explicitly → use it.** But if it's a mismatch for the job (crazy physics on Kling std, vertical on Veo), say so in one line and offer the right route before generating.

## Image routing

**Video models (Kling, Seedance, Veo) cannot generate standalone images — ever.** A "premium hero reference image" is still an image job: it routes to an image model below, never to Seedance.

- **Default: Nano Banana 2** — best reference handling (14 refs), best legible text, the standard start-frame generator.
- **NB2 Lite** — the fast/draft seat: ~half NB2's price, ~2.7× faster, 1K only. Route iteration volume and drafts here; finals go back to NB2 full (2K/4K).
- **Nano Banana Pro** — the hero-frame/typography ceiling (~2× NB2). NB2 ≈ 95% of Pro; escalate only when spatial composition, cinematic lighting/skin, fine typography-in-scene, or deep multi-element frames must be perfect. Up to 14 refs — feed it a full subject library.
- **GPT Image 2** — readable text / panels / UI king: character sheets, shot grids, diagrams, text-bearing panels. Medium quality is the default (half NB2's price at 1080p); high (~4×) only when text precision is the whole job. 4K at both tiers is API-only — even paid ChatGPT can't render it.
- **FLUX.2 Max** — photoreal texture, hex-color binding, typography, less censored.
- **Seedream 5 Lite** — uncensored + any-resolution flat price; volume exploration when the Gemini filter is in the way.

**Split rule of thumb:** readable text / panels / UI → GPT Image 2; photoreal, character-locked, widescreen, or edit-heavy → the Banana line; drafts → NB2 Lite; uncensored or odd resolutions → Seedream/FLUX.

## Cost is a tiebreaker, not the router

Route by capability first, then pick the cheapest tier that serves the job (per `slates-cost-discipline`). Never pick a model because its per-second price looked lowest — a cheap clip that has to be regenerated on the right model costs more than routing correctly once.
