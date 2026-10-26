---
name: slates-edit-and-iterate
description: "Refine an existing Slates image or clip with a targeted edit or revised generation. Use for warmer light, removing a figure, reframing, a different look, or fixing a clip that is nearly right; preserve the original and its lineage."
---

# Edit and iterate — Slates workflow

<!-- @operative:start -->
**Operative summary.**
- Never re-edit an edit; go back to the master and edit it again, and check the asset's source lineage first. (§ The master rule: an edit is a leaf, not a node)
- Load the asset with `slates_get_asset_image` and read its record with `slates_get_asset` before choosing a tool. (§ 1. Pull the current asset back into context)
- Use `slates_edit_image` with only the change for surgical and aesthetic edits, `slates_generate_image` with the original as a reference for compositional ones, and a fresh generation for wholesale ones. (§ 3. Pick the right tool)
- Estimate the cost and show it before generating, then compare the result with the original and rebind where the original was used. (§ 4. Generate, evaluate, decide)
- After three failed attempts at one requirement, stop re-rolling and diagnose the reference, prompt, model and tool result; a failed roll never authorizes another charge. (§ Diagnose repeated failures)
- Treat a clip the same way: `slates_edit_video` with the change only, named with its price. (§ Clips) <!-- src: brain A/B, a too-dark fix named no change, 2026-10-25 -->
- Keep the original until the user confirms, and never mix surgical and wholesale changes in one pass. (§ Anti-patterns)
<!-- @operative:end -->

The user already has a generated image in Slates and wants to refine it. The vision-feedback-loop skill defines the general pattern; this skill is the specific recipe for "I have asset X, here's what's wrong with it."

## The master rule: an edit is a leaf, not a node

**Never re-edit an edit. Always go back and re-edit the master.**

Every edit model silently re-renders the **whole frame**, not just the region you named. So the parts you didn't ask to change come back slightly different every pass — softer texture, drifted colour, mushier fine detail. It is barely visible after one edit and obvious by the second. Chaining edits compounds the damage and there is no way to undo it, because each generation *is* the new source.

The fix is structural, not a matter of care:

- **Want two changes?** Make them in ONE edit off the master, or make them as two separate edits **both taken from the master**, then keep whichever you prefer.
- **An edit came back wrong?** Leave the result as it is. Discard it and re-edit the master with a better instruction.
- **Only the changed region is worth keeping?** That is a compositing job — the edit supplies the new region, the untouched master supplies everything else.

Slates records this: an edit result carries `sourceAssetIds` pointing at the asset it was made from, so **you can tell whether the thing you are about to edit is itself an edit.** Check before you edit — `[Edit]`-prefixed prompts and a populated source lineage both say "this is a leaf; go back to its parent."

## Workflow

### 1. Pull the current asset back into context
- The user references an asset by id, frame number, or "the latest one."
- Resolve to an asset id (`slates_list_assets` if needed).
- `slates_get_asset_image` with that id to load it inline. **You see the image.**
- `slates_get_asset` shows its recorded prompt, model and source links: read it to see whether the picture is itself an edit.

### 2. Identify the delta
The user's request is one of:
- **Surgical** — "remove the second figure", "make the sword red", "swap the background to a bamboo forest".
- **Aesthetic** — "warmer light", "more dramatic", "softer focus".
- **Compositional** — "wider shot", "lower angle", "centered subject".
- **Wholesale** — "actually let's try a totally different look."

### 3. Pick the right tool
| Delta type | Approach |
|---|---|
| Surgical | `slates_edit_image` — `sourceAssetId` = the original, `prompt` = the change only ("remove the second figure"), not a re-description of the whole image. |
| Aesthetic (light, colour, mood) on a composition that stays | `slates_edit_image` with the change only. |
| Compositional (wider, lower angle, recentred) | `slates_generate_image` with the original in `referenceAssetIds` + a refined prompt. Don't re-roll from scratch. |
| Wholesale | New prompt, no reference, fresh generation. Treat as a new brief. |

**`slates_edit_image` shape:** `projectId` + `sourceAssetId` + `prompt` (the edit instruction). Omit `editModel` for the app's Edit seat (the default image model). Every edit model also takes `referenceAssetIds`, up to its reference cap less one: the source is image 1. The result lands as a NEW asset (prompt prefixed `[Edit]`); the source is untouched. Follow the current estimate and returned confirmation gate; an endpoint threshold does not grant consent to spend.

### 4. Generate, evaluate, decide
- Estimate cost first.
- After generation, the result is inline. Compare side-by-side with the original (`slates_get_asset_image` again).
- If the delta is correct, rebind where the original was used: the Shot's picture or first frame (`slates_update_shot`), the timeline's chosen clip (`slates_update_frame`), a character identity (`slates_set_character_identity_asset`). A result that landed under the wrong Shot moves with `slates_refile_take`; a take worth keeping as a different look becomes its own Shot with `slates_split_take`.
- If the delta missed: diagnose the visible mismatch, refine the instruction and re-edit the master within the approved request or batch.

<!-- @inject:iteration-diagnosis -->
## Diagnose repeated failures

After three failed attempts at the same requirement, pause unchanged re-rolls and diagnose the source reference, prompt structure, model fit and tool result. Three is a review checkpoint, not a universal limit or proof that the seed cannot matter. Preserve the attempts and name what each test changed.

Continue autonomously when the brief is clear, a specific correction is supported and the next request is already authorized. Hand control back when taste or intent cannot be inferred, the next request needs fresh consent, or the available tool cannot meet the requirement. A failed roll never authorizes an additional charge. Follow the existing batch and per-request cost policy.
<!-- @end:iteration-diagnosis -->

### Clips

The same recipe holds for video. Look with `slates_get_asset_video_frames`. A clip that is nearly right: `slates_edit_video` with the change only; the result is a new clip linked to its source. A clip longer than the edit model's window: `slates_trim_video` first, then edit the trimmed clip. A revised generation that continues from a clip: `slates_extract_video_frame` at its last frame, used as the next first frame. Before paying for a regeneration of a Shot, `slates_get_shot_inputs` lists finished takes with the same inputs, and `slates_reuse_shot_take` adds one free. Otherwise price it with `slates_get_board_quote` for that Shot (or `slates_estimate_generation_cost`) and show the figure before asking for the OK. Show the one change with the price: the exact edit instruction or the words changed in the Shot's prompt, and what it fixes ("too dark": the light named in the prompt, never a rewrite of the whole prompt); a plan that names no change is not ready to price. <!-- src: brain behaviour A/B, a too-dark fix priced a redo with no lighting change named, 2026-10-25 -->

### 5. Hand back
- "Asset updated. Frame 3 now uses {new_asset_id}."
- Always note what changed and what didn't, so the user can see the surgery worked: "Lighting shifted to warmer, composition unchanged."

## Anti-patterns

- **Don't** delete the original asset until the user confirms the new one. Slates keeps both; the user picks.
- **Don't** mix surgical and wholesale changes in one regeneration. The user said "make it warmer" — don't also reframe the shot.
- **Don't** re-generate when `slates_edit_image` would work. Edits preserve composition and identity; full regen rolls the dice.
- **Don't** keep re-rolling the same failed edit. Inspect whether the reference, edit instruction or chosen model caused the miss; use the repeated-failure checkpoint above.
