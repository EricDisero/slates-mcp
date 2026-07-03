---
name: slates-one-prompt-film
description: The full one-prompt-to-finished-film pipeline in Slates — script, project, characters, storyboard, frame images, video generation, timeline assembly, MP4 export. Use when the user gives one idea and wants a finished video out the other end - "make me a video about X", "turn this idea into an ad", "make a short film from this", "one prompt, finished film". This is the master recipe; other Slates skills are its sub-steps.
---

# One prompt → finished film — Slates master pipeline

The user gives an idea. You hand back an MP4 on disk. Everything in between is yours, with exactly TWO mandatory user checkpoints: the creative plan, and ONE aggregated cost approval.

## The pipeline

### 1. Script the beats
Turn the idea into a beat-level script: 4-10 shots, each with subject, action, setting, camera, and duration (4-8s per shot). Surface it as a tight table. Get the user's nod on the plan, format (aspect ratio — 16:9 vs 9:16 decides everything downstream), and rough budget appetite before touching any op.

### 2. Set up the project
- `slates_create_project` named for the piece.
- Recurring character? Build it properly — `slates_create_character` + the `slates-character-turnaround` recipe — so every frame references the same turnaround.
- Recurring location? `slates_create_environment`.
- One-off shots don't need character/environment records; skip the ceremony.

### 3. Storyboard skeleton (no generation yet)
- `slates_create_storyboard`, `slates_add_scene` per script scene.
- Structure first, spend second — the user catches script problems on the free skeleton, not on burned credits.

### 4. ONE aggregated cost approval — then hands-off
Price the whole batch before the first generation: frame images (count × model — `slates_estimate_generation_cost`) + video gens (count × model × duration). Present a single total:

> Plan: 6 frames at 1k 16:9 + 5 × 8s Kling 3.0 std + 1 × 8s Seedance 2 hero shot ≈ $X.XX total. Proceed with the batch?

Per `slates-cost-discipline` 3b: that single OK authorizes `confirm=true` for **every enumerated call in the batch** — no per-call re-asking. Re-confirm only if a call's price overruns the plan >25% or new calls get added (extra retakes, new shots).

### 5. Generate frame images
Per shot: `slates_generate_image` with `referenceAssetIds` pointing at the character turnaround / environment / prior frames for consistency (Slates names each reference inline as "image N" — you don't hand-write role labels; reuse the same subject name across shots). Evaluate every result inline against the beat. Bind keepers via `slates_add_frame`.

**Multi-take where it matters:** for the hook shot and any shot the whole film hangs on, generate 2-4 variants (cheap model or 1k), pull them back with `slates_get_assets_batch`, pick the strongest on composition + identity, discard the rest. Don't multi-take filler shots.

### 6. Generate video per frame — background mode
`slates_generate_video` with `firstFrameAssetId` = the bound frame, `background: true`. Submit ALL shots, collect the generationIds, then poll `slates_get_generation_status` every 10-15s (1-5 min per gen; they survive app restarts). This parallelizes a 6-shot film into one wait instead of six.

**Model mixing — route per `slates-model-selection`** (details in the per-model guides):
- **Kling V3** (`slates-prompting-kling-v3`): the DEFAULT for most shots — any aspect ratio, 5-15s, strong start-frame adherence; std is the workhorse, Omni for multi-character dialogue.
- **Seedance 2** (`slates-prompting-seedance`): the PREMIUM tier — any shot where physics/effects/scale remotely matter, plus the hero shot; audio included, first+last frame guidance, native 4K.
- **Veo 3.1** (`slates-prompting-veo-3`): niche, never the default — only when native synced audio must generate WITH the video in one gen; 16:9 only, 4/6/8s.

Failed gen? Check the error via `slates_get_generation_status`, fix the prompt, resubmit that one shot (a retry beyond the plan = announce the delta cost).

### 7. Assemble the timeline
- `slates_get_timeline` once to get the lay of the land.
- `slates_add_clip_to_timeline` for each completed video asset **in story order** — defaults append back-to-back on the first video track, which is exactly an assembly cut.
- Order wrong? `slates_reorder_clips` with the full clip-id list. Dropped a shot? `slates_remove_clip`, then reorder to close the gap.

### 8. Export + deliver
- Output path: ask the user, or default to `<slates_get_project_directory>/exports/<name>.mp4`.
- `slates_export_video` (absolute path, `.mp4`; blocks while ffmpeg renders — minutes for long timelines).
- `slates_reveal_file` so the file is literally in front of them.
- Offer the finishing path: `slates_export_timeline_xml` → DaVinci Resolve (File → Import → Timeline) for grading, sound, and titles.

### 9. Report
Shots delivered, total spent vs. approved plan, the export path, and the single best next lever ("re-take shot 3 with a tighter prompt" / "add a CTA end-card").

## Hard rules

- **Two checkpoints only.** Creative plan (step 1) and total cost (step 4). Everything else runs without asking — that's the product promise.
- **Skeleton before spend.** Project + storyboard structure are free; generation isn't.
- **Look at everything.** Every image inline, every video via `slates_get_asset_video_frames` if a clip seems off. Never assemble a timeline from clips you haven't evaluated.
- **3-strike rule per shot.** Three failed takes on one shot = stop, show the user what you tried, ask.
- **Consistency comes from references, not luck.** Same turnaround asset on every character frame; same environment refs across a location's shots.
