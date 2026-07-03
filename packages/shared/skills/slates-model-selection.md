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

**Rules:**

- **Default video = Kling 3.0 std.** Escalate to Seedance the moment the shot has physics/effects weight or is the hero moment — and say why in the plan ("physics-heavy, routing to Seedance").
- **Veo is never the default.** 16:9 only, 4/6/8s only, and it is not the quality pick — treat it as a single-purpose tool for native-synced-audio shots. If audio can be added after (Kling lip-sync, edit stage), prefer Kling or Seedance + audio in post.
- **9:16 vertical → Kling or Seedance.** Veo can't.
- **Image-to-video from an NB2 start frame** (the standard pipeline) → Kling by default, Seedance when the motion is physics-heavy. Not Veo.
- **User names a model explicitly → use it.** But if it's a mismatch for the job (crazy physics on Kling std, vertical on Veo), say so in one line and offer the right route before generating.

## Image routing

**Video models (Kling, Seedance, Veo) cannot generate standalone images — ever.** A "premium hero reference image" is still an image job: it routes to an image model below, never to Seedance.

- **Default: Nano Banana 2** — best reference handling (14 refs), best legible text, the standard start-frame generator.
- **FLUX.2 Max** — photoreal texture, hex-color binding, typography, less censored.
- **Seedream 5 Lite** — cheapest; flat-priced drafts and volume exploration.

## Cost is a tiebreaker, not the router

Route by capability first, then pick the cheapest tier that serves the job (per `slates-cost-discipline`). Never pick a model because its per-second price looked lowest — a cheap clip that has to be regenerated on the right model costs more than routing correctly once.
