---
name: slates-one-prompt-film
description: Deliver a finished video when the user explicitly asks for one, coordinating editable writing, selected media production, a named Cut and a verified export. Preserve existing work and follow generation authorization.
---

# Idea to finished video

Carry the requested piece through to an exported file. Use existing work whenever it serves the brief. The creator can enter at any point: writing, importing footage, comparing takes or changing an edit. No mandatory stage sequence, shot count or number of approval checkpoints follows from this guide.

## Make the intended piece visible

Use the current project and document unless another destination is requested. Save words through the revision-checked document tools; `slates-script-craft` covers writing and alternatives. Add production bindings only where needed. A shot needs no image, and a Cut can use imported footage with no script.

Preserve fixed passages, explicit creative choices and custom prompt bytes. Record production choices in editable shots. Explain only consequential judgments not already visible there. Recurring cast, repeated framing, silence and dependent scenes are valid when they serve the piece.

## Inspect the actual requests and estimate

Use `slates_get_shot` to inspect the composed prompt, settings and references. Model choices and supported settings come from `slates-model-selection`, the current capability surface and the selected model's guide. Do not carry limits or prices from an old example.

Follow `slates-cost-discipline` and the user's generation policy. Quote the exact requested set with `slates_generate_from_shots` before confirming it. Existing authorization covers its enumerated requests, not extra takes or changed inputs. Editing, choosing alternatives, importing and building a Cut do not spend generation credits.

Keep reusable historical media separate from new requests. Matching words alone do not prove matching voice, references or settings. An explicitly requested extra take is never deduplicated away.

## Generate only the authorized material

Submit the chosen requests and inspect each returned state. On an uncertain timeout, read the shot's generation IDs and job status before any retry. Diagnose a failure and follow the existing consent policy for added requests. Never discard other takes merely because a new one was selected.

Inspect image composition and reference fidelity. Inspect video performance, motion and sound across playback; frame samples alone cannot establish speech or motion quality. If an edit can resolve dead air or order, use the existing take rather than assuming another generation is needed.

## Arrange and deliver

Read the available timelines. Name the destination Cut explicitly for a variation; independent comparisons use independent Cuts. Add selected media in the intended order, preserve trim/level/transform choices and inspect the actual timeline.

Use supported video/XML exports and their stated fidelity limits. For selected named Cuts, `slates_export_cuts` records distinct outputs and a manifest; retry unfinished outputs with the same manifest identity. Verify the returned files and playback before reporting success. Describe the completed piece, actual spend where available and output paths. Do not label a render complete merely because its submission succeeded.

<!-- @inject:decision-log -->
Record production choices in the editable shot fields. Explain only consequential judgments the user did not specify and no field already records: for example, why a particular light or performance register supports the brief. Do not repeat the shot list in prose or turn this explanation into an approval gate. Follow the separate generation authorization policy before spending.
<!-- @end:decision-log -->
