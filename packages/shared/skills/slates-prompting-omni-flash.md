---
name: slates-prompting-omni-flash
description: How to prompt Gemini Omni Flash (Google, via fal). Read before calling slates_generate_video with omni-flash or slates_edit_video with omni-flash-edit. Cheap 720p tier with native synced audio included — 3-10s, 16:9/9:16 only; t2v, single-start-frame i2v, or reference-to-video with up to 7 reference images. The edit variant is the EDIT-FIDELITY WINNER for footage-synced VFX (receipt 2026-07-09) — but ONLY with short prompts: one change + "Keep everything else the same." Long descriptive prompts destroy fidelity.
---

# Gemini Omni Flash — prompting

Google's fast video generation + editing model ("Nano Banana Pro for video" in creator slang — a nickname; it is NOT the NB Pro image model). Carried on fal (`google/gemini-omni-flash*`). 720p only, 24fps, 3–10 second clips, 16:9 or 9:16. **Audio is native and included** — dialogue, SFX, and ambient generate WITH the video at no extra cost.

## Where it routes

- **Video editing (`omni-flash-edit`) — its headline strength and the edit-lane default** for footage-synced VFX: verified 2026-07-09 head-to-head vs Kling O3 Edit on real phone footage (fire-on-fingertips on a talking take) — Omni Flash held lip movement perfectly, audio near-identical, and executed both action beats; Kling kept audio verbatim but drifted lips and missed the second beat. Full routing: slates-model-selection.
- **Cheap drafts and iteration volume** — lowest-cost audio-native video seat (~6.4 cr/s at 720p).
- **NOT hero GENERATION shots** — Kling 3.0 stays the general gen default, Seedance 2.0 the premium tier; Omni Flash's *generation* quality seat is still unproven.

## Editing (`slates_edit_video`, model `omni-flash-edit`) — THE RULES (receipts, not theory)

1. **SHORT PROMPT. One change. Nothing else.** Google's own doc: *"Simple prompts work best for video editing. Overly descriptive prompts can lead to unintended changes."* Live receipt 2026-07-09: a long "keep every frame/word/movement identical…" preamble produced WORSE drift (re-synthesized performance, wrong timing); the winning prompt was two sentences: *"Small magical flames appear on his fingertips when he snaps his fingers, and vanish when he blows on them. Keep everything else the same."*
2. **Always end with "Keep everything else the same."** — the one documented preservation lever.
3. **Never name a real-world object as a metaphor.** "Candle-like flame" rendered a literal candle in his hand. Describe the effect itself ("small magical flames on his fingertips").
3b. **No conditional timing cues — they HARD-FAIL, not drift.** Receipt 2026-07-09: "a dragon appears behind him, flies onto his shoulder WHEN HE CALLS IT, and perches AS HE WALKS…" → deterministic `invalid_request` (2×, "could not generate with the given inputs"); collapsing to one continuous action — "A small photorealistic dragon flies in and perches on his shoulder, puffing a small breath of flame and smoke." — succeeded first try. The model syncs the change to the footage's own motion; it cannot take beat-by-beat stage directions cued to moments in the video.
4. **Safety filter (Google's, strict about harm-to-person):** "fingertips ignite / catch fire" → `content_policy_violation`. Frame effects as magical/harmless VFX: "small magical flames appear on his fingertips" passed. See slates-content-policy §Gemini for the substitution patterns.
5. **Expect a possible tail artifact** — jitter or a doubled final speech beat in the last ~0.5s. Plan to trim the tail on the timeline; don't burn a re-roll on it.
6. **Prompt + source clip ONLY.** No element/style reference images — identity swaps that need refs go to `kling-v3.0-omni-edit`.
7. Source clip 3–10s (trim longer clips first). Output length follows the source; billing per output second, rounded up. Voice editing unsupported — never ask it to change dialogue.
8. **Ship via segment-splice** (the workflow, not the model): edit only the seconds where the change happens, splice back over the original on the timeline with the original audio underneath. Most of the deliverable stays untouched original footage — this is how the pro demos are actually assembled (gesture-only edited beats + voiceover in post).
9. Chain edits one change at a time — each edit saves as a new asset linked to its parent.

## Generation (`slates_generate_video`, model `omni-flash`)

- **Inputs:** prompt only (t2v), prompt + ONE start frame (`firstFrameAssetId`, i2v), or prompt + up to **7 reference images** (ingredient/character/environment/style asset params — they merge into one reference list). No last frame, no video/audio references — the op rejects them.
- Descriptive prompts are fine for GENERATION (the short-prompt law above is edit-specific). Structure like a shot brief: subject + action + setting + camera + lighting + tone.
- **Name references inline** the standard Slates way ("Marcus (image 1) walks…"). The endpoint also accepts explicit `<IMAGE_REF_0>`-style binding tags (zero-indexed) — useful when a specific image must bind to a specific role.
- **Audio is prompt-driven** — no audio parameters. Dialogue in quotes; direct sound in plain language ("rain patters on the tin roof"). Negative direction as plain instructions ("Do not show text").
- Duration is an explicit 3–10s integer param; cost scales linearly per second.

## Input conditioning (Slates handles this — know it exists)

Phone footage stores rotation as a metadata flag; models ignore it and edit the raw sideways pixels. Clips must be rotation-normalized (and oversized sources downscaled) before upload — receipt 2026-07-09: a portrait Pixel clip came back sideways until conditioned. If an edit output comes back rotated, the source wasn't normalized.

## Content notes

- Google applies its own safety filters to input images/clips and output. Uploads containing recognizable real people are restricted by Google's policy — though own-footage editing of the uploader passed on our route 2026-07-09. See slates-content-policy.
- Output carries an invisible SynthID watermark (Google-side, programmatic detection only).
