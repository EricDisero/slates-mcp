---
name: slates-prompting-elevenlabs
description: How to prompt ElevenLabs Sound Effects v2 in Slates. Read before calling slates_generate_audio with model eleven-sfx — ONE short effect with an EXACT duration (0.5-22s), or a seamless loop, billed per second. Covers describing an effect by its physical cause, the one-sound-per-generation rule, picking a duration, loops, prompt_influence, and when to use Seed Audio instead.
---

# ElevenLabs Sound Effects v2 — prompting

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

`durationSeconds` is 0.5–22 and Slates **always sends it**. (Left null the model picks, which makes the charge non-deterministic — so it is never left null.)

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
