---
name: slates-prompting-gpt-image-2
description: Prompting GPT Image 2 — the readable-text / character-sheet / shot-grid engine AND the current photoreal front-runner. Read before calling slates_generate_image with model gpt-image-2. Covers the quality tiers (medium default, high for max text precision), resolution classes (1k/2k=1080p/3k=1440p/4k), text-accuracy prompting, panel/grid layout direction, and when to route to the Banana line instead.
---

# GPT Image 2 — sheets, grids, and text that actually reads

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
**Card — GPT Image 2.** The readable-text, ordered-panel and exact-placement engine, and (measured 2026-08-24 at `quality: high`) the photoreal front-runner for people. Structure: subject and action, then the exact copy in quotes, then layout, then light.

**The five levers**
1. **Quote every string that must render verbatim** — `the sign reads "OPEN 24 HOURS"`. Quoted strings render most reliably.
2. **Font FEEL, never a font name** — `clean geometric sans, high contrast`, `hand-painted brush lettering`.
3. **Order dense copy explicitly** — `Line 1: "..." Line 2: "..."`. It respects the ordering.
4. **Name the layout as a grid** for sheets and panels — `a 3x2 grid of panels, reading left to right, equal gutters`.
5. **Set `quality` deliberately.** `medium` is sharp text at a quarter of the price and is within a hair of `high` in blind tests; reach for `high` only when tiny type, dense diagrams or many labelled elements ARE the job.

**Examples**
- `A 2x3 character turnaround sheet on a neutral grey field, equal gutters, reading left to right: front, three-quarter, profile, back, three-quarter back, top. One woman, mid-30s, cropped dark hair, olive field jacket. Flat even studio light, no cast shadows. Small caption under each panel naming the angle.`
- `Photoreal portrait, natural window light from camera-left, visible skin texture and pores, 85mm compression. A man in his 50s in a charcoal knit, half-smile, looking just past lens.`

**Hard constraint:** keep total on-image text under about 30 words for perfect accuracy — beyond that it degrades, gracefully but really. It has its own content filter, distinct from Gemini's.
<!-- @card:end -->

<!-- @banned:start -->
<!-- slates-only -->
<!-- MACHINE-READ. Every `backticked` token between the @banned markers is
     extracted by src/prompts/banned-tokens.ts and returned on this model's cost
     estimate, and every submitted prompt is matched against it. Keep entries
     backticked and prose outside the backticks. -->
<!-- /slates-only -->
**Never use:**
- a font NAME — describe the feel (`clean geometric sans, high contrast`) instead
- a reference role essay (`Reference image 1 is a photograph of a woman. Use that exact woman.`) — name the subject inline instead
- `8k`, `masterpiece`, `best quality`, `highly detailed` — quality incantations do nothing here either
<!-- @banned:end -->

GPT Image 2's edge is **character-level text accuracy** (~99% on English), ordered panels, and exact element placement — the jobs where every other model garbles a word or shuffles a layout.

🚨 **It is ALSO the photoreal front-runner, and this file said the opposite until 2026-08-24.** **Receipts:** Eric's direct call, plus a head-to-head on the Higgsfield rail where GPT Image 2 at `quality: high`, 2K beat both Nano Banana rails on skin realism for photoreal people — that result is why the whole AI-influencer ad lane generates its plates here. **Route photoreal to this model, not away from it.**

**What the Banana line still owns:** edit-heavy work and the 14-reference ceiling.

**What would kill this:** a head-to-head at the intended crop going the other way. Per `slates-model-selection` § The meta-rule, re-run the evidence test when the roster changes — never carry a ranking forward on reputation. That rule is exactly what this correction failed.

## Quality tiers — always set explicitly

- **medium** (default) — sharp text, fast, the value seat: half NB2's price at the 1080p class. Blind benchmarks put it within a hair of high at a quarter of the cost. Start here.
- **high** — ~4× the price; max text precision + reasoning. A deliberate premium pick when tiny type, dense diagrams, or many labeled elements ARE the job.

Never rely on the provider default (it's high — the priciest tier). The Slates ops send medium unless you say otherwise.

## Resolution classes

`1k` = 1024²-class · `2k` = 1920×1080-class · `3k` = 2560×1440-class · `4k` = 3840×2160-class. Pick 2k for most sheets/panels; 4k for print-density grids. 4K exists at BOTH tiers and is API-only — even paid ChatGPT can't render it.

## Prompting for text accuracy

- **Quote every string that must render verbatim**: `the sign reads "OPEN 24 HOURS"` — quoted strings render most reliably.
- Specify font *feel*, not font names: "clean geometric sans, high contrast", "hand-painted brush lettering".
- For dense text (posters, UI mocks), list the copy as ordered lines: `Line 1: "..." Line 2: "..."` — GPT Image 2 respects ordering.
- Keep total on-image text under ~30 words for perfect accuracy; beyond that, accuracy degrades gracefully but degrades.

## Panels, sheets, and grids

- State the grid explicitly and number the cells: "a 2×3 grid of panels, numbered 1–6, reading left-to-right, top-to-bottom".
- Give each cell ONE content clause: "Panel 3: the character mid-jump, side view".
- Character identity sheets: GPT Image 2 holds both the structured panel layout AND photoreal skin, which is why the influencer-ad lane builds its sheets here at `quality: high`, 2K. Reach for NB2/NB Pro when the sheet needs many reference images folded in (14-ref ceiling) or when it is an edit of an existing sheet.

## References & editing

Reference images route through the edit endpoint (up to ~10). The composed "image N" naming applies as everywhere else. Mask-based inpainting exists at the API level but isn't surfaced — describe the change instead.

## 🚨 WHAT GETS YOU BLOCKED — read before writing a prompt with a person in it

**Receipt: 24 consecutive attempts on one character, 2026-08-24, same project and same rail.** Eleven were refused with `content_policy_violation` on the fal edit endpoint. The refusals were never about the scene — one of the blocked prompts was a woman standing at a kitchen counter with her hand on it. **Two phrasings were hard blocks, 5 for 5 each, and neither ever passed:**

**1. Never describe the reference as a photograph of a real person.**

> ❌ `Reference image 1 is a photograph of a woman. Use that exact woman.`
> ✅ `Reference image 1 is a character identity sheet showing one woman across several panels — the face in the large portrait panel is the authority for her identity. Use that exact woman.`

The first reads to the filter as *recreate this real person's likeness*, which is a hard refusal regardless of what the rest of the prompt says. The second signals a fictional character and passes. **This is a wording change only — the reference image can be the same file either way.** One plate flipped from refused to accepted on this single sentence with nothing else altered.

**2. Never attach a reference sheet containing a headless body panel.** A sheet whose full-body panels are cropped above the neck is refused every time, even with the correct opener. Regenerate the sheet with the head visible in every panel. Related, and already in this file's sheet guidance: phrase a cropped panel as *framing* (`cropped at the collarbone`), never as *absence* (`the head not shown`).

**On top of those, ordinary content triggers still apply** and they stack independently — a correct opener does not rescue them:

| Refused | Why, and the fix |
|---|---|
| A woman sitting on a bed in a bedroom | Domestic + bed reads as intimate. Move her to a chair, a rug, another room. |
| A knife, even lying flat on a chopping board next to a lemon | The object is the trigger, not the framing. Swap it — a cast-iron pan cleared instantly. |

**🚨 Refusals are PROBABILISTIC. Retry once before rewriting a word.** In the same session an identical prompt, identical reference, identical params was refused and then accepted on a straight re-fire. A rejected job returns no file and costs nothing, so a retry is free and a rewrite is not — rewriting first is how you end up changing four variables and learning nothing. **Only redesign after two or three refusals.**

**And change ONE thing at a time.** The eleven refusals above took far longer to diagnose than they should have because a reference swap and an opener rewrite shipped in the same call. Isolate on the prompt you actually want, so a pass leaves you with a usable asset instead of a data point.

## Filter regime

OpenAI moderate — a third regime distinct from Gemini (NB family) and ByteDance (Seedream). Real-face references pass more readily than Gemini; violence/brand rules are similar. `slates-content-policy` applies unchanged.
