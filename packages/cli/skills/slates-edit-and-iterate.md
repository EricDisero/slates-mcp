---
name: slates-edit-and-iterate
description: Iterate on an existing Slates asset — re-evaluate, refine prompt, regenerate or edit. Use when the user has an existing generated image in Slates and wants to "tweak it", "change one thing", "make it warmer", "remove the second person", or any other surgical refinement instead of full regeneration.
---

# Edit and iterate — Slates workflow

The user already has a generated image in Slates and wants to refine it. The vision-feedback-loop skill defines the general pattern; this skill is the specific recipe for "I have asset X, here's what's wrong with it."

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
| Surgical | `slates_edit_image` with a focused edit prompt + the original as the source. |
| Aesthetic / compositional | `slates_generate_image` with the original as a reference + a refined prompt. Don't re-roll from scratch. |
| Wholesale | New prompt, no reference, fresh generation. Treat as a new brief. |

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
- **Don't** re-generate when `edit_image` would work. Edits preserve composition and identity; full regen rolls the dice.
- **Don't** chain >3 iterations without checking in. If three tries didn't land, the brief is wrong, not the model.
