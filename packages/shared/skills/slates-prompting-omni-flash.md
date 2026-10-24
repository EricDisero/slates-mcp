---
name: slates-prompting-omni-flash
description: "Prompt Gemini Omni Flash 1.1 video generation or edits (omni-flash, omni-flash-edit). Covers native sound, the single-scene rule, first and last frames, reference images and videos, and short change-only edit prompts."
---

# Gemini Omni Flash 1.1 — prompting

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
**Card — Gemini Omni Flash.** Two different jobs with OPPOSITE prompt rules, and getting them the wrong way round is the whole failure mode.

**The five levers**
1. **Editing: short prompt, ONE change, nothing else.** Google's own doc says so and a 2026-07-09 receipt confirms it — a long "keep every frame identical" preamble produced WORSE drift than two sentences.
2. **Editing: always end with `Keep everything else the same.`** — the one documented preservation lever.

3. **Editing: describe the EFFECT, never a real object as a metaphor.** "Candle-like flame" rendered a literal candle in the subject's hand.
4. **Editing: no chained stage directions.** Several beats cued to moments ("…flies onto his shoulder when he calls it, and perches as he walks…") hard-failed with `invalid_request`. One effect tied to an action already in the footage ("…when he snaps his fingers…") passed. Collapse to one continuous action; the model syncs to the footage's own motion.
5. **Generation: the opposite — describe fully, and say `in a single continuous shot` when you want one shot.** By default it cuts between a few shots of its own. Subject, action, setting, `camera tracking alongside`, `overcast flat light`, tone. Audio is prompt-driven with no parameters: dialogue in quotes, sound in plain language — `rain patters on the tin roof`, `a horn somewhere behind`.

**Examples**
- Edit: `Small magical flames appear on his fingertips when he snaps his fingers, and vanish when he blows on them. Keep everything else the same.`
- Generate: `In a single continuous shot, a courier in a yellow shell jacket weaves between stalled cars on a wet arterial road, camera tracking alongside at shoulder height. Overcast flat light, spray from tyres. Rain patters on car roofs, a horn somewhere behind.`

**Hard constraint:** it is the EDIT-fidelity winner for footage-synced VFX; its generation quality on our own shots is not yet measured, so a hero shot still goes to the default seat. Expect a possible jitter or doubled speech beat in the last half second of an edit: trim the tail rather than burning a re-roll.
<!-- @card:end -->

<!-- @banned:start -->
<!-- slates-only -->
<!-- MACHINE-READ. Every `backticked` token between the @banned markers is
     extracted by src/prompts/banned-tokens.ts and returned on this model's cost
     estimate, and every submitted prompt is matched against it. Keep entries
     backticked and prose outside the backticks. -->
<!-- /slates-only -->
**Never use in an EDIT prompt** (each one has a receipt above):
- a long preservation preamble — it produces WORSE drift than `Keep everything else the same.`
- a real object as a metaphor: `candle-like`, `flame-like`, `laser-like`
- several staged beats cued to moments (`when he calls it, and perches as he walks`): these hard-fail, they do not merely drift. One effect tied to an action already in the clip (`when he snaps his fingers`) passed
- harm-to-person framing: `ignite`, `catch fire`, `on fire` applied to a person trips the safety filter
<!-- @banned:end -->

Google's fast video generation + editing model ("Nano Banana Pro for video" in creator slang — a nickname; it is NOT the NB Pro image model). Version 1.1 (`gemini-omni-1.1-flash`) since 2026-10-17. 720p native, with **1080p and 4K as upscales** (Google's word), 24fps, 3–10 second clips, 16:9 or 9:16. **Audio is native and included** — dialogue, SFX, and ambient generate WITH the video at no extra cost.

## Where it routes

- **Video editing (`omni-flash-edit`) — its headline strength and the edit-lane default** for footage-synced VFX: verified 2026-07-09 head-to-head vs Kling O3 Edit on real phone footage (fire-on-fingertips on a talking take) — Omni Flash held lip movement perfectly, audio near-identical, and executed both action beats; Kling kept audio verbatim but drifted lips and missed the second beat. Full routing: slates-model-selection.
- **Drafts and iteration volume with sound**: an audio-native video seat. Ask the cost estimate for the price per resolution.
- **Hero-generation quality is still unproven.** Use the current model-routing guide for the final generation seat; the edit-fidelity receipt does not establish generation quality.

## Editing (<!-- slates-only -->`slates_edit_video`, <!-- /slates-only -->model `omni-flash-edit`) — THE RULES (receipts, not theory)

1. **SHORT PROMPT. One change. Nothing else.** Google's own doc: *"Simple prompts work best for video editing. Overly descriptive prompts can lead to unintended changes."* Live receipt 2026-07-09: a long "keep every frame/word/movement identical…" preamble produced WORSE drift (re-synthesized performance, wrong timing); the winning prompt was two sentences: *"Small magical flames appear on his fingertips when he snaps his fingers, and vanish when he blows on them. Keep everything else the same."*
2. **Always end with "Keep everything else the same."** — the one documented preservation lever.
3. **Never name a real-world object as a metaphor.** "Candle-like flame" rendered a literal candle in his hand. Describe the effect itself ("small magical flames on his fingertips").
3b. **No chained stage directions: they HARD-FAIL, not drift.** Receipt 2026-07-09: "a dragon appears behind him, flies onto his shoulder WHEN HE CALLS IT, and perches AS HE WALKS…" → deterministic `invalid_request` (2×, "could not generate with the given inputs"); collapsing to one continuous action — "A small photorealistic dragon flies in and perches on his shoulder, puffing a small breath of flame and smoke." — succeeded first try. The model syncs the change to the footage's own motion; it cannot take beat-by-beat stage directions cued to moments in the video. The winning flames prompt above ("when he snaps his fingers") shows one effect tied to an action the footage already contains is fine; which part of the dragon prompt triggered the refusal is untested beyond that.
4. **Safety filter (Google's, strict about harm-to-person):** "fingertips ignite / catch fire" → `content_policy_violation`. Frame effects as magical/harmless VFX: "small magical flames appear on his fingertips" passed. See slates-content-policy §Gemini for the substitution patterns.
5. **Expect a possible tail artifact** — jitter or a doubled final speech beat in the last ~0.5s. Plan to trim the tail on the timeline; don't burn a re-roll on it.
6. **Prompt + source clip ONLY.** No element/style reference images — identity swaps that need refs go to `kling-v3.0-omni-edit`.
7. Source clip 3–10s (trim longer clips first). Output length follows the source; billing per output second at the chosen resolution, rounded up. 720p is the default; 1080p and 4K are upscales of it. Voice editing unsupported — never ask it to change dialogue.
7b. The 2026-07-09 receipts above were measured on Omni Flash 1.0. 1.1 has not been re-measured against them yet; until it is, treat them as the best evidence, not as proven on 1.1.
8. **Ship via segment-splice** (the workflow, not the model): edit only the seconds where the change happens, splice back over the original on the timeline with the original audio underneath. Most of the deliverable stays untouched original footage — this is how the pro demos are actually assembled (gesture-only edited beats + voiceover in post).
9. Chain edits one change at a time — each edit saves as a new asset linked to its parent.

## Generation (<!-- slates-only -->`slates_generate_video`, <!-- /slates-only -->model `omni-flash`)

- **Inputs, three shapes that never mix:** prompt only (t2v); prompt + a start frame and an optional **last frame** (<!-- slates-only -->`firstFrameAssetId`, `lastFrameAssetId`, <!-- /slates-only -->i2v; it interpolates between them); or prompt + references: up to **10 reference images** (ingredient/character/environment/style asset params merge into one list) and up to **3 reference videos of 3s or less each**. With references, a start frame rides as reference image 1 (it counts toward the 10); a last frame has no slot there, so a last frame with references is refused. No audio references at all (Google: "Uploading audio references is unsupported").
- **One shot or several.** Google: *"By default Omni Flash will try to create a video with a few different shots."* For one shot, say so: `in a single continuous shot`, `no scene cuts`.
- Descriptive prompts are fine for GENERATION (the short-prompt law above is edit-specific). Structure like a shot brief: subject + action + setting + camera + lighting + tone.
- **Name references inline** the standard Slates way ("Marcus (image 1) walks…"). The endpoint also reads Google's binding tags, zero-indexed: `<IMAGE_REF_0>` for the first reference image and `<VIDEO_REF_0>` for the first reference video (for example `A cat inspired by <IMAGE_REF_0> walks through the setting in <VIDEO_REF_0>.`). Use them when a specific file must bind to a specific role.
- **Reference videos carry a likeness, not a sound.** Google: they *"work best with likenesses; any audio in a video reference is ignored"*, and reasoning across several videos *"may result in degraded model performance"*. One reference video is the safe default.
- **Timing in plain words works:** `After 3 seconds, a woman enters the scene.` Text on screen renders readably when you spell it out in quotes.
- **Strip what you do not want:** `No dialogue`, `No extra sound effects`, `No embellishments`. There is no negative-prompt field.
- **Audio is prompt-driven** — no audio parameters. Dialogue in quotes; direct sound in plain language ("rain patters on the tin roof"). Negative direction as plain instructions ("Do not show text").
- Duration is an explicit 3–10s integer param; cost scales linearly per second.

## Input conditioning (Slates handles this — know it exists)

Phone footage stores rotation as a metadata flag; models ignore it and edit the raw sideways pixels. Clips must be rotation-normalized (and oversized sources downscaled) before upload — receipt 2026-07-09: a portrait Pixel clip came back sideways until conditioned. If an edit output comes back rotated, the source wasn't normalized.

## Content notes

- Google applies its own safety filters to input images/clips and output. Uploads containing recognizable real people are restricted by Google's policy — though own-footage editing of the uploader passed on our route 2026-07-09. See slates-content-policy.
- Output carries an invisible SynthID watermark (Google-side, programmatic detection only).
