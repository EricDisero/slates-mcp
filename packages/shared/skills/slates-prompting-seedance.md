---
name: slates-prompting-seedance
description: How to prompt Seedance 2.0 (ByteDance video model). Read before calling slates_generate_video with model seedance-2. Seedance prompts have very specific structure (6-step formula + narrative timing beats) that differs from Kling and Veo — don't cross-pollinate the syntax.
---

# Seedance 2.0 — prompting

ByteDance's video model — first-party via **BytePlus ModelArk** (credits only, no BYOK). Audio always generated alongside the video. Single model `seedance-2` across the full resolution ladder (480p / 720p / 1080p / native 4K, default 1080p), 4–15s, first+last frame + up to 9 reference images.

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

## Faces — set `seedanceFace` for AI-character faces

Seedance routes through **three tiers** depending on the face in the reference, exposed as the "Face in Reference" toggle plus the real-face params on `slates_generate_video`:

- **Faceless / object / environment refs → default route (cheapest).** Leave `seedanceFace` off.
- **An AI-character's FACE in a reference → `seedanceFace: true`.** The default route's baseline moderation rejects or degrades faces, so this reroutes to the face-capable provider. It costs **~45% more** — the cost key becomes `seedance-2-face-{res}-{N}s`, so the pre-flight quote already reflects it. Announce the face-route price, not the faceless one.
- **A REAL person's photo (the user themselves, an actor) → the consent-gated premium route.** If a `seedanceFace` gen fails with `[REAL_FACE_DETECTED]`, the provider classified the reference as a real person: confirm with the user that (a) they hold the rights/consent to the likeness and (b) they accept the higher price (cost key `seedance-2-realface-{res}-{N}s`, roughly 2× the AI-face rate — quote via `slates_estimate_generation_cost`), then retry with `seedanceRealFace: true` + `realFaceConsent: true`. Never set `realFaceConsent` without the user's explicit confirmation.

Rules:
- **The real-vs-AI call is the PROVIDER'S, not yours.** ByteDance's classifier is probabilistic — some real photos pass the standard face route (billed at the cheap rate; fine), others get rejected with `[REAL_FACE_DETECTED]` (auto-refunded). Don't preemptively route to the real-face tier just because a photo looks real; try `seedanceFace: true` first and escalate only on the marked rejection. Public figures / celebrities fail on every route.
- It's about the **reference, not the output.** If your character refs (turnaround, expression sheet, a generated portrait) show a face, turn it on. A product shot with no person stays off.
- Don't toggle it on "just in case" — a faceless gen on the face route burns ~45% extra for nothing.

## Reference rules (the verified ones)

- **Describe the ACTION, never the reference's content.** With refs attached, prompt only what is *happening* — motion, change, camera. Never re-describe what's in the reference, and never say "still / scene / from a movie / from the image." The model already sees the refs; narrating them wastes tokens and induces drift. Injection is stochastic — if a roll misses, **re-roll, don't re-engineer** (and a slow gen is not a failed one — see slates-cost-discipline).
- **2-4 strong refs beat both extremes** — not 1 (warps), not 12 (averages worse). Start focused.
- **One reference per ROLE, named in the prompt.** Seedance's official idiom is **"Reference \<Subject_N\> in \<Image_N\>"** — `Image_N` indexes the order the refs are attached, so the name + index carries the role; the model doesn't infer it from order alone. Slates composes this for you from `@mentions`: it cites each reference inline as "image N" in the exact order it sends them. You don't hand-write role labels.
- **Character identity: attach the turnaround AND the close-up expression sheet, named as one entity** — cite both under the same name. The shared name — not a role essay — is what keeps the varied expressions from averaging the face; don't gate the expression sheet, and don't tell it to "render neutral / ignore the outfit" (the user's prompt owns expression, wardrobe, and lighting). The trend is MORE references (video/audio into Seedance), all addressed by name — lean into attaching rich refs and let the naming do the work.
- **Flat-lit identity refs.** A studio-lit / scene-lit character sheet bleeds its lighting into the clip ("green-screen pasted in front of mountains"). Prep refs flat and plain.
- **Environment: describe it, don't feed a grid.** Default to words and let the model build the space to fit; reserve an environment ref for a hard exact-match, and then use ONE clean establishing image — never a multi-panel grid.
- **Reuse the same refs across every shot** in a sequence — swapping mid-sequence drifts.
- **Legible on-screen text → bake it into an NB2 start frame** and animate from it; Seedance won't render clean text from scratch.
- **Grids are for EXPLORING compositions, not for inputting** — pick a cell, don't feed the grid back as a reference.

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

## Pre-flight: references arrive inline, refer by code

When you call `slates_generate_video` with reference asset IDs (firstFrameAssetId, lastFrameAssetId, ingredientAssetIds), the first call returns those references **inline as image content blocks** alongside a cost estimate and `requires_confirm: true`. **Look at the references** — if they suggest a different framing, lighting, or motion than your current prompt captures, revise the prompt before re-calling with `confirm=true`.

When talking to the user about the gen, refer to each reference by its short code: `IMG-A12 — Beach Sunset`. The user sees that code as a badge on the gallery thumbnail, so they can match what you're saying to what they're looking at.

- ✅ "I'm using **IMG-A12** as the first frame and **IMG-A15** as the last frame — the camera move is going to be a slow dolly forward through the gap."
- ❌ "I'm using the first beach image and the last one..." (which? They have four.)

## Sources

- [fal.ai — How to Use Seedance 2.0](https://fal.ai/learn/tools/how-to-use-seedance-2-0)
- [apiyi.com — Seedance 2.0 Prompt Guide](https://help.apiyi.com/en/seedance-2-0-prompt-guide-video-generation-camera-style-tips-en.html)
- [atlabs.ai — Ultimate Seedance 2.0 Prompting Guide](https://www.atlabs.ai/blog/the-ultimate-seedance-2.0-prompting-guide-47-prompts-2026)
