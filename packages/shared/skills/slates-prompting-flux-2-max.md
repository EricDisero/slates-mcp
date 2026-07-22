---
name: slates-prompting-flux-2-max
description: How to prompt FLUX.2 Max (Black Forest Labs image model). Read before calling slates_generate_image with model flux-2-max, or slates_edit_image with editModel flux-2-max. FLUX.2 wants front-loaded structure, real camera vocabulary, and positive-only phrasing — no negative prompts, no tag soup.
---

# FLUX.2 Max — prompting

Black Forest Labs' top image model, routed via fal.ai. In Slates: `slates_generate_image` with `model: flux-2-max` (REQUIRES projectId — no headless path), priced per resolution (1k/2k/4k — call `slates_estimate_generation_cost` for current numbers, never quote from memory). Strengths vs Nano Banana 2: photoreal texture, less censored, precise hex-color control, strong typography. Reference images route through FLUX's edit endpoint and carry a lower per-model cap than NB2's 14.

## Core structure — front-load what matters

```
Subject + Action + Style + Context
```

Word order is weight. FLUX.2 attends hardest to the start of the prompt: main subject → key action → critical style → essential context → secondary details.

**Length:** 10-30 words for concept tests, 30-80 words for most work, 80+ only for genuinely complex scenes.

## Photorealism: name real gear, not "professional photo"

The single biggest realism lever is concrete camera vocabulary:

```
Shot on Hasselblad X2D, 80mm lens, f/2.8, natural lighting
Shot on Sony A7IV, 35mm, golden hour, shallow depth of field
Kodak Portra 400, natural grain, organic colors
```

Era cues work the same way: "early digital camera, slight noise, flash photography, candid" reads 2000s digicam; "film grain, warm color cast, soft focus" reads 80s.

For portraits add: natural skin texture, realistic pores, subtle imperfections, soft diffused lighting.

## No negative prompts — reframe positively

FLUX.2 has no negative prompt support. Describe the presence you want, not the absence:

- ❌ "no blur" → ✅ "sharp focus throughout"
- ❌ "no people" → ✅ "empty scene"
- ❌ "no harsh shadows" → ✅ "soft, diffused lighting"

## Hex colors — bind them to objects

FLUX.2 matches hex codes, but only when each code is attached to a specific object:

```
walls in hex #C4725A, sofa in #1B6B6F, accent pillows #E8A847
gradient starting with color #02eb3c and finishing with color #edfa3c
```

❌ "use #FF0000 somewhere" — unbound colors land inconsistently.

## Text rendering

Quote the exact text, then place and style it:

```
The text 'OPEN' appears in red neon letters above the door
Logo text 'ACME' in color #FF5733, ultra-bold decorative serif, centered
```

Specify placement relative to other elements, font family feel (serif / sans / script), and relative size ("large headline," "small body copy").

## JSON prompting for production work

For multi-element scenes that must come out exactly right (product shots, infographics, brand work), FLUX.2 parses structured JSON prompts:

```json
{
  "scene": "Professional studio product photography on polished concrete",
  "subjects": [{ "description": "matte black ceramic mug with steam", "position": "center foreground" }],
  "style": "commercial product photography",
  "color_palette": ["#1B1B1B", "#E8A847"],
  "lighting": "three-point softbox, soft diffused highlights",
  "camera": { "lens-mm": 85, "f-number": "f/5.6" }
}
```

Use natural language for exploration, JSON when the layout is locked and you're matching a spec.

## Reference images (edit path)

In Slates, pass `referenceAssetIds` on `slates_generate_image` — FLUX routes them through its edit endpoint. Slates names each reference inline in the prompt ("the subject (image 1), the style (image 2)") in the order it sends them, so you don't hand-write role labels; the name carries the role and unnamed-by-position blending is avoided. For surgical changes to one existing image use `slates_edit_image` with `editModel: flux-2-max` (note: FLUX edits ignore extra referenceAssetIds — that's NB2-only).

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
3. **One identity sheet per character — and whatever you do attach for a subject, NAME it as one entity.** A character's identity sheet is a single asset (dominant portrait + body panels), so attach that one asset rather than a pile of views: **fewer competing renderings of a face is always better, because the model cannot tell which one is authoritative and averages them.** Where a character carries a second bound sheet — an explicit expression range, or a legacy turnaround+expression pair — cite BOTH under the SAME name, `Marcus (images 1 and 2)`. That shared name, not a role essay, is what tells the model they are ONE person and stops the varied expressions from averaging the face. **Do NOT hand-write a "Reference Image Instructions" block or role essays** ("use for identity, ignore the outfit, render a neutral expression") — that drags the sheet's studio lighting and wardrobe into a scene that asked for neither. The prompt leads; the user's words own wardrobe, expression, lighting, and action.
4. **Flat-light identity refs.** Prep identity references with flat, even, shadowless lighting on a plain neutral background. A studio-lit or scene-lit character sheet bleeds its lighting into every generation — the failure looks like the subject was green-screen-pasted in front of the location. Reference prep beats prompting here.
5. **Environment: describe it, don't feed a grid.** Default to describing the location in words and let the model build a space that fits the shot. Reserve an environment reference for a mandatory exact-match, and then use ONE clean establishing image with natural ambient light that reads as the location's real light — never a multi-panel grid fed whole.
6. **Grids: explore, don't input.** Use grids to explore compositions cheaply, then pick a cell. Never feed a grid back in as a reference — the cells share a split detail budget and were generated jointly, so their flaws propagate.
7. **Reuse the same refs across every shot** in a sequence. Lock a set and keep it; swapping references mid-sequence causes drift, because the model adapts each reference to the current prompt rather than copying it.
8. **Legible in-shot text → bake it into a still start frame, never trust text-to-video.** Have an image model render the text, then animate from that locked frame. Video models smear type.
9. **Working from existing media — describe ONLY what changes.** The source already carries its composition, motion, timing, and performance; re-describing them fights the model. Narrate the delta. (Video lane: restyle your own clip while keeping the performance; delayed-VFX on "video one"; marker-object insertion; video-as-reference for a series.)
10. **Style transforms happen in natural language.** By default the source's artistic medium and visual style are inherited. To change it, add a plain-text instruction ("anime → real person"). There are no preset pickers, and there is no style slider.
<!-- @end:reference-rules-core -->

### For FLUX.2 Max specifically

- **FLUX caps references well below NB2's 14, so rule 1's "2-4" is a ceiling here, not a starting point.** Be deliberate about which roles earn a slot.
- **Rule 9 has a hard edge on this model:** `slates_edit_image` with `editModel: flux-2-max` ignores extra `referenceAssetIds` — that is NB2-only. A FLUX edit sees the source image and the prompt, nothing else.
- **FLUX has no memory between generations, so rule 7 is enforced by repetition.** Define the character exhaustively once and repeat those exact descriptors verbatim in every subsequent prompt — see Character consistency across a series below.

## Character consistency across a series

Define the character exhaustively once, then repeat those exact descriptors verbatim in every subsequent prompt. FLUX has no memory between generations — the repeated description IS the consistency mechanism.

## Common failure modes + fixes

| Failure | Fix |
|---|---|
| Generic "AI look" on photoreal | Name a camera body + lens + f-stop instead of "professional photo" |
| Colors drift from brand spec | Bind each hex code to a named object |
| Text garbled | Quote the exact string, specify font feel + placement + size |
| Multi-reference blend chaos | Name each reference inline (Slates does this from your @mentions/referenceAssetIds) — the same name for one entity, distinct names per role |
| Wanted element missing | Move it earlier in the prompt — order is weight |

## Pre-flight: references arrive inline, refer by code

When you pass `referenceAssetIds`, the first call returns the references **inline as image content blocks** with a cost estimate and `requires_confirm: true`. Look at them — revise the prompt if they suggest a different composition or style — then re-call with `confirm=true`. Refer to each asset by its short code (`IMG-A12 — Beach Sunset`) when talking to the user; it matches the badge on their gallery thumbnail.

## Sources

- [Black Forest Labs — FLUX.2 Prompting Guide](https://docs.bfl.ml/guides/prompting_guide_flux2)
- [fal.ai — FLUX.2 [max] Prompt Guide](https://fal.ai/learn/devs/flux-2-max-prompt-guide)
