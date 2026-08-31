---
name: slates-one-prompt-film
description: The full one-prompt-to-finished-film pipeline in Slates — script, project, characters, storyboard, frame images, video generation, timeline assembly, MP4 export. Use when the user gives one idea and wants a finished video out the other end - "make me a video about X", "turn this idea into an ad", "make a short film from this", "one prompt, finished film". This is the master recipe; other Slates skills are its sub-steps.
---

# One prompt → finished film — Slates master pipeline

The user gives an idea. You hand back an MP4 on disk. Everything in between is yours, with exactly TWO mandatory user checkpoints: the creative plan, and ONE aggregated cost approval.

## The pipeline

### 1. Script the beats
Turn the idea into a beat-level script: 4-10 shots, each with subject, action, setting, camera, and duration (4-8s per shot). Surface it as a tight table. Get the user's nod on the plan, format (aspect ratio — 16:9 vs 9:16 decides everything downstream), and rough budget appetite before touching any op.

**Surface a decision log with the plan.**

<!-- @inject:decision-log -->
When you surface the plan, include a short **decision log** — one line per decision *you* made that the user did not specify **and that no row already records**:

```
source phrase or declared default → what you wrote → what it resolves
"in a diner"        → chrome-and-vinyl booth, 3/4 on the counter   → fixes the anchor so blocking is repeatable
(no time of day)    → late afternoon, low warm key                 → default; say the word and it changes
(no model named)    → seedance-2 on shot 4 only                    → the one shot where physics matter
```

🚨 **Keep it to what is NOT already data.** A saved Shot records the references, their roles, the model and every param, and `slates_get_shot` reads them back composed — narrating those is retelling a row the user can open. This convention exists because the model's choices had nowhere structured to land; where they now do, write the Shot and let the log carry the judgement no field holds.

**Hard rule: never silently add weather, props, style, or camera movement.** If it wasn't in the brief and you added it, it goes in the log. This is the "why did you add that?" affordance — for an agent that writes prompts on the user's behalf and spends their credits, it is what keeps the model in assembly and the user in the director's chair.

> ❌ **Do NOT turn this into a question gate.** Clarifying questions before optimizing directly fight the locked fast-path rule: *if intent is clear, generate immediately with sane defaults, don't ask questions; only ask for production intent, and batch every question into one message.* Log the decisions, then go. The log is an **output**, not an interrogation — surfaced alongside the plan, never as a separate ceremony, and never as a reason to wait.
<!-- @end:decision-log -->

A 4-10 shot script is where you invent the most on the user's behalf — time of day, wardrobe, weather, lens feel, camera moves the brief never mentioned. The log is what makes those visible while they are still free to change.

### 2. Set up the project
- `slates_create_project` named for the piece.
- Recurring character? Build it properly — `slates_create_character` + the `slates-character-identity` recipe — so every frame references the same identity.
- Recurring location? `slates_create_environment`.
- One-off shots don't need character/environment records; skip the ceremony.

### 3. Storyboard skeleton and the Shots (no generation yet)
- `slates_create_storyboard`, `slates_add_scene` per script scene.
- `slates_create_shot` per beat — the prompt, the model, the params and the references, with the roles they carry. **A Shot needs no image**, so the entire film exists as rows before anything is paid for.
- `slates_get_shot` reads one back COMPOSED: the prompt the model will actually receive, its numbered references, and its exact quote. Audit your own work there — you cannot approve something the request will not contain.
- Structure first, spend second — the user catches script problems on the free skeleton, not on burned credits.

### 4. ONE aggregated cost approval — then hands-off
The Shots ARE the quote. `slates_generate_from_shots` without `confirm` returns one itemised total for the set plus the largest single item — no hand arithmetic, no `slates_estimate_generation_cost` per call:

> Plan: 6 frames at 1k 16:9 + 5 × 8s Kling 3.0 std + 1 × 8s Seedance 2 hero shot ≈ N credits total, largest single N. Proceed with the batch?

Per `slates-cost-discipline` 3b: that single OK authorizes `confirm=true` for **every enumerated call in the batch** — no per-call re-asking. Re-confirm only if a call's price overruns the plan >25% or new calls get added (extra retakes, new shots).

### 5. Generate frame images
Fire the image Shots with `slates_generate_from_shots` (`confirm: true` — step 4 authorized it). Slates names each reference inline as "image N"; you never hand-write a role label or a number. Evaluate every result inline against the beat. Bind keepers via `slates_add_frame`, then `slates_update_shot` with `attachFrameId` so the recipe travels with the picture.

**Multi-take where it matters:** for the hook shot and any shot the whole film hangs on, generate 2-4 variants (cheap model or 1k), pull them back with `slates_get_assets_batch`, pick the strongest on composition + identity, discard the rest. Don't multi-take filler shots.

### 6. Generate video per Shot
Fork each bound frame's image Shot with `slates_duplicate_shot` (`model:` the video model — that is the A/B lever the op takes inline), then `slates_update_shot` the copy with `firstFrameAssetId` = the bound frame. Two calls, because `slates_duplicate_shot` forks the prompt, the model and the params; **attachments are changed with `slates_update_shot`.** Then fire the set with `slates_generate_from_shots`.

⚠️ **It runs SEQUENTIALLY and blocks until the last clip lands** — a 6-shot film is one long wait, and it will usually outlast the HTTP timeout while the run keeps going. When that happens, poll `slates_get_shot` for each Shot's `generationIds` and then `slates_get_generation_status`; **never re-fire, that double-spends.** (Concurrent batch firing needs a real queue — concurrency limiting, per-item failure isolation, partial-billing semantics — and is deliberately not built yet.)

**Model mixing — route per `slates-model-selection`** (details in the per-model guides):
- **Kling V3** (`slates-prompting-kling-v3`): the DEFAULT for most shots — 16:9 / 9:16 / 1:1, 3-15s, strong start-frame adherence; std is the workhorse, Omni for multi-character dialogue.
- **Seedance 2** (`slates-prompting-seedance`): the PREMIUM tier — any shot where physics/effects/scale remotely matter, plus the hero shot; audio included, first+last frame guidance, native 4K (4K video is Pro-only).
- **MiniMax H3** (`slates-prompting-minimax-h3`): route here when a shot's SOUND is part of the writing — a line delivered a particular way, scene sound under it, score that must stay outside the characters' world. It authors all three in one pass, which **collapses a shot's audio pass into its video pass** and removes the separate `slates_generate_audio` step for that shot. 5-15s, 480p/768p/2K/4K. Its sibling `minimax-h3-max` is faster but capped at 768p, takes no references, and costs MORE at 768p — a deliberate speed pick, never a saving.
- **Veo 3.1** (`slates-prompting-veo-3`): niche, never the default — only when native synced audio must generate WITH the video in one gen; 16:9 or 9:16, 4/6/8s (8s only at 1080p/4K or with reference images).

Failed gen? The run continues past it and **nothing is retried automatically**. Read the per-Shot error in the result, fix that Shot with `slates_update_shot`, and re-fire only it (a retry beyond the plan = announce the delta cost).

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
- **Consistency comes from references, not luck.** Same identity asset on every character frame; same environment refs across a location's shots.
- **Plan in Shots, not in chat.** Every decision that ends up in a sentence you have to remember is a decision the user cannot see, price, fork or re-fire. A Shot is a row: it survives the conversation, and the user can open it in the app and fix one reference without you.
