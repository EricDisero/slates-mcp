---
name: slates-prompting-elevenlabs
description: How to prompt ElevenLabs Sound Effects v2 in Slates. Read before calling slates_generate_audio with model eleven-sfx — ONE short effect with an EXACT duration, or a seamless loop, billed per second. Covers describing an effect by its physical cause, the one-sound-per-generation rule, picking a duration, loops, prompt_influence, and when to use Seed Audio instead.
---

# ElevenLabs Sound Effects v2 — prompting

<!-- @card:start -->
<!-- slates-only -->
<!-- MACHINE-READ. Everything between the @card markers is extracted by
     src/prompts/craft-cards.ts and returned on every cost estimate for this
     model, so it is the ONE piece of positive craft guidance the agent cannot
     skip. Measured 2026-08-30: a fact inlined where it cannot be skipped moved
     compliance 0/8 to 30/32; the same guidance behind a fetch moved nothing.
     Keep it under 2,400 characters (the build fails above that) and keep the
     rationale, the receipts and the worked examples in the body below. -->
<!-- /slates-only -->
**Card — ElevenLabs Sound Effects v2.** ONE short sound with an exact length, or a seamless loop. The only Slates audio surface with a real duration control and a real loop mode.

**The five levers**
1. **Describe the physical CAUSE, not the label** — `heavy oak door slams shut`, `boot scuffs on grit`, `a latch drops home`.
2. **Name the material and the space.** The material decides the timbre and the space decides the tail: `on wet concrete`, `in a tiled stairwell`, `across an empty warehouse`.
3. **One sound per generation.** A room with dialogue AND clatter AND ambience is one Seed Audio pass, not three effects.
4. **Pick the duration from the cut**, not from a feeling: roughly 0.5-1s for an `impact`, 2-4s for a `whoosh`, 8-22s for a `loopable bed`.
5. **Ask for a loop explicitly** — `seamless loop` — when the sound has to lie under a whole scene, and keep it featureless enough to survive the seam.

**Examples**
- `A heavy oak door slams shut in a stone hallway, brief reverberant tail.` (1.5s)
- `Steady rain on a tin awning, no thunder, no wind gusts, seamless loop.` (18s)

**Hard constraint:** it is billed per second and the duration is never left for the model to pick — that would make the charge non-deterministic. It is NOT a speech surface: dialogue, narration and scratch VO are Seed Audio, which casts and performs the line inside the scene.
<!-- @card:end -->

<!-- @banned:start -->
<!-- slates-only -->
<!-- MACHINE-READ. Every `backticked` token between the @banned markers is
     extracted by src/prompts/banned-tokens.ts and returned on this model's cost
     estimate, and every submitted prompt is matched against it. Keep entries
     backticked and prose outside the backticks. -->
<!-- /slates-only -->
**Never use** — a label is not a sound; describe the physical cause:
- `door sound`, `whoosh`, `footsteps`, `impact`, `ambience` standing alone
<!-- @banned:end -->

One short sound with an exact length, carried on fal (`fal-ai/elevenlabs/sound-effects/v2`). This is the only Slates audio surface with a real duration control and a real loop mode.

## Where it routes

- **A single hit that has to land on a known frame** — door slam, whoosh, impact, UI blip, riser.
- **A seamless loop** you can lay under a whole scene — rain, engine hum, crowd murmur, machine noise.
- **NOT** layered scenes. A room with dialogue *and* clatter *and* ambience is one `seed-audio` pass, not three SFX generations.
- **NOT** speech. Dialogue, narration and scratch VO are `seed-audio` — it casts and performs the line inside the scene.
- **AUDIO-ONLY.** It cannot produce images or video.

## THE RULES

### 1. Describe the physical CAUSE, not the label

```
✗  door sound
✓  heavy oak door slams shut in a stone hallway

✗  whoosh
✓  a thick rope swung fast past a microphone, low air displacement

✗  footsteps
✓  boots on wet gravel, slow, one person
```

Material + weight + surface + room. Naming all four is the difference between a usable effect and a stock-library shrug. Cap is 450 characters — you will not need them.

### 2. One sound per generation

This surface makes a single event. A door, then footsteps, then a siren is three generations layered on the timeline — or one `seed-audio` scene, which is usually cheaper and always more coherent.

### 3. Duration is always explicit, and it is the price

Slates **always sends** `durationSeconds`. (Left null the model picks, which makes the charge non-deterministic — so it is never left null.) The window it must fall in:

<!-- @inject:thresholds -->
<!-- GENERATED from @slatesvideo/shared — do not edit between the markers.
     Source: CONFIRM_CREDITS, DEVIATION_FACTOR and the audio bounds in
     packages/shared/src/operations/index.ts. Every number here is REFUSED by an
     op when a prompt gets it wrong, which is why none of them is typed by hand
     any more: this block replaced four claims that contradicted the code. -->

**The thresholds, from the code that enforces them:**

- **Confirm gate:** above **17 credits** an op returns `requires_confirm` and will not
  proceed until you re-call with `confirm: true`. Below it, announce the cost once and go.
- **Deviation pause:** the desktop Studio Agent stops and re-asks when projected generation spend
  exceeds the approved plan by more than **20%**. You do not trigger this; the app does.
- **Seed Audio duration:** **3–120 seconds.** There is no duration
  parameter on the model — the number you pass is written into the prompt AND is what the user is
  billed. Outside that range the op refuses rather than clamping.
- **Sound Effects duration:** **1–22 seconds**, billed per second, never left for the
  model to pick.

Never quote a credit figure from memory: `slates_estimate_generation_cost` returns the real one.
<!-- @end:thresholds -->

| Kind of sound | Ask for |
|---|---|
| impact, hit, click | 0.5–1s |
| whoosh, riser, transition | 2–4s |
| loopable bed | 8–22s + `loop: true` |

Over-asking pads the tail with room tone you then trim. Under-asking clips the decay.

### 4. Loops

`loop: true` tiles without a seam — rain, engine hum, crowd murmur, machine noise. Combine with a longer duration so the loop point is not obvious.

For a bed longer than 22s, this is the wrong surface: `seed-audio` runs to 120s in one pass.

### 5. Prompt influence

`promptInfluence` 0–1, default 0.3. Higher hugs your wording with less variation between takes; lower explores. Raise it when a re-roll keeps wandering off the brief; lower it when every take sounds like the same take.

## Iterating

- Re-rolls that keep missing = the prompt named a **label** instead of a **cause**. Rewrite it as a physical event.
- A hit that lands but sounds wrong in the scene is usually a *room* problem — name the space ("in a stone hallway", "in a padded studio", "outdoors, no reflections").
- Three failed takes means the prompt is wrong, not the seed.

## Content notes

ElevenLabs applies its own moderation. See slates-content-policy.
