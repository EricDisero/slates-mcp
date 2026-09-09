---
name: slates-prompting-gpt-image-2-5
description: Prompting GPT Image 2.5 (Flare and Sunburst) — the readable-text / character-sheet / shot-grid engine AND the photoreal front-runner. Read before calling slates_generate_image with model gpt-image-2-5-flare or gpt-image-2-5-sunburst. Covers picking the variant, the five quality tiers (high is the default and the everyday seat), resolution classes (1k/2k=1080p/3k=1440p/4k), reference-image roles, text-accuracy prompting, panel/grid layout direction, edit constraints, and when to route to the Banana line instead.
---

# GPT Image 2.5 — sheets, grids, and text that actually reads

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
**Card — GPT Image 2.5.** The readable-text, ordered-panel and exact-placement engine, and the photoreal front-runner for people. Structure: subject and action, then the exact copy in quotes, then layout, then light.

**Pick the seat first.** `flare` = the small/FAST seat, quality *comparable to* GPT Image 2 — drafts, exploration, volume. `sunburst` = OpenAI's *most capable*, higher quality, slower, same price — finals, hero frames, photoreal, multi-reference edits. Explore on Flare, finish on Sunburst.

**The six levers**
1. **Quote every string that must render verbatim** — `the sign reads "OPEN 24 HOURS"`. Quoted strings render most reliably.
2. **Font FEEL, never a font name** — `clean geometric sans, high contrast`, `hand-painted brush lettering`.
3. **Order dense copy explicitly** — `Line 1: "..." Line 2: "..."`. It respects the ordering.
4. **Name the layout as a grid** for sheets and panels — `a 3x2 grid of panels, reading left to right, equal gutters`.
5. **Give every reference image a ROLE** — subject / style / clothing / background. New emphasis in 2.5 and the highest-leverage change for multi-reference work.
6. **Set `quality` deliberately.** Five rungs — `low`, `medium`, `high` (default), `xhigh`, `max` — spanning ~36× end to end, in UNEVEN steps: `max` is 4× `high`, but `xhigh` only ~1.8× it. `medium` is the draft seat; `high` is the everyday tier; reach past it only when tiny type, dense diagrams or many labelled elements ARE the job. 🚨 **Coming from GPT Image 2, the names moved one rung:** its `medium` is this `high`, its `high` is this `max` — same money, renamed ladder. Carrying an old value over silently buys a cheaper picture.

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

GPT Image's edge is **character-level text accuracy** (~99% on English), ordered panels, and exact element placement — the jobs where every other model garbles a word or shuffles a layout. 2.5 inherits all of it and is better at each.

## Which variant

**Speed → Flare. Quality → Sunburst.** That is OpenAI's own routing rule, quoted from its image-prompting guide: *"start with GPT Image 2.5 Flare when speed is the priority, or GPT Image 2.5 Sunburst when demanding quality requirements are the priority."* Same price either way, so the trade is purely latency against quality.

🚨 **FLARE IS NOT AN UPGRADE OVER GPT IMAGE 2 — IT IS THE FAST ONE.** OpenAI, verbatim: *"GPT Image 2.5 Flare is the small model, optimized for speed, with image quality **comparable to** GPT Image 2. GPT Image 2.5 Sunburst is the base model, optimized for quality, with **higher image quality than** GPT Image 2."* Their model pages agree: Flare is *"our fastest model for high-quality, everyday image generation"*, Sunburst *"our most capable model for image generation and editing."* **Sunburst is the seat that beats what we had; Flare is the one that holds it at half the latency.** An earlier revision of this file called Flare "better than GPT Image 2" and sent Sunburst only to multi-reference edits — both wrong, corrected 2026-09-09 against the vendor docs.

**The production pattern: explore on Flare, finish on Sunburst.** Drafts, layout checks and volume go to Flare. Finals, hero frames, photoreal people and any edit that must preserve identity or geometry go to Sunburst.

**Sunburst's widest lead is multi-reference editing** — several references all surviving into one frame, the character-consistency-across-shots problem. Reach for it there first, but that is not the only place it belongs.

⚠️ **The LMArena receipt, scoped.** At launch Arena had Sunburst #1 and Flare #2 across text-to-image, single-image edit and multi-image edit, with margins over GPT Image 2 of **+81 / +47** on multi-image edit (Image Edit Arena: Sunburst 1520, Flare 1491, GPT Image 2 1461). Two caveats were missing and both matter: the baseline is **GPT Image 2 at `medium`, which is this model's `high`** — not its top tier — and the boards were **preliminary, a few thousand votes each**. Arena says Flare beats GPT Image 2; OpenAI says comparable. Route on OpenAI's wording and treat the board as a tiebreaker, not a spec.

🚨 **The GPT Image line is ALSO the photoreal front-runner, and this file said the opposite until 2026-08-24.** **Receipts:** Eric's direct call, plus a head-to-head on the Higgsfield rail where GPT Image 2 at `quality: high`, 2K beat both Nano Banana rails on skin realism for photoreal people — that result is why the whole AI-influencer ad lane generates its plates here. **Route photoreal to this line, not away from it.**

⚠️ **Which SEAT reproduces it follows from the two facts above, and it is not the obvious one.** The receipt was measured on GPT Image 2 at `high`, which is this model's **`max`** — the ladder was renamed, not repriced (see `slates-model-selection`). Flare is only *comparable* to GPT Image 2, so **Flare at `max` is the floor: it holds the measured result rather than beating it.** Sunburst is documented as higher quality than GPT Image 2, which makes **Sunburst at `max` the seat most likely to exceed it** — and a photoreal final is exactly the "quality outranks speed" case OpenAI routes to Sunburst. Nobody has re-run the head-to-head on either seat, so this is reasoning from the vendor's positioning, not a measurement. **Run Flare-max against Sunburst-max on one plate before committing the lane, and write the result here.**

**What the Banana line still owns:** edit-heavy work, and holding many subjects coherently in one frame. **Not the reference ceiling any more** — that line was true until 2026-09-09, when GPT Image went to its documented 16 against Banana's 14. Route on which model keeps them all recognisable, not on the count.

**What would kill this:** a head-to-head at the intended crop going the other way. Per `slates-model-selection` § The meta-rule, re-run the evidence test when the roster changes — never carry a ranking forward on reputation. That rule is exactly what the 2026-08-24 correction failed, and exactly what the two ⚠️ notes above are honouring.

## Quality tiers — always set explicitly

All five rungs are exposed, and they span ~36× end to end (2k class: $0.0044 → $0.158), which makes this the single biggest cost lever on the model. **The steps are UNEVEN — do not reason about them as a constant multiplier:** ~2.3× `low`→`medium`, ~3.9× `medium`→`high`, ~1.8× `high`→`xhigh`, ~2.25× `xhigh`→`max`. The same ratios hold at every OFFERED resolution class (2k/3k/4k); unoffered 1k differs slightly.

| Tier | Use it for |
|---|---|
| `low` | Roughest pass — layout and composition checks, throwaway comps. |
| `medium` | The draft seat. Cheaper than NB2 Lite and available up to 4K, which is why the draft lane moved here. |
| `high` | **Default.** The everyday tier. Blind benchmarks on GPT Image 2 put this rung — which it called `medium` — within a hair of `max` (which it called `high`) at a quarter of the cost. Inherited from the old ladder, never re-run on 2.5, and it says nothing about `xhigh`. |
| `xhigh` | One rung short of the top at about half its price (2k: 4 cr against `max`'s 8). Worth trying before `max`. |
| `max` | Top of the ladder. Tiny type, dense diagrams, many labelled elements. |

⚠️ **A tier label means different things on different models.** OpenAI: *"The same quality label does not imply the same image quality or response time across models."* Flare at `max` and Sunburst at `max` are not the same picture, and neither matches Nano Banana's idea of "high".

🚨 **The tier NAMES moved between versions and the strings did not.** GPT Image 2's `medium` is this model's `high`; its `high` is this model's `max` — same money, one rung of renaming. So a recipe, a doc or a memory that says "GPT Image at medium" means **`high` here**. Getting this backwards costs picture quality silently: nothing errors, the bill is correct for what was asked, and the image is just worse.

Never rely on the provider default. fal's default is `high`, which is correct today — but it is the third rung of five rather than the top of two, so leaning on it means a fal-side change silently reprices you. The Slates ops send `high` unless you say otherwise.

**Find the tier from the top down, then walk back.** OpenAI's own procedure: *"If the output falls short, test a higher quality setting. Once it meets your requirements, test lower settings to see whether they preserve acceptable quality while reducing latency. Use `xhigh` or `max` only when they improve an unmet quality requirement within your latency budget."* A higher rung does **not** guarantee a better result on a given prompt. Compare `medium` against `high` when the job is small or dense text; that is where the rungs separate most visibly.

## Resolution classes

`1k` = 1024²-class · `2k` = 1920×1080-class · `3k` = 2560×1440-class · `4k` = 3840×2160-class. Pick 2k for most sheets/panels; 4k for print-density grids. 4K exists at every tier and is API-only — even paid ChatGPT can't render it.

`1k` is not offered, and the reason is not its price: it is strictly dominated. At 1k you pay more for fewer pixels than at 2k, at **all five tiers**. Don't ask for it.

⚠️ **Above 2560×1440 you are on a path OpenAI marks EXPERIMENTAL.** Verbatim: *"Outputs with more than 3,686,400 total pixels ('2560x1440') are experimental."* That is the whole **4k** class (≈8.0 MP) plus 3k at 4:3/3:4 (≈3.70 MP). It bills normally and it works — but prove the shot at 2k or 3k 16:9 first, and do not be surprised by an odd frame at 4k.

**Hard size bounds**, from fal's schema verbatim: each edge ≤ 3840 px, both edges multiples of 16, longer:shorter ratio ≤ 3:1, total pixels between 655,360 and 8,294,400. **The pixel ceiling is the one that actually bites** — the multiple-of-16 rule is documented but NOT enforced, and we have the receipt: 1920×1080 fails it (1080 = 67.5 × 16), is one of fal's own six priced canonical sizes, and metered clean. Slates picks sizes that respect the ceiling; these matter only if you hand-build a request.

🚨 **THE ASPECT RATIO CHANGES THE PRICE ON THIS MODEL, and on no other image model.** OpenAI bills image OUTPUT TOKENS and the count tracks the frame's SHAPE, so at the same resolution class **`1:1` costs about 1.8× and `4:3`/`3:4` about 1.37× what `16:9` costs**; `9:16` costs the same as `16:9`. Metered 2026-09-09 and priced into the cost key, so the quote you get before generating is the real number — but if you are choosing between shapes and the budget is tight, **16:9 or 9:16 is the cheap one.** Every other image model charges the same whatever the shape.

## Reference images — give every one a role

**Assign a role to every reference image: subject, style, clothing, or background.** This is new emphasis in 2.5 and the highest-leverage change for the 16-reference character lane. An unroled pile of references makes the model guess what each one is for, and it guesses differently every run — which is the drift people mistake for a consistency failure.

Reference images route through the edit endpoint, **up to 16** — fal's documented `maxItems`, and the highest reference ceiling of any image seat in Slates (the Banana line takes 14). It was capped at 10 until 2026-09-09, which was never anybody's limit, just a number nobody had checked. The composed "image N" naming applies as everywhere else. Mask-based inpainting exists at the API level but is not surfaced: a mask is something the user has to paint, and there is no painting surface — describe the change instead.

## Editing — separate the change from the constraints

**State the change, then list what must survive.** "Change only X," then name the invariants explicitly: identity, geometry, lighting, labels. For precise local edits also pin saturation, contrast, camera angle and surrounding objects — anything you do not pin is fair game for the model to move.

**One change per iteration, and restate the constraints every turn.** Cross-turn drift is the named failure mode in OpenAI's own guidance: constraints do not persist across turns by themselves, so a multi-turn refinement that stops restating them will slowly rewrite the frame. This applies directly to multi-turn shot refinement.

## Prompting for text accuracy

- **Quote every string that must render verbatim**: `the sign reads "OPEN 24 HOURS"` — quoted strings render most reliably.
- Say the text appears **once**, and give its position and typography.
- Spell unusual words letter-by-letter.
- Add `no extra text, no watermarks`.
- Specify font *feel*, not font names: "clean geometric sans, high contrast", "hand-painted brush lettering".
- For dense text (posters, UI mocks), list the copy as ordered lines: `Line 1: "..." Line 2: "..."` — it respects ordering.
- **Don't bundle unrelated instructions into a text-rendering request.** A prompt that also redesigns the scene competes with the text for attention.
- Keep total on-image text under ~30 words for perfect accuracy; beyond that, accuracy degrades gracefully but degrades.

## Transparent backgrounds

If you need a cut-out rather than a scene, **ask for it explicitly and check the alpha**. OpenAI: request `background=transparent` and use PNG or WebP, then *"check the decoded image's alpha channel, including hair, glass, shadows, and object edges"* — a painted-white backdrop is the common failure and it is not transparency. Say what must NOT appear: *"no solid backdrop, no checkerboard, no scenery, no watermark"*, and do not let the product get restyled while the background is removed. **On every follow-up edit, repeat the transparency requirement** or it gets dropped. (Slates always requests PNG, so the format half is handled for you. **`background` IS surfaced now** — the Background control on the prompt bar, and `backgroundMode` on `slates_generate_image` / `slates_edit_image`. It is free: fal prices this family on size × quality alone.)

## When an edit must not touch a region at all

Prompting alone cannot guarantee pixel-identical pixels. OpenAI's own instruction: if a region must stay exactly as it was, **composite the approved edit back into the original image** rather than asking the model to preserve it. Treat "preserve" language as a strong bias, never a lock.

## Structure a complex prompt in labeled sections

For anything with several requirements, OpenAI recommends organising the prompt as **scene, subject, details, constraints** with labeled sections. Same content, easier to read and to change one part without disturbing the rest — which is what makes the one-change-per-iteration rule practical.

**Say "photorealistic" or "real photograph" when that is the goal.** It is not inferred from a detailed description; ask for it directly, then describe framing and texture.

## Concrete visuals beat mood words

Name materials, lighting, colour and medium. Mood words are cues only — "cinematic", "moody", "epic" tell the model almost nothing on their own. Give scale, atmosphere and colour instead. Camera specs (`85mm`, `f/1.4`) are appearance hints, not a physical simulation; they bias the look, they do not compute optics.

**For people, state body framing and scale**: "full body visible, feet included", "hands naturally gripping the handlebars". This is also the safest way to phrase a crop — see the blocked-phrasings section below.

**No special syntax is required.** Prose, JSON and tagged blocks all work equally well, so pick whatever stays maintainable in the caller.

## Panels, sheets, and grids

- State the grid explicitly and number the cells: "a 2×3 grid of panels, numbered 1–6, reading left-to-right, top-to-bottom".
- Give each cell ONE content clause: "Panel 3: the character mid-jump, side view".
- Character identity sheets: GPT Image holds both the structured panel layout AND photoreal skin, which is why the influencer-ad lane builds its sheets here. Reach for NB2/NB Pro when it is an edit of an existing sheet, or when many subjects have to stay recognisable at once — not for the reference count, which GPT Image now leads at 16.

## 🚨 WHAT GETS YOU BLOCKED — read before writing a prompt with a person in it

**Receipt: 24 consecutive attempts on one character, 2026-08-24, same project and same rail.** Eleven were refused with `content_policy_violation` on the fal edit endpoint. The refusals were never about the scene — one of the blocked prompts was a woman standing at a kitchen counter with her hand on it. **Two phrasings were hard blocks, 5 for 5 each, and neither ever passed:**

**1. Never describe the reference as a photograph of a real person.**

> ❌ `Reference image 1 is a photograph of a woman. Use that exact woman.`
> ✅ `Reference image 1 is a character identity sheet showing one woman across several panels — the face in the large portrait panel is the authority for her identity. Use that exact woman.`

The first reads to the filter as *recreate this real person's likeness*, which is a hard refusal regardless of what the rest of the prompt says. The second signals a fictional character and passes. **This is a wording change only — the reference image can be the same file either way.** One plate flipped from refused to accepted on this single sentence with nothing else altered.

**2. Never attach a reference sheet containing a headless body panel.** A sheet whose full-body panels are cropped above the neck is refused every time, even with the correct opener. Regenerate the sheet with the head visible in every panel. Related, and already in this file's sheet guidance: phrase a cropped panel as *framing* (`cropped at the collarbone`), never as *absence* (`the head not shown`).

⚠️ **These refusals were measured on GPT Image 2, not on 2.5.** The classifier belongs to OpenAI rather than to a model version, so the phrasing rules carry — but they are inherited, not re-measured. If Flare or Sunburst accepts one of the blocked phrasings, that is a new receipt to write down here, not a reason to delete this one.

**On top of those, ordinary content triggers still apply** and they stack independently — a correct opener does not rescue them:

| Refused | Why, and the fix |
|---|---|
| A woman sitting on a bed in a bedroom | Domestic + bed reads as intimate. Move her to a chair, a rug, another room. |
| A knife, even lying flat on a chopping board next to a lemon | The object is the trigger, not the framing. Swap it — a cast-iron pan cleared instantly. |

**🚨 Refusals are PROBABILISTIC. Retry once before rewriting a word.** In the same session an identical prompt, identical reference, identical params was refused and then accepted on a straight re-fire. A rejected job returns no file and costs nothing, so a retry is free and a rewrite is not — rewriting first is how you end up changing four variables and learning nothing. **Only redesign after two or three refusals.**

**And change ONE thing at a time.** The eleven refusals above took far longer to diagnose than they should have because a reference swap and an opener rewrite shipped in the same call. Isolate on the prompt you actually want, so a pass leaves you with a usable asset instead of a data point.

## Filter regime

OpenAI moderate — a third regime distinct from Gemini (NB family) and ByteDance (Seedream). Real-face references pass more readily than Gemini; violence/brand rules are similar. `slates-content-policy` applies unchanged.
