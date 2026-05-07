---
name: slates-prompting-seedance
description: How to prompt Seedance 2.0 (ByteDance video model). Read before calling slates_generate_video with model seedance-2-fast or seedance-2-std. Seedance prompts have very specific structure (6-step formula + narrative timing beats) that differs from Kling and Veo — don't cross-pollinate the syntax.
---

# Seedance 2.0 — prompting

ByteDance's video model. Routed via PiAPI (Economy) or fal.ai (Priority). Audio always generated alongside video. Models: `seedance-2-fast` (cheaper) and `seedance-2-std` (higher quality). Up to 15s.

## Official 6-step formula

```
Subject + Action + Environment + Camera + Style + Constraints
```

**Sweet spot length:** 60-150 words (not 150-300 — that's the upper bound). Multi-shot can run longer.

## Pin the subject in the first 20-30 words

The opening sentence is the **identity anchor**. If the subject isn't locked early, the model hallucinates new subjects mid-clip.

```
A matte black earbud case sits on a polished obsidian surface...
```

## Narrative timing beats — "At N seconds"

Use natural-language time markers, NOT shot brackets or labels.

```
At 2 seconds, the camera begins a slow dolly forward.
At 4 seconds, the lid opens in slow-motion...
```

Beat count: **2 for 5s, 3 for 10s, 4-5 for 15s**.

## Camera moves — exact terms only

8 supported: `push-in`, `pull-out`, `pan`, `tracking`, `orbit`, `aerial`, `handheld`, `fixed`.

- "Dolly in" not "zoom in"
- "Orbit" not "circle"
- **One primary camera move per beat** — never stack them

## Lighting is the #1 quality lever

ByteDance says lighting has the biggest impact of any prompt element. Describe before or alongside the subject.

```
A cool-white diagonal beam from upper left, dust particles drifting through.
Soft golden hour lighting from low west angle.
Dramatic rim light against dark background.
```

## Camera and subject motion — separate sentences

Mixing them is the #1 cause of glitchy / shaky output.

❌ "The camera speed ramps as the earbud rises."
✅ "The earbud rises smoothly. The camera tracks upward."

## Slow-motion works. "Fast" doesn't.

`fast` is ByteDance's #1 quality-degrading keyword. Speed ramps and slow-motion are supported in natural language.

```
the lid opens in slow-motion · the blade whips through the air
```

Other dangerous tags (treated as slop): `epic`, `amazing`, `beautiful`, `lots of movement`, `8K`, `masterpiece`, `trending on artstation`.

## Style block at the end

One primary anchor + 2-3 supporting details. End with `Single continuous take` if you want one shot with no cuts. **Never** write `no cut` or `seamless transition` — not in the training vocabulary.

## Reference media — `@Image1` / `@Video1` / `@Audio1` syntax

Reference-to-video endpoint accepts up to **9 reference images, 3 reference videos, 3 audio clips**. Tag inline:

```
@Image1 is the character. @Image2 is the environment. @Audio1 is the foley.
```

**Mutually exclusive:** First-frame/last-frame mode CANNOT be combined with reference images. The error reads `"first/last frame content cannot be mixed with reference media content."` Pick one or the other.

## Image-to-video / first-frame guidance

**Describe motion, not image.** The model already sees the visual; tokens spent re-describing appearance are wasted.

Required stability phrases:
- `preserve composition and colors`
- `maintain exact appearance from reference image`
- `consistent character throughout, no deformation or drift`

**Cap I2V prompts under 60 words** when possible. Over 100 words frequently triggers silent generation failure.

## Negative prompting — inline only

Seedance has **no `negativePrompt` field**. Use the Constraints slot:

```
avoid jitter and bent limbs
avoid temporal flicker
avoid identity drift
no distortion, no stretching
```

Also fine: positive reframing ("empty street" not "no cars").

## Common failure modes + fixes

| Failure | Fix |
|---|---|
| Hallucinated subject mid-clip | First 20-30 words = identity anchor |
| Bent limbs / extra fingers | `avoid jitter and bent limbs` in Constraints |
| Identity drift across multi-shot | Repeat subject anchor at each beat |
| Silent generation failure on I2V | Cut prompt under 100 words, single primary camera move |
| Speech / motion conflict | Limit dialogue to one line per action shot |

## Benchmark prompts (verbatim from authoritative sources)

**Single-shot (fal.ai):**
> "A golden retriever runs across a sandy beach at sunset, kicking up wet sand with each stride, the camera tracking alongside at ground level. Waves crash softly in the background."

**Multi-shot commercial (fal.ai):**
> "Shot 1: extreme close-up of condensation dripping down a glass bottle, the sound of ice clinking. Shot 2: the bottle rises from a bed of crushed ice, camera tilting up slowly, bright backlight creating a halo effect. Shot 3: a hand grabs the bottle against a sunset rooftop backdrop, the city humming below."

**Cinematic anchor (atlabs):**
> "Modern Rural Aesthetics, Cinematic Commercial quality, shot with Sony A7S3/cinema camera, 4K/8K ultra-clear, Extreme Macro, natural transparent lighting, healing ASMR, no historical costume drama feel."

## Sources

- [fal.ai — How to Use Seedance 2.0](https://fal.ai/learn/tools/how-to-use-seedance-2-0)
- [apiyi.com — Seedance 2.0 Prompt Guide](https://help.apiyi.com/en/seedance-2-0-prompt-guide-video-generation-camera-style-tips-en.html)
- [atlabs.ai — Ultimate Seedance 2.0 Prompting Guide](https://www.atlabs.ai/blog/the-ultimate-seedance-2.0-prompting-guide-47-prompts-2026)
