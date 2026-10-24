---
name: slates-prompting-flux-3
description: "Prompt or edit images with FLUX 3 Image (flux-3). Use with slates_generate_image or slates_edit_image on this model; covers plain-sentence prompts, numbered references, edits, quoted text and positive phrasing."
---

# FLUX 3 Image — prompting

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
**Card — FLUX 3 Image.** Short prompts work; add detail only where you want control. Write sentences that name visible things — the subject, what it does, where, the light, the medium — not a tag list.

**The five levers**
1. **Name visible things in plain sentences.** `A chef plates a dish at a steel kitchen pass under overhead fluorescents.` beats a list of adjectives.
2. **Name the style concretely** — a medium, an era, a camera or a film stock (`35mm documentary photograph, Kodak Portra 400`), never "nice style".
3. **One or two strong effects, not five.** A single lighting idea and a single lens idea read cleaner than a stack.
4. **Number references as the images arrive: "image 1" is the first.** Say what each one supplies; in an edit the base image is image 1 and comes first.
5. **Quote text that must render**, with its case, placement and type: `the word "OPEN" in thin uppercase red neon above the door`.

<!-- @inject:cinematic-card -->
**For a photographic look, use only what this frame needs.** Image models default to clean, evenly lit and fully exposed. Describe what the camera sees, not just gear or mood:
- **Inspect every reference first.** Write its grade and imperfections in words: darkness, contrast, muddy or true blacks, colour, softness/noise, subject separation. Never grade cleaner or brighter than the look reference unless asked.
- **One light system** — `low sun behind her`, `her face falls into deep shadow`, `no light in front of her`.
- **Visible exposure** — `the sky burns out to white`, `dense, slightly crushed shadows`.
- **Lens name plus effect** — `200mm telephoto`, `peaks loom huge behind her and melt into soft shapes`.
- **Name every garment and close the foreground.** Omissions invite reference leakage or invented props.
Bind references inline. A scene reference owns the grade; for a look-only reference, write the new scene's light. References are optional. For owned-frame edits, describe only the change and what stays.
<!-- slates-only -->Use `slates-cinematic-look` with a technique ID or section query for more.<!-- /slates-only -->
<!-- @end:cinematic-card -->

**Hard constraint:** no negative prompting. Rewrite every "no X" as what is there — `no blur` becomes `sharp focus throughout`, `no people` becomes `empty scene`, `no harsh shadows` becomes `soft, diffused lighting`.
<!-- @card:end -->

<!-- @banned:start -->
<!-- slates-only -->
<!-- MACHINE-READ. Every `backticked` token between the @banned markers is
     extracted by src/prompts/banned-tokens.ts and returned on this model's cost
     estimate, and every submitted prompt is matched against it. Keep entries
     backticked and prose outside the backticks. -->
<!-- /slates-only -->
**Never use** — there is no negative prompting, so each of these has a positive form:
- `no blur` (say `sharp focus throughout`), `no people` (say `empty scene`), `no harsh shadows` (say `soft, diffused lighting`)
- `masterpiece`, `best quality`, `trending on artstation`, `8k` — quality tags name nothing visible
<!-- @banned:end -->

**Examples**
- `A chef plates a dish at a steel kitchen pass. Overhead fluorescents with warm spill from the line. 35mm documentary photograph, natural skin texture.`
- `An empty municipal pool at dusk, cracked teal tiles, early digital camera with slight noise and flash falloff. Candid, unstaged.`

Black Forest Labs' FLUX 3 Image, released 2026-10-01.<!-- slates-only --> In Slates: `slates_generate_image` with `model: flux-3` (REQUIRES projectId — no headless path), priced per resolution (1k/2k/4k — call `slates_estimate_generation_cost` for current numbers, never quote from memory). It replaced FLUX.2 Max on 2026-10-23; takes made on FLUX.2 Max keep their label. It is the less-filtered premium image seat, sent at the loosest safety setting the model offers. With references it routes to its edit endpoint, which takes up to 10 images.<!-- /slates-only -->

## Core approach — plain sentences, short first

BFL's FLUX 3 guide: short prompts work, and detail goes where you want control. Write sentences that name visible things. Quality tags ("masterpiece", "8k") add nothing visible and are left out.

```
[Subject and action]. [Setting]. [Light]. [Medium or style, named concretely].
```

Start short. If the frame misses something, add the sentence that names it, rather than more adjectives on the sentences you have.

## Style — name it concretely

Name the medium, era, camera or film stock you want: `35mm documentary photograph`, `early digital camera, slight noise, flash photography, candid`, `film grain, warm color cast, soft focus`, `flat vector illustration with two spot colors`. "Cinematic" or "nice style" alone names nothing.

Keep effects to one or two. One lighting idea (`low sun behind her, face in shadow`) and one lens idea (`telephoto compression`) beat a stack of five.

## No negative prompts — say what is there

FLUX 3 has no negative prompt. Describe the presence you want, not the absence:

- ❌ "no blur" → ✅ "sharp focus throughout"
- ❌ "no people" → ✅ "empty scene"
- ❌ "no harsh shadows" → ✅ "soft, diffused lighting"

## Text rendering

Put the exact text in quotation marks, then give its case, placement and type:

```
The word "OPEN" in thin uppercase red neon letters above the door
A poster headline "LAST CALL" in heavy condensed capitals across the top third
```

## Reference images and edits

**BFL's numbering: "Image 1" is the first image sent, "image 2" the second, counting from one.** Name what each image supplies — `the jacket from image 2`, `lit and graded like image 3`. In an edit the base image is image 1 and is named first: describe the change, then what stays.<!-- slates-only --> Slates sends references in the order it cites them, so the numbers in the prompt match.<!-- /slates-only -->

- **Up to 10 images per request**, each at least 256 px on its shortest side; larger images are scaled down to about 4 MP.
- Pass `referenceAssetIds` on `slates_generate_image` and FLUX 3 routes them through its edit endpoint.<!-- slates-only --> For surgical changes to one existing image use `slates_edit_image` with `editModel: flux-3`; the source takes one of the 10 slots.<!-- /slates-only -->
- <!-- slates-only -->The edit is priced per image whatever the number of references, so a reference costs nothing extra.<!-- /slates-only -->

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
2. **One reference per ROLE, named in the prompt** — identity / style-grade / environment. The model does **not** infer a reference's role from its position in the list; the inline name carries it. Same-role competitors drift (two "identity" refs of different people blend into a third face). Slates resolves `@mentions` / `#tags` into numbered citations. You can also bind references directly in scene prose, naming what each image supplies.
3. **One identity sheet per character, named inline.** A character's identity is a single asset (dominant portrait + body panels), so attach that one asset rather than a pile of views: **fewer competing renderings of a face is better, because the model cannot tell which one is authoritative and averages them.** Slates cites it as `Marcus (image 1)`. **Do NOT hand-write a "Reference Image Instructions" block or role essays** ("use for identity, ignore the outfit, render a neutral expression") — that drags the sheet's studio lighting and wardrobe into a scene that asked for neither. The prompt leads; the user's words own wardrobe, expression, lighting, and action.
4. **Flat-light identity refs.** Prep identity references with flat, even, shadowless lighting on a plain neutral background. A studio-lit or scene-lit character sheet bleeds its lighting into every generation — the failure looks like the subject was green-screen-pasted in front of the location. Reference prep beats prompting here.
5. **Environment: describe it, don't feed a grid.** Default to describing the location in words and let the model build a space that fits the shot. Reserve an environment reference for a mandatory exact-match, and then use ONE clean establishing image with natural ambient light that reads as the location's real light — never a multi-panel grid fed whole.
6. **Grids: explore, don't input.** Use grids to explore compositions cheaply, then pick a cell. Never feed a grid back in as a reference — the cells share a split detail budget and were generated jointly, so their flaws propagate.
7. **Reuse the same refs across every shot** in a sequence. Lock a set and keep it; swapping references mid-sequence causes drift, because the model adapts each reference to the current prompt rather than copying it.
8. **Legible in-shot text → bake it into a still start frame, never trust text-to-video.** Have an image model render the text, then animate from that locked frame. Video models smear type.
9. **Working from existing media — describe ONLY what changes.** The source already carries its composition, motion, timing, and performance; re-describing them fights the model. Narrate the delta. (Video lane: restyle your own clip while keeping the performance; delayed-VFX on "video one"; marker-object insertion; video-as-reference for a series.)
10. **Style transforms happen in natural language.** By default the source's artistic medium and visual style are inherited. To change it, add a plain-text instruction ("anime → real person"). There are no preset pickers, and there is no style slider.
<!-- @end:reference-rules-core -->

### For FLUX 3 specifically

- **The number is the binding.** "Image 1" is the first image sent; a sentence saying what it supplies ties it to the scene.
- **No memory between generations, so rule 7 is enforced by repetition.** Define a character exhaustively once and repeat those exact descriptors in every later prompt, alongside the same references.

## Common failure modes + fixes

| Failure | Fix |
|---|---|
| Generic "AI look" on photoreal | Name the medium concretely (a camera, a stock, an era) instead of "professional photo" |
| Text garbled | Quote the exact string; give case, placement and type |
| Multi-reference blend | Say what each numbered image supplies; one image per role |
| Wanted element missing | Add a sentence that names it |
| Overworked, muddy frame | Cut to one or two effects |

## Pre-flight: references arrive inline, refer by code

When you pass `referenceAssetIds`, the first call returns the references **inline as image content blocks** with a cost estimate and `requires_confirm: true`. Look at them — revise the prompt if they suggest a different composition or style — then re-call with `confirm=true`. Refer to each asset by its short code (`IMG-A12 — Beach Sunset`) when talking to the user; it matches the badge on their gallery thumbnail.

<!-- slates-only -->
Routing against Nano Banana 2.1, GPT Image 2.5 and Seedream: `slates-model-selection`.
<!-- /slates-only -->

## Sources

- Black Forest Labs, FLUX 3 prompting guide (read 2026-10-23).
- The FLUX 3 Image API schemas for text-to-image and edit-image (read 2026-10-23).
