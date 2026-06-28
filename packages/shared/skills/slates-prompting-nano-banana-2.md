---
name: slates-prompting-nano-banana-2
description: How to write prompts that produce cinematic, photorealistic results from Nano Banana 2 (Google Gemini 3 Image, accessed via fal-ai/nano-banana-2). Read this before calling slates_generate_image when the user wants film-quality, real-world, or cinematic output. Skip for stylized / illustrated / cartoon work — the rules differ.
---

# Nano Banana 2 — cinematic & photorealistic prompting

The **default** model behind `slates_generate_image` is **Gemini 3 Image** (Nano Banana 2 / Flash) — the op also exposes `flux-2-max` and `seedream-5-lite`, each with its own prompting skill. NB2 is a language model that outputs pixels — brief it like a creative director, not like a Stable-Diffusion tag-soup tool. The single biggest lever for realism: **specificity that mimics how real photographers and cinematographers describe their work**.

Knowledge cutoff: January 2025. Anything after needs explicit reference images.

## Google's 4 official rules (verbatim)

1. **Be specific.** Provide concrete details on subject, lighting, and composition.
2. **Use positive framing.** Describe what you want, not what you don't want.
3. **Control the camera.** Use photographic and cinematic terms like "low angle" and "aerial view."
4. **Iterate.** Refine images with follow-up prompts in a conversational manner.

## Official prompt formula

```
[Subject] + [Action] + [Location/context] + [Composition] + [Style]
```

For the cinematic / photoreal use case, expand to:

```
Film still from [DIRECTOR] [GENRE]. Shot on [CAMERA] with [LENS]. [SUBJECT and action]. [3-5 specific visual details]. [LIGHTING — direction + quality]. [COLOR PALETTE]. [FILM STOCK or sensor language]. [1-2 word emotional tone].
```

## Photorealism positives — what consistently works

**Named lenses + apertures** beat generic "shallow depth of field":
- `85mm f/1.4`, `135mm f/2.8` (the cheat code for skin texture), `50mm f/1.2`, `35mm f/2`
- `Panavision anamorphic` for horizontal flares + cinematic width
- `400mm telephoto` for compression + isolation
- `24mm` for environmental interiors

**Named cameras / sensors:**
- `ARRI Alexa 65`, `Hasselblad X2D`, `Canon EOS R5`, `Sony A7III`, `Fujifilm X-T5`
- "Specific gear" beats "DSLR"

**Named film stocks** (one per prompt — never mix):
- `Kodak Portra 400` — natural skin, warm
- `Fuji Velvia 50` — saturated, landscape
- `Ilford HP5 Plus` — black and white, gritty grain
- `CineStill 800T` — tungsten night, halation

**Physics-based lighting** (direction + quality):
- `Single key light at 45 degrees from upper left`
- `Late afternoon sun at 15 degrees above horizon`
- `Color temperature 4500K` beats `slightly warm`
- `Practicals only — no fill` for Deakins-style realism

**Imperfection vocabulary** (forces away from AI-clean):
- `visible pores`, `natural skin grain`, `peach fuzz`, `slight hyperpigmentation`
- `unretouched raw photography`, `ISO noise`, `sweat beading`
- `crisp catchlights in the eyes`, `skin micro-detail`

**Director references** (use when locking style):
| Director | Tone | Visual signature |
|---|---|---|
| Denis Villeneuve | Cold, vast, existential | Desaturated, overwhelming scale |
| Roger Deakins | Precise motivated light | Single source, deep shadows, practicals |
| Emmanuel Lubezki | Natural, spiritual | Available light, golden hour |
| Bradford Young | Warm darkness | Underexposed, rich shadows, skin tones |

**Genre cues that move the model:**
- `unstaged documentary photography style`
- `fashion magazine editorial, shot on medium-format analog film, pronounced grain`
- `Film still from [Director] [genre]`

## The anti-list — phrases that DEGRADE realism

These are Stable-Diffusion-era tag soup. The model treats them as low-signal noise. Measured success rate: ~60-70% with these vs ~95%+ with positive description.

**Never use:**
- `8k`, `4k` (as a quality token)
- `hyperrealistic`, `ultra-realistic`, `photorealistic` standing alone
- `masterpiece`, `best quality`, `highly detailed`, `ultra-detailed`
- `trending on ArtStation`, `award-winning`
- `perfect skin`, `flawless`, `airbrushed`, `smooth skin`
- `cinematic` standing alone — always specify *which cinema* (director, lens, era, stock)
- `not anime, not cartoon, not 3D` — negation tag soup, replace with a positive style cue

## Negative prompting — there is no field

Nano Banana 2 has **no `negativePrompt` parameter**. Three patterns to suppress unwanted content:

1. **Positive reframing (preferred):** "empty street" not "no cars". "Unstaged documentary photography" not "not anime."
2. **Inline `without` / `free of`:** "without any people, vehicles, or man-made structures", "free of text overlays, logos, or watermarks."
3. **Constraint clauses for anatomy/quality:** "accurate anatomy with five fingers per hand, symmetrical features, natural proportions"; "sharp, well-exposed, free of blur or JPEG artifacts."

Default to #1. Reach for #2 only when positive framing can't suppress the unwanted element.

## Reference images

- **Hard limit: 14 images** (10 object-fidelity + 4 character-consistency). Categories don't trade — you can't use 14 object slots even if no characters are referenced.
- **Name each reference inline — Slates does this for you.** When you `@mention` a subject/environment or `#mention` a style (or pass `referenceAssetIds`), Slates composes the prompt so each reference is named inline as "image N" — e.g. `Marcus (images 1 and 2) sits across from the woman (images 3 and 4) in the cafe (image 5)`, with a trailing `Render in the visual style of image 6.` The model does NOT infer a reference's role from its position; the NAME carries it. NB2's own consistency lever is literally **"assign a distinct name to each character/object"**, so citing both of a subject's sheets under the SAME name ("Marcus") is what tells the model they are ONE person and stops the face averaging. **Do NOT hand-write a "Reference Image Instructions" block or role essays** ("use for identity, ignore the outfit, render the scene's expression") — that drags the sheet's wardrobe + studio lighting into the scene. The prompt leads; the user's words own wardrobe, expression, lighting, and action.

### Reference rules (the verified ones)
1. **2-4 strong refs beat both extremes.** Not 1 (warps toward itself), not 12 (averages worse). Start with 2-3 focused refs — each adds context AND variables to balance.
2. **One reference per ROLE, named** (identity / style-grade / environment). Same-role competitors drift. The model doesn't infer roles from order — the inline name does it.
3. **Identity refs: attach both sheets, named as one entity — don't gate them.** A character's turnaround (body/proportion/outfit) AND its close-up expression sheet (high-res face: eyes, skin, teeth) both go in, cited under the SAME name ("Marcus (images 1 and 2)"). That shared name — not a role essay — is what stops the varied expressions from averaging the face. An *unnamed* expression sheet hurts; named as one entity, the close-ups are a fidelity win.
4. **Flat-light identity refs.** Prep them with flat, even, shadowless lighting on a plain neutral background. Studio-lit / scene-lit sheets bleed their lighting into the generation ("green-screen pasted in front of mountains").
5. **Environment: describe it, don't feed a grid.** Default to describing the location in words. Reserve an environment ref for a mandatory exact-match, and then use ONE clean establishing image — never a multi-panel grid fed whole.
6. **Grids: explore, don't input.** Use grids to explore compositions, then pick a cell. Never feed a grid back in as a reference — cells share a split detail budget, so flaws propagate.
7. **Reuse the same refs across all shots.** Swapping mid-sequence causes drift.
8. **Legible in-shot text → bake it into the NB2 start frame**, then animate from it. Never trust text-to-video to render clean text.
- **Character consistency is officially "not 100% perfect"** per Google. Test before bulk generations. High-resolution, front-facing reference images help most.
- **Injection is stochastic — budget 3-5 re-rolls per shot; re-roll, don't re-engineer.** First rolls miss faces/hands; the same prompt lands a clean one within a few tries.

## Common failure modes + fixes

**Hands:** Append `accurate anatomy with five fingers per hand, symmetrical features, natural proportions, relaxed open palm`. Avoid heavy jewelry, props intersecting fingers, motion blur in references.

**Text in images:** Quote-wrap target text. Specify font (`Century Gothic, 12pt`). Long phrases work; small text degrades. Two-step works best — generate text concepts conversationally first, then ask for the image.

**Left/right confusion:** Default is **viewer's perspective**, not subject's. Append `left and right are from the character's perspective, NOT the camera's` when scene-blocking matters.

**Surreal / absurd prompts trip uncanny valley:** The model drags toward realism. If you want surrealism, lean hard into stylization keywords (`painted`, `illustrated`, `stop-motion`).

**Soft faces / dead eyes:** Add `crisp catchlights in the eyes`, `skin micro-detail`, `peach fuzz visible`. Don't stack quality enhancers — single clean prompt beats multiple re-interpretations.

**Post-cutoff content (anything after Jan 2025):** Use reference images. The model has no knowledge of recent franchises, products, events.

## Resolution tactics

- Resolution is priced: NB2 4k costs roughly 2x 1k. Prices change — call `slates_estimate_generation_cost` for current numbers. Pick the cheapest resolution that serves the use case.
- **At 2K and above, the model allocates more tokens to surface detail** — explicit texture vocabulary (pores, fabric weave, grain) compounds at higher resolution.
- 1k for fast iteration / drafts; 2k for hero shots; 4k only when you need print-grade detail.
- 2K generations vary 20-60s+. Don't time-budget tightly.

## Boring vs cinema — examples

❌ **Boring:** "Wide shot of a man on a dock looking at the forest."

✅ **Cinema:** "Direct overhead drone shot on weathered dock surface. Single figure standing center frame, climbing up from frame bottom. Boot prints leading away from him toward shore. Pale winter light. Anamorphic lens flare from low sun. Desaturated blue and slate grey palette. Kodak Portra 400 grain. The path already walked by someone else. Map of threat."

❌ **Boring:** "Close up of a woman looking scared."

✅ **Cinema:** "Extreme close on subject's mouth and nose, 135mm f/2.8, shallow depth of field. Breath pluming out, catching cold light from upper-left key. Lips slightly parted, peach fuzz visible. The breath holds. CineStill 800T halation around catchlights. Waiting."

## The 3-strike rule

If three iterations on the same prompt haven't produced what the user wants, stop. Hand back to the user with what you tried and what isn't working. The slot machine doesn't converge — the prompt structure is wrong, not the seed.
