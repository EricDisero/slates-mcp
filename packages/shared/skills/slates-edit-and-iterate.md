---
name: slates-edit-and-iterate
description: Iterate on an existing Slates asset — re-evaluate, refine prompt, regenerate or edit. Use when the user has an existing generated image in Slates and wants to "tweak it", "change one thing", "make it warmer", "remove the second person", or any other surgical refinement instead of full regeneration.
---

# Edit and iterate — Slates workflow

The user already has a generated image in Slates and wants to refine it. The vision-feedback-loop skill defines the general pattern; this skill is the specific recipe for "I have asset X, here's what's wrong with it."

## 🔴 The master rule — an edit is a LEAF, not a node

**Never re-edit an edit. Always go back and re-edit the master.**

Every edit model silently re-renders the **whole frame**, not just the region you named. So the parts you didn't ask to change come back slightly different every pass — softer texture, drifted colour, mushier fine detail. It is barely visible after one edit and obvious by the second. Chaining edits compounds the damage and there is no way to undo it, because each generation *is* the new source.

The fix is structural, not a matter of care:

- **Want two changes?** Make them in ONE edit off the master, or make them as two separate edits **both taken from the master**, then keep whichever you prefer.
- **An edit came back wrong?** Do NOT edit the result to fix it. Discard it and re-edit the master with a better instruction.
- **Only the changed region is worth keeping?** That is a compositing job — the edit supplies the new region, the untouched master supplies everything else.

Slates records this: an edit result carries `sourceAssetIds` pointing at the asset it was made from, so **you can tell whether the thing you are about to edit is itself an edit.** Check before you edit — `[Edit]`-prefixed prompts and a populated source lineage both say "this is a leaf; go back to its parent."

## Workflow

### 1. Pull the current asset back into context
- The user references an asset by id, frame number, or "the latest one."
- Resolve to an asset id (`slates_list_assets` if needed).
- `slates_get_asset_image` with that id to load it inline. **You see the image.**

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
| Aesthetic / compositional | `slates_generate_image` with the original in `referenceAssetIds` + a refined prompt. Don't re-roll from scratch. |
| Wholesale | New prompt, no reference, fresh generation. Treat as a new brief. |

**`slates_edit_image` shape:** `projectId` + `sourceAssetId` + `prompt` (the edit instruction). Default model `nano-banana-2` — the only edit model that also takes extra `referenceAssetIds`; `flux-2-max` / `seedream-5-lite` use their own edit endpoints and ignore references. The result lands as a NEW asset (prompt prefixed `[Edit]`); the source is untouched. Cost above ~17 credits gates on `confirm=true`.

### 4. Generate, evaluate, decide
- Estimate cost first.
- After generation, the result is inline. Compare side-by-side with the original (`slates_get_asset_image` again).
- If the delta is correct: bind to the same slot (frame, character turnaround, etc.) the original was bound to.
- If the delta missed: one focused refinement, then regenerate. Cap at 3 tries.

### 5. Hand back
- "Asset updated. Frame 3 now uses {new_asset_id}."
- Always note what changed and what didn't, so the user can see the surgery worked: "Lighting shifted to warmer, composition unchanged."

## Anti-patterns

- **Don't** delete the original asset until the user confirms the new one. Slates keeps both; the user picks.
- **Don't** mix surgical and wholesale changes in one regeneration. The user said "make it warmer" — don't also reframe the shot.
- **Don't** re-generate when `slates_edit_image` would work. Edits preserve composition and identity; full regen rolls the dice.
- **Don't** edit an edit — ever. Not once, not "just a small one." Go back to the master (see the master rule above). Every attempt re-renders the full frame and the degradation is cumulative and permanent.
- **Don't** keep re-rolling the same failed edit. If three tries off the master didn't land, the brief is wrong, not the model — check in with the user.
