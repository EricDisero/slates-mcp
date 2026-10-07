---
name: slates-vision-feedback-loop
description: "Inspect generated media against the brief, diagnose defects and choose a targeted correction. Use during production or iteration; covers reference review, image defects and model-specific failure receipts."
---

# Vision feedback loop — Slates utility skill

Slates returns generated images inline as base64. You see the actual pixels. Use that — don't trust prompt-following blindly.

## Asset codes are your shared vocabulary with the user

Every asset in Slates has a short stable code (e.g. `IMG-A12`, `VID-V3`, `AUD-S1`) and a label derived from its prompt (e.g. `Beach Sunset`). These are visible in the gallery as a corner badge on each thumbnail. **Always refer to assets by their code in chat** so the user can match what you're saying to a specific card in their gallery.

- ✅ "I'm using **IMG-A12 — Beach Sunset** as the first frame. The second-frame candidate **IMG-A15** has the right composition but warmer light — want me to use that one instead?"
- ❌ "I'm using the beach sunset image..." (user has four beach sunset variants — which one?)
- ❌ "I'm using asset `7a3f9e4b-...`" (UUIDs aren't readable; user can't match to a badge)

The code is the FORMAL reference. The label is human texture. Use both: `IMG-A12 — Beach Sunset`.

## Vision tools at your disposal

- `slates_get_asset_image` — pull one image into context. Returns its code+label.
- `slates_get_assets_batch` — pull up to 8 images in one call. Use when picking from a candidate set; cheaper than N individual fetches.
- `slates_get_asset_video_frames` — extract N keyframes (default 3) from a video and inline them as JPEGs. These sampled stills support appearance, framing and identity checks. They do not verify continuous motion, lip sync or sound. Use actual playback or an audio-capable host for those claims when available; otherwise report them unreviewed and retain the saved asset.

## Pre-flight is automatic on the gen tools

`slates_generate_video` and `slates_generate_image` show you their reference assets **inline** on the confirm response. You don't need to fetch them yourself, but you DO need to look at what comes back, revise the prompt if the references suggest a different motion/framing, and only then re-call with `confirm=true`.

## 🔴 The still-gate — never animate a bad frame

<!-- @inject:still-gate -->
**Inspect a start frame before animating it.** Repair a visible defect that would make the intended crop or performance unusable before spending on motion. A clean frame can be animated whenever the brief calls for movement; this check does not require an image stage for text-to-video.

This is a cost rule as well as craft: a premium video call can cost many times an image correction. Broken geometry can turn to mush, oily textures can crawl and malformed objects can fall apart in motion. Fix a known source defect at the source instead of buying a more expensive copy. Judge intentional stylisation against the brief, not a universal photoreal standard. Additional image or video requests still follow the existing generation authorization.
<!-- @end:still-gate -->

## The pattern

1. **Generate.** Call `slates_generate_image` with a prompt. The result is in your context as an image content block.
2. **Evaluate on TWO axes — they are different questions:**
   - **Brief-conformance** — what did the user actually want? Check the four edges first: a subject cut off by the frame (a lighthouse missing its lantern, a head cropped at the brow) is a defect unless the brief asked for that crop. Then: are the elements right? Composition? Lighting? Subject identity?
   - **Defects** — run the slop rubric below. *A frame can match the brief perfectly and still be slop that mushes the moment it moves.* Checking only the first axis is how a bad frame reaches an expensive video call.
3. **One of three outcomes:**
   - **Right** → save it (bind to a frame, character slot, etc.) and move on.
   - **Close, but adjustable** → refine with a specific delta, regenerate **once**.
   - **Wrong direction** → diagnose the failed requirement. Refine within the supplied brief and existing authorization; ask only when the creative intent is unresolved or the next request needs fresh consent.

## The defect rubric — five slop tells

| Tell | What it looks like | Why it matters downstream |
|---|---|---|
| **Light with no transitions** | Flat-black pits instead of a shadow ramp; light that stops rather than falls off | Transfers onto every character or object added into that plate later |
| **Broken-but-plausible objects** | Crates, railings, hardware, mechanisms you can *almost* read but that don't resolve | Turn to mush in motion, and the model multiplies them |
| **Local logic breaks** | An effect present in only part of the frame — rain scratching one corner, wet ground under one figure | The video model's physical logic breaks along with it |
| **Oily textures** | Soapy, licked-smooth surfaces that have lost their material identity | Reflections crawl in motion; the plate can't hold continuity |
| **Too perfect** | A soft light on the face that nothing in the scene could cast, the subject sharper and cleaner than everything around them, every region exposed to be readable, colour pushed warm and saturated | It reads as a subject pasted onto a location, and every shot built from the plate inherits the studio look. Fix it in words: `slates-cinematic-look` |

### Per-model accents — check the one you actually used

- **Nano Banana Pro** (`nano-banana-pro`) — ruler-straight symmetry, everything parallel and square, flat even light, pretty but staged/stock, textures reading as 3D render rather than photograph. **It hyperbolizes every edit**: ask for graffiti on one wall and the whole location gets tagged.
- **GPT Image** (`gpt-image-2-5-flare`, `gpt-image-2-5-sunburst`) — microcontrast to the ceiling, hard halos on every edge, no depth or bokeh, white balance pulled warm until the frame yellows, plastic licked-smooth materials. Worst tell: **one sickly texture pattern laid over the entire frame**. ⚠️ Catalogued on `gpt-image-2`, which 2.5 replaced on 2026-09-09 — an accent is a per-model observation, so treat this as a prior to check rather than a finding, and correct it here the first time a 2.5 frame disagrees.

> ⚠️ These are accents for **`nano-banana-pro`** and the **GPT Image** line specifically. `nano-banana-2` is a **different model** (Gemini 3.1 Flash Image vs NB Pro's Gemini 3 Pro Image) and we have **no evidence** about its accent. Do not inherit one — say nothing rather than warn about a failure mode you can't substantiate. That caution applies to the GPT Image entry above too: it was measured on `gpt-image-2`, not on either 2.5 seat.

## Where the fault lives — triage before you change anything

We say "one specific delta per regeneration" but that only helps once you know *which* variable to move. Diagnose first:

| Visible pattern | Diagnosis | Fix |
|---|---|---|
| The defect exists in the source asset, or stays tied to the same feature when the direction changes | **Source asset** | Fix the sheet / plate, not the prompt |
| Source is clean, and the defect changes when only the suspect motion clause changes | **Motion direction** | Fix the prompt |
| Controls conflict, or the failure follows neither variable | **Inconclusive** | Narrow the test — change less, not more |

**Review routes; it is not pass/fail.** Geography melts → fix the location. Identity drifts → fix the character sheet. Assets are sound but the action is wrong → fix the video direction. Wrong idea entirely → reopen the brief with the user.

**Correct the earliest broken handoff.** Polishing a downstream symptom hides the source and guarantees it resurfaces in the next shot built from the same asset.

## Baseline hygiene — isolate the variable you're testing

When the **character** is the question, keep the location out of it: test on a plate that already holds its own geometry, depth, materials, and light. **A broken plate gives every character failure a second plausible cause**, and you will spend re-rolls deciding which one you're looking at. The same applies in reverse — test a plate empty before you populate it.

## Refinement rules

- **One specific delta per regeneration.** Don't change five things at once — you won't know what helped.
- **A fresh generation needs a complete coherent prompt.** Change one decision and retain the unchanged requirements so old and new clauses do not conflict. An edit request uses its model's change-only grammar instead; do not turn a surgical edit into a full scene re-description.
  - On **Seedance**, retain the selected model's structure: shot numbers for 2.0, whole-second timing where used for 2.5. See the matching model guide.
  - **Exception — Omni Flash Edit.** Long prompts documentedly destroy its fidelity. There the rule inverts: one short instruction plus *"Keep everything else the same."*
- **Anchor with references.** If the result drifted from the user's intent, attach the *previous best* generation as a reference image alongside the original brief.
- **Use `slates_get_asset_image`** to pull a previously-generated image back into context if you need to compare against a fresh generation.
- **Use `slates_edit_image`** for surgical tweaks instead of full regeneration when ~90% of the image is right — `sourceAssetId` = the asset, `prompt` = the change only. Edits preserve composition and identity; full regen rolls the dice. Recipe: `slates-edit-and-iterate`.

## Cost discipline

- Track total credits spent across the loop. Surface to the user every 3 iterations.
- Use the repeated-failure checkpoint below; do not keep submitting an unchanged failed request.
- **Follow the existing consent for every attempt.** An approved enumerated batch covers its listed calls. A retry or changed input outside that batch needs a new quote and the applicable confirmation; a timeout requires a status check before another submission.

<!-- @inject:iteration-diagnosis -->
## Diagnose repeated failures

After three failed attempts at the same requirement, pause unchanged re-rolls and diagnose the source reference, prompt structure, model fit and tool result. Three is a review checkpoint, not a universal limit or proof that the seed cannot matter. Preserve the attempts and name what each test changed.

Continue autonomously when the brief is clear, a specific correction is supported and the next request is already authorized. Hand control back when taste or intent cannot be inferred, the next request needs fresh consent, or the available tool cannot meet the requirement. A failed roll never authorizes an additional charge. Follow the existing batch and per-request cost policy.
<!-- @end:iteration-diagnosis -->

## When to break the loop

- The user said "good enough" or "ship it." Stop iterating.
- Repeated attempts show no progress. Diagnose the source, prompt or model before spending again; apply the scoped retry rule above.
- The user changes brief mid-loop. Treat it as a new brief, not a continuation.

## Voice when narrating to the user

Tight, observational, no editorializing.
- ✅ "Frame 2 has the wrong lighting direction — back-lit instead of side. Regenerating with side light."
- ❌ "I notice that the lighting in frame 2 isn't quite what we were going for. I'll go ahead and try again with a different approach."
