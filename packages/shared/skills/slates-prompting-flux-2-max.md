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

In Slates, pass `referenceAssetIds` on `slates_generate_image` — FLUX routes them through its edit endpoint. Label every reference's role in the prompt text ("subject from image 1, style from image 2, background from image 3"); unlabeled references get blended unpredictably. For surgical changes to one existing image use `slates_edit_image` with `editModel: flux-2-max` (note: FLUX edits ignore extra referenceAssetIds — that's NB2-only).

Reference discipline (FLUX caps refs lower than NB2's 14, so be deliberate):
- **2-4 strong refs**, one per role, labeled — not 1 (warps), not many (blends).
- **Flat-lit identity refs** — a studio-lit / scene-lit character sheet bleeds its lighting into the output.
- **Attach both character sheets, labeled for identity** — turnaround (body/proportion/outfit) + close-up expression sheet (face detail), rendering the scene's expression (default neutral); the label keeps the expressions from averaging the face.
- **Environment: describe it, don't feed a multi-panel grid** — reserve a ref for a hard exact-match, then use ONE clean establishing image.

## Character consistency across a series

Define the character exhaustively once, then repeat those exact descriptors verbatim in every subsequent prompt. FLUX has no memory between generations — the repeated description IS the consistency mechanism.

## Common failure modes + fixes

| Failure | Fix |
|---|---|
| Generic "AI look" on photoreal | Name a camera body + lens + f-stop instead of "professional photo" |
| Colors drift from brand spec | Bind each hex code to a named object |
| Text garbled | Quote the exact string, specify font feel + placement + size |
| Multi-reference blend chaos | Label each reference's role explicitly in the prompt |
| Wanted element missing | Move it earlier in the prompt — order is weight |

## Pre-flight: references arrive inline, refer by code

When you pass `referenceAssetIds`, the first call returns the references **inline as image content blocks** with a cost estimate and `requires_confirm: true`. Look at them — revise the prompt if they suggest a different composition or style — then re-call with `confirm=true`. Refer to each asset by its short code (`IMG-A12 — Beach Sunset`) when talking to the user; it matches the badge on their gallery thumbnail.

## Sources

- [Black Forest Labs — FLUX.2 Prompting Guide](https://docs.bfl.ml/guides/prompting_guide_flux2)
- [fal.ai — FLUX.2 [max] Prompt Guide](https://fal.ai/learn/devs/flux-2-max-prompt-guide)
