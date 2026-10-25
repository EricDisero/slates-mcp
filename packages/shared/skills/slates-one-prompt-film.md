---
name: slates-one-prompt-film
description: "Turn a video brief into a finished, editable Slates production and verified export. Use for a film, short, trailer, music video or other complete video, from brief to verified export, entering through writing, imported footage or an existing edit. For an ad's argument and structure, combine with slates-direct-response-ad."
---

# Idea to finished video

<!-- @operative:start -->
**Operative summary.**
- Carry the piece through to an exported file, using existing work and entering wherever the creator is. (§ Make the intended piece visible)
- Check every shot against the router's methods list before pricing it, and offer the better route for that shot. (§ Make the intended piece visible) <!-- src: design review of the brain, 2026-10-25: a fight or a stats card inside a longer film was never offered its method -->
- Inspect composed requests with `slates_get_shot` and follow `slates-cost-discipline` before any spend. (§ Inspect the actual requests and estimate)
- Quote saved shots with `slates_generate_from_shots`, and other generations with `slates_estimate_generation_cost`. (§ Inspect the actual requests and estimate)
- On an uncertain timeout, read the shot's generation IDs and job status before any retry. (§ Generate only the authorized material)
- Verify the returned files and playback before reporting success; a submitted render is not a complete one. (§ Arrange and deliver)
<!-- @operative:end -->

Carry the requested piece through to an exported file. Use existing work whenever it serves the brief. The creator can enter at any point: writing, importing footage, comparing takes or changing an edit. No mandatory stage sequence, shot count or number of approval checkpoints follows from this guide.

## Make the intended piece visible

Use the current project and document unless another destination is requested. Save words through the revision-checked document tools; `slates-script-craft` covers writing and versions. Add production bindings only where needed. A shot needs no image, and a cut can use imported footage with no script.

Preserve fixed passages, explicit creative choices and custom prompt bytes. Recurring cast, repeated framing, silence and dependent scenes are valid when they serve the piece. For a recurring cast member or location, create it and bind its identity sheet or plate before the shots (`slates-character-identity`); those are generations, so quote them with the shots.

Before pricing, read each shot against the router's methods list (`slates-start-here` § Offer the method that gets the result): a fight or a chase in one take goes to Blender blocking, exact words or numbers to a motion layer, a recorded line to lip sync. Offer the method for that shot with its reason, so one film can mix them. <!-- src: design review of the brain, 2026-10-25: a fight or a stats card inside a longer film was never offered its method -->

## Inspect the actual requests and estimate

Use `slates_get_shot` to inspect the composed prompt, settings and references. Model choices and supported settings come from `slates-model-selection`, the current capability surface and the selected model's guide. Do not carry limits or prices from an old example.

Follow `slates-cost-discipline` and the user's generation policy. Quote saved shots with `slates_generate_from_shots` and any other generation (audio, lip sync, motion transfer, AI edits) with `slates_estimate_generation_cost`, then confirm the set. Existing authorization covers its enumerated requests, not extra takes or changed inputs. Editing the script or shots, choosing takes, importing, trimming and building a cut spend nothing; an AI edit of an image or clip (`slates_edit_image`, `slates_edit_video`) is a generation. To judge composition before video spend, price picture previews (`draft` on `slates_generate_from_shots`) and use the approved pictures as first frames. <!-- src: design review of the brain, 2026-10-25: blocking is offered per shot up front, not only after prompting fails -->

Keep reusable historical media separate from new requests. Matching words alone do not prove matching voice, references or settings. An explicitly requested extra take is never deduplicated away.

## Generate only the authorized material

Submit the chosen requests and inspect each returned state. Voiceover, music, sound effects, lip sync and motion transfer are their own generations; place the audio on an audio track of the cut. On an uncertain timeout, read the shot's generation IDs and job status before any retry. Diagnose a failure and follow the existing consent policy for added requests. Never discard other takes merely because a new one was selected.

Inspect image composition and reference fidelity. Inspect video performance, motion and sound across playback; frame samples alone cannot establish speech or motion quality. If an edit can resolve dead air or order, use the existing take rather than assuming another generation is needed.

## Arrange and deliver

Read the available timelines. Name the destination cut explicitly for a variation; independent comparisons use independent cuts. To lay a board's preferred takes onto a cut in board order, build it from the board (`slates_edit_cut`); when a shot's preferred take changes, sync the cut rather than re-adding clips. Preserve trims, track levels and any delivery framing, and inspect the actual timeline. The editing pass (trims, J- and L-cuts, speed) is `slates-cuts`; transitions between clips are `slates-transitions`.

Use supported video/XML exports and their stated fidelity limits. For selected named cuts, `slates_export_cuts` records distinct outputs and a manifest; it returns at once, so poll `slates_get_export_batch` until every output is finished, and retry unfinished outputs with the same manifest identity. `slates_export_assets` copies the original clips, stills or audio out. Verify the returned files and playback before reporting success. Describe the completed piece, actual spend where available and output paths. Do not label a render complete merely because its submission succeeded.

<!-- @inject:decision-log -->
Record production choices in the editable shot fields. Explain only consequential judgments the user did not specify and no field already records: for example, why a particular light or performance register supports the brief. Do not repeat the shot list in prose or turn this explanation into an approval gate. Follow the separate generation authorization policy before spending.
<!-- @end:decision-log -->
