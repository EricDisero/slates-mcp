---
name: slates-prompting-nano-banana-2
description: How to write prompts that produce cinematic, photorealistic results from Nano Banana 2 (Google Gemini 3.1 Flash Image, accessed via fal-ai/nano-banana-2). Read this before calling slates_generate_image when the user wants film-quality, real-world, or cinematic output. Skip for stylized / illustrated / cartoon work — the rules differ.
---

# Nano Banana 2 — cinematic & photorealistic prompting

Nano Banana 2 is **Gemini 3.1 Flash Image**.<!-- slates-only --> It is the default model behind `slates_generate_image` — the op also exposes `flux-2-max` and `seedream-5-lite`, each with its own prompting skill.<!-- /slates-only --> It is **not** Gemini 3 Pro Image; that is Nano Banana **Pro** (`nano-banana-pro`), a separate model with its own seat.<!-- slates-only --> Verified against the runtime slug map in `slate/src/main/api/google.ts`.<!-- /slates-only --> NB2 is a language model that outputs pixels — brief it like a creative director, not like a Stable-Diffusion tag-soup tool. The single biggest lever for realism: **specificity that mimics how real photographers and cinematographers describe their work**.

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

> ⚠️ **This vocabulary is an IMAGE-model lever and a video-model anti-pattern — do not carry it across.**
> Named lenses, apertures, film stocks and camera bodies (`85mm f/1.4`, `Kodak Portra 400`, `ARRI Alexa 65`) are correct and encouraged **here**. They are a **Seedance anti-pattern**: ByteDance's own guide uses shot sizes, camera moves, pacing words and its image-quality vocabulary throughout, and never once mentions fps, shutter angle, f-stop, or lens millimetres.
> The leak happens in one specific way — you write an NB2 start frame, then write the video prompt to animate it and carry the look description straight across. **Translate instead of copying:** `85mm f/1.4, Portra 400` → `close-up, shallow depth of field, warm natural colors, cinematic texture, film-grain texture`. Full rule and the receipts: `slates-prompting-seedance` (Part 3, "Don't cross-pollinate image-model syntax").

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
- **Name each reference inline — Slates does this for you.** When you `@mention` a subject/environment or `#mention` a style<!-- slates-only --> (or pass `referenceAssetIds`)<!-- /slates-only -->, Slates composes the prompt so each reference is named inline as "image N" — e.g. `Marcus (image 1) sits across from the woman (image 2) in the cafe (image 3)`, with a trailing `Render in the visual style of image 4.` The model does NOT infer a reference's role from its position; the NAME carries it. NB2's own consistency lever is literally **"assign a distinct name to each character/object"**. **Do NOT hand-write a "Reference Image Instructions" block or role essays** ("use for identity, ignore the outfit, render the scene's expression") — that drags the sheet's wardrobe + studio lighting into the scene. The prompt leads; the user's words own wardrobe, expression, lighting, and action.

### Reference rules (the verified ones)

<!-- @inject:references-read-literally -->
> **The general law: the model reads a reference literally.**
> A reference image is not a suggestion. Whatever is baked into it — lighting, medium, texture, symmetry, competing identities — is read as a **property of the subject** and reproduced downstream. A baked rim light tints every shot made from that sheet. A sheet that looks like a 3D game render gets animated like game footage. Two competing renderings of one face get averaged into a third face.

Every reference rule below is a corollary of that one sentence, which is why "prep the reference" beats "prompt around the reference" every time:

- **Flat, plain identity refs** — because scene lighting in the sheet becomes scene lighting in the output (Slates' own receipt: a studio-lit sheet produced a subject that looked green-screen-pasted in front of mountains).
- **One authoritative rendering per subject** — because the model cannot tell which panel is the real one. ByteDance documents this failure directly: multi-view character assets "confuse the model's character recognition, causing it to generate duplicate characters of the same appearance."
- **No 3D-game-render look in a reference** — the model recognizes the render mood and inherits its motion character, so the *animation* comes out looking like game footage. This is not a taste rule; it is the same literal-reading mechanism applied to the temporal layer.
- **Break perfect symmetry** — mirrored faces and dead-square framing read as synthetic, and the model preserves that reading rather than correcting it.

**What this means in practice:** when output is wrong in a way that tracks the *subject* rather than the *scene* — the lighting is wrong the same way in every shot, the face drifts, the material looks synthetic everywhere — fix the reference, not the prompt. Prompting around a baked-in property is the expensive way to lose.
<!-- @end:references-read-literally -->

<!-- @inject:reference-rules-core -->
Identity = a few flat-lit neutral angles; one reference per role, named inline; 2-4 refs not 12; describe environments instead of feeding a grid.

1. **2-4 strong references beat both extremes.** Not 1 (warps toward itself), not 12 (averages worse). Start with 2-3 focused refs — each one adds context AND another variable to balance.
2. **One reference per ROLE, named in the prompt** — identity / style-grade / environment. The model does **not** infer a reference's role from its position in the list; the inline name carries it. Same-role competitors drift (two "identity" refs of different people blend into a third face). Slates composes the naming for you from your `@mentions` / `#tags` — you never hand-write role labels.
3. **One identity sheet per character, named inline.** A character's identity is a single asset (dominant portrait + body panels), so attach that one asset rather than a pile of views: **fewer competing renderings of a face is better, because the model cannot tell which one is authoritative and averages them.** Slates cites it as `Marcus (image 1)`. **Do NOT hand-write a "Reference Image Instructions" block or role essays** ("use for identity, ignore the outfit, render a neutral expression") — that drags the sheet's studio lighting and wardrobe into a scene that asked for neither. The prompt leads; the user's words own wardrobe, expression, lighting, and action.
4. **Flat-light identity refs.** Prep identity references with flat, even, shadowless lighting on a plain neutral background. A studio-lit or scene-lit character sheet bleeds its lighting into every generation — the failure looks like the subject was green-screen-pasted in front of the location. Reference prep beats prompting here.
5. **Environment: describe it, don't feed a grid.** Default to describing the location in words and let the model build a space that fits the shot. Reserve an environment reference for a mandatory exact-match, and then use ONE clean establishing image with natural ambient light that reads as the location's real light — never a multi-panel grid fed whole.
6. **Grids: explore, don't input.** Use grids to explore compositions cheaply, then pick a cell. Never feed a grid back in as a reference — the cells share a split detail budget and were generated jointly, so their flaws propagate.
7. **Reuse the same refs across every shot** in a sequence. Lock a set and keep it; swapping references mid-sequence causes drift, because the model adapts each reference to the current prompt rather than copying it.
8. **Legible in-shot text → bake it into a still start frame, never trust text-to-video.** Have an image model render the text, then animate from that locked frame. Video models smear type.
9. **Working from existing media — describe ONLY what changes.** The source already carries its composition, motion, timing, and performance; re-describing them fights the model. Narrate the delta. (Video lane: restyle your own clip while keeping the performance; delayed-VFX on "video one"; marker-object insertion; video-as-reference for a series.)
10. **Style transforms happen in natural language.** By default the source's artistic medium and visual style are inherited. To change it, add a plain-text instruction ("anime → real person"). There are no preset pickers, and there is no style slider.
<!-- @end:reference-rules-core -->

### For Nano Banana 2 specifically

- **NB2's own consistency lever is "assign a distinct name to each character/object."** That is Google's phrasing for rule 3 — cite each canonical identity inline by name.
- **Rule 8 is a job you do, not one you delegate.** NB2 *is* the start-frame model — when a downstream video shot needs legible text, render it here and animate from this frame.
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

- Resolution is priced: NB2 4k costs roughly 2x 1k. Prices change — check current numbers<!-- slates-only --> by calling `slates_estimate_generation_cost`<!-- /slates-only -->. Pick the cheapest resolution that serves the use case.
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

## Family variants — Lite and Pro

Everything in this skill applies to the whole Nano Banana family; two variants trade speed/ceiling around NB2 full:

- **nano-banana-2-lite** — ~half the price, ~2.7× faster, **1K output only**, max 4 refs. The draft/iteration seat: explore compositions here, then re-run the winner on NB2 full at 2K/4K. Same Gemini filter.
- **nano-banana-pro** — the hero-frame/typography ceiling (~2× NB2, 4K native). NB2 ≈ 95% of Pro; escalate only when spatial composition, cinematic lighting/skin, fine typography-in-scene, or deep multi-element frames must be perfect. Up to 14 refs — it takes a full subject library in one call.

<!-- slates-only -->
Routing between them (and vs GPT Image 2 / FLUX / Seedream): `slates-model-selection`.
<!-- /slates-only -->
