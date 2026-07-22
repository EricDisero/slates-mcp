---
name: slates-vision-feedback-loop
description: Lower-level utility skill for any Slates workflow that needs to "generate, look at the result, refine, regenerate." Defines the standard inline-vision pattern. Other Slates skills compose this. Use when generating images and you need to confirm they match the brief before moving on, or when the user asks to "iterate" on an image.
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
- `slates_get_asset_video_frames` — extract N keyframes (default 3) from a video and inline them as JPEGs. You can't see video natively; this is how you "look at" a clip before refining its motion prompt.

## Pre-flight is automatic on the gen tools

`slates_generate_video`, `slates_generate_motion_transfer`, and `slates_generate_lip_sync` now show you their reference assets **inline** on the confirm response. You don't need to fetch them yourself — but you DO need to look at what comes back, revise the prompt if the references suggest a different motion/framing, and only then re-call with `confirm=true`.

## 🔴 The still-gate — never animate a bad frame

<!-- @inject:still-gate -->
**A visible defect in the still is already a STOP.** Do not animate it. Fix the frame first, then move to motion — and go to motion only when the crop passes the still scan and you genuinely need movement to confirm an uncertain edge, reflection, or object.

This is a **cost** rule as much as a craft rule: a 1080p/10s premium video generation costs many multiples of an image re-roll, and video is where a defect stops being fixable. Anything wrong in the still gets worse in motion — soft geometry mushes, broken-but-plausible objects fall apart, oily textures start crawling. **Animating a known-bad frame is the single most expensive mistake in the pipeline.** Re-rolling the image is the cheap move; re-rolling the video is not.
<!-- @end:still-gate -->

## The pattern

1. **Generate.** Call `slates_generate_image` with a prompt. The result is in your context as an image content block.
2. **Evaluate on TWO axes — they are different questions:**
   - **Brief-conformance** — what did the user actually want? Are the elements right? Composition? Lighting? Subject identity?
   - **Defects** — run the slop rubric below. *A frame can match the brief perfectly and still be slop that mushes the moment it moves.* Checking only the first axis is how a bad frame reaches an expensive video call.
3. **One of three outcomes:**
   - **Right** → save it (bind to a frame, character slot, etc.) and move on.
   - **Close, but adjustable** → refine with a specific delta, regenerate **once**.
   - **Wrong direction** → ask the user before regenerating. Don't burn credits on prompt-thrashing.

## The defect rubric — four slop tells

| Tell | What it looks like | Why it matters downstream |
|---|---|---|
| **Light with no transitions** | Flat-black pits instead of a shadow ramp; light that stops rather than falls off | Transfers onto every character or object added into that plate later |
| **Broken-but-plausible objects** | Crates, railings, hardware, mechanisms you can *almost* read but that don't resolve | Turn to mush in motion, and the model multiplies them |
| **Local logic breaks** | An effect present in only part of the frame — rain scratching one corner, wet ground under one figure | The video model's physical logic breaks along with it |
| **Oily textures** | Soapy, licked-smooth surfaces that have lost their material identity | Reflections crawl in motion; the plate can't hold continuity |

### Per-model accents — check the one you actually used

- **Nano Banana Pro** (`nano-banana-pro`) — ruler-straight symmetry, everything parallel and square, flat even light, pretty but staged/stock, textures reading as 3D render rather than photograph. **It hyperbolizes every edit**: ask for graffiti on one wall and the whole location gets tagged.
- **GPT Image 2** (`gpt-image-2`) — microcontrast to the ceiling, hard halos on every edge, no depth or bokeh, white balance pulled warm until the frame yellows, plastic licked-smooth materials. Worst tell: **one sickly texture pattern laid over the entire frame**.

> ⚠️ These are accents for **`nano-banana-pro`** and **`gpt-image-2`** specifically. `nano-banana-2` is a **different model** (Gemini 3.1 Flash Image vs NB Pro's Gemini 3 Pro Image) and we have **no evidence** about its accent. Do not inherit one — say nothing rather than warn about a failure mode you can't substantiate.

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
- **Rewrite the FULL prompt on every iteration — never a diff, never a fragment.** Change one decision, then re-emit the whole prompt so every slot still agrees with every other slot. This composes with the rule above rather than replacing it: *one delta* governs **what changes**, *full rewrite* governs **how you re-emit it**. A patched fragment leaves the old slots stale and silently contradicting the new one.
  - On **Seedance**, a re-emit must keep the `Shot N` structure intact — see `slates-prompting-seedance`.
  - **Exception — Omni Flash Edit.** Long prompts documentedly destroy its fidelity. There the rule inverts: one short instruction plus *"Keep everything else the same."*
- **Anchor with references.** If the result drifted from the user's intent, attach the *previous best* generation as a reference image alongside the original brief.
- **Use `slates_get_asset_image`** to pull a previously-generated image back into context if you need to compare against a fresh generation.
- **Use `slates_edit_image`** for surgical tweaks instead of full regeneration when ~90% of the image is right — `sourceAssetId` = the asset, `prompt` = the change only. Edits preserve composition and identity; full regen rolls the dice. Recipe: `slates-edit-and-iterate`.

## Cost discipline

- Track total credits spent across the loop. Surface to the user every 3 iterations.
- Stop after 3 failed iterations on the same prompt — escalate to the user with what you tried and what's not working. The slot machine never converges.
- For high-cost generations (above ~17 credits), confirm before *every* attempt, not just the first.

## When to break the loop

- The user said "good enough" or "ship it." Stop iterating.
- You've burned >5 generations on one frame. Hand back and ask.
- The user changes brief mid-loop. Treat it as a new brief, not a continuation.

## Voice when narrating to the user

Tight, observational, no editorializing.
- ✅ "Frame 2 has the wrong lighting direction — back-lit instead of side. Regenerating with side light."
- ❌ "I notice that the lighting in frame 2 isn't quite what we were going for. I'll go ahead and try again with a different approach."
