---
name: slates-model-selection
description: Which model to pick for a given job — the routing doctrine. Read BEFORE choosing any video or image model, before quoting a plan, and before defaulting anywhere. Kling 3.0 is the general-purpose video default; Seedance 2.0 is the premium tier for anything where physics, effects, or scale remotely matter; Veo 3.1 is a narrow niche (native synced audio in one gen, 16:9 only) and never the default.
---

# Model selection — the routing doctrine

Pick the model FIRST, deliberately, before writing a prompt or quoting a plan. Model routing is a core part of the intelligence users are paying for: the agent knows what each model is good at and which ones underperform for a job — defaulting to the wrong model burns the user's credits on a weaker result.

## 🔑 The meta-rule — above the table

The tables below are a snapshot. This roster churns constantly (NB2 Lite, Omni Flash, Seedream 5 Lite, GPT Image 2 all landed recently) — **a table rots; a rule doesn't.** When the tables and this rule disagree, or when a model appears that the tables don't cover, run the rule:

> **Name ONE must-preserve requirement for the shot.** Not a vibe — the single thing that, if it breaks, makes the shot unusable: this face stays this face · the fluid behaves like fluid · the text stays legible · the take stays one unbroken move.
>
> **Inspect the output at its intended crop.** A frame that holds up as a thumbnail can fall apart at the size it will actually be watched. For a location, look at atmosphere, material texture, and anchor objects; for a character, identity, skin, pose, and gradients.
>
> **Choose the model that PROVES that requirement** and leaves only failures you can afford to rerun or mask.
>
> **When the roster changes, repeat the evidence test.** Do not carry today's ranking forward on reputation.

## Video routing

| Job | Model | Why |
|---|---|---|
| **General-purpose — the default for most shots** | **Kling 3.0 std** | Cost-effective workhorse. Strong image-to-video: preserves identity, layout, and text from the start frame. Any aspect ratio, 5–15s. |
| Higher visual polish, no physics demands | Kling 3.0 pro | Mid-price fidelity bump on the same strengths. |
| Multi-character dialogue / audio co-generation | Kling 3.0 omni | Dialogue syntax, voice direction, language codes, `@element` refs. |
| **Anything with remotely important physics** — effects, destruction, water/fire/smoke/cloth, creature motion, scale, complex simultaneous action | **Seedance 2.0** | The premium tier. Physics and effects are its whole edge; up to 9 ingredient refs, first+last frame, native 4K (4K video is Pro-only). |
| The premium hero shot a piece hangs on | Seedance 2.0 | Spend where it shows. |

### Named Seedance escalation triggers

"Physics matter" is an abstract category and it under-fires. These are the beats Seedance is **observably** good at — if the shot contains one, escalate without deliberating:

- **Real-time → slow-motion contrast.** The signature beat; nearly every strong clip rides it.
- **The camera moving while debris, meteors, sparks or particles crash around the subject.** Distinctly a feature of this model, not just a thing it survives.
- **Massive scale that has to read as genuinely huge** — not "a big thing", a thing whose size is the point of the shot.
- **One continuous unbroken take.**

Concrete beats route better than an abstract category. Cost stays a tiebreaker, never the router (see below).
| Native synchronized audio (dialogue + SFX generated WITH the video in one gen), 16:9, ≤8s | Veo 3.1 | The only job Veo wins. |

## Video EDIT routing (changing an existing clip)

| Job | Tool | Why |
|---|---|---|
| **Footage-synced VFX on real footage** — add/remove an effect, prop, or lighting change while the take stays the take (incl. talking heads) | **Omni Flash Edit** (`slates_edit_video`, `omni-flash-edit`) | **The edit-fidelity winner** (head-to-head receipt 2026-07-09, WITH a short prompt): lip movement held perfectly, audio near-identical, effect landed and released on cue — where Kling missed an action beat and drifted lips. Prompt-only, 3–10s clips, 720p out, ~6.4 cr/s (cheapest). Quirk: occasional tail jitter / doubled final speech beat — trim the tail on the timeline. Fidelity is EARNED by prompt discipline: one short line + "Keep everything else the same"; long prompts destroy it (see below). |
| **Identity swap needing reference images** — put @marcus into the clip, lock a style from refs | **Kling O3 Edit** (`slates_edit_video`) | The only edit engine that takes element/style reference images (frontal + angles lock identity). ~19¢/s. |
| **Spoken words must be bit-exact** (VO, legal copy, music) | **Kling O3 Edit** with `keepAudio` (default true) — or segment-splice | Kling keeps the ORIGINAL audio track verbatim — but re-synthesizes the video, so lips can drift slightly against it (7/09 receipt). Omni Flash regenerates audio (voice editing unsupported): on the 7/09 receipt it came back near-identical with perfect lips, but "near-identical" is not a guarantee. Zero-risk path for critical audio: segment-splice — edit only the non-talking seconds and keep the original track under the cut. |
| Style-transfer-heavy re-imagining, full relocate of the scene, or edit quality worth a premium at 1080p+ | Seedance edit/relocate (`videoReferenceAssetId` on `slates_generate_video`) | Seedance's strength is transfer intensity; it re-generates rather than surgically edits. Head-to-head receipt 2026-07-09 (photoreal-insert job, same clip): at 720p it LOST to Omni Flash edit on result while costing ~3× (vref bills input+output seconds; face-lane rates when people are in frame). Route here for its strengths or at 1080p/4K where its ceiling is higher — never as the cheap default. Takes long descriptive prompts fine (no Omni-style hard-fail on timing phrasing). |
| AI-edit the user's OWN footage | Omni Flash Edit (3–10s) or Kling O3 Edit (3–15s, 720–3840px) | Both take any MP4/MOV — not just Slates gens. Phone footage MUST be rotation-normalized first (players honor the rotation flag; models don't — raw portrait phone clips come back SIDEWAYS). |

- **Edit before re-roll.** A re-roll gambles away the parts the user already likes; an edit changes only what the prompt names. Quote the edit first when a clip is mostly right.
- **Ship via segment-splice.** Every edit model re-synthesizes the whole clip, so fidelity risk scales with clip length. For real deliverables: trim out ONLY the seconds where the change happens, edit that segment, splice it back over the original on the timeline with the ORIGINAL audio underneath. Most of the final video stays the untouched original — that's how the polished split-screen demos going around actually work, plus gesture-only beats with voiceover laid over in post.
- **One change per pass, short prompts.** On Omni Flash this is documented law ("overly descriptive prompts can lead to unintended changes" — long identity-lock preambles make drift WORSE, receipt 7/09); on Kling multi-beat instructions get dropped. Chain passes instead.
- Edited clips are themselves editable clips — chain passes; lineage links each output to its parent.

## Motion Transfer & Lip Sync routing (two engines per tool)

Both tools have a cheap Kling utility lane and a premium Seedance lane. The capability is the same; the execution model differs: Kling bolts motion/lip onto the source as a dedicated post-process; Seedance generates in a single pass with the driving clip / dialogue as native conditioning signals — better motion fidelity, natural speech delivery, audio included.

| Job | Engine | Why |
|---|---|---|
| Quick motion retarget, budget lane, or driving clip >15s | Kling MC std/pro (`slates_generate_motion_transfer`) | Structured skeleton/depth retarget, ~32–42 credits / 5s, takes up to 30s driving clips. |
| **Motion transfer where fidelity or audio matters** — dance, choreography, cinematic action | **Seedance 2.0** (`motionModel=seedance-2`) | Single-pass conditioning beats post-hoc retargeting; prompt-driven; native audio. Driving clip 2–15s; bills input+output seconds (vref keys). |
| Cheap lip-sync utility (re-voice a clip, simple avatar) | Kling lip-sync / avatar (`slates_generate_lip_sync`) | ~4–29 credits / 5s blocks. |
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
