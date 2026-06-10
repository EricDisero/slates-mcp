---
name: slates-character-turnaround
description: Build a Slates character from a reference image — generate the turnaround sheet and expression sheet, bind both to the character's slots so the user sees the character card update live. Use when the user wants to "create a character", "build a character from this image", "generate a turnaround for X", or starts any storyboard-flow that needs consistent character references.
---

# Character turnaround — Slates workflow

Slates stores characters with two image slots: turnaround (full-body multi-angle) and expression sheet (face emotions). The whole storyboard generation pipeline pulls these via `@character` mentions for visual consistency. Building them well = consistent character across every frame.

## Workflow

### 1. Get the reference
The user has either:
- Pasted/uploaded an image of the character (real person, drawing, AI render).
- Described the character in text only.

If image: upload it as a reference (`slates_upload_reference_image`).
If text only: skip step 2 and generate the turnaround from prompt-only (less consistent — warn the user).

### 2. Create the character record
`slates_create_character` with:
- `name` (ask if not given)
- `style` — match the project's overall style (`realistic`, `anime`, `pixar`, `comic-book`).
- `description` — 1-2 sentences, *visual* only ("tall, dark hair, scar over left eye"), not personality.

### 3. Generate the turnaround sheet
- Use `slates_generate_image` with a prompt like:
  > "Character turnaround sheet: 5 angles (front, 3/4 left, profile left, 3/4 right, back). Neutral pose. Even studio lighting. White background. {character description}"
- Pass the reference image URL/ID as a reference.
- Resolution: **2k** (default). 4k only if the user specifies.
- Estimate cost first.

When the result returns inline:
- Evaluate against the reference. Is it the same character?
- If wrong angle count / inconsistent: refine prompt with explicit angle list, regenerate once.
- When right: bind via `slates_set_character_turnaround_asset` (the user sees the character card update).

### 4. Generate the expression sheet
- Prompt:
  > "Expression sheet: 6 expressions (neutral, happy, angry, sad, surprised, determined). Same character, same lighting as the turnaround. {character description}"
- Pass BOTH the original reference AND the just-generated turnaround as references for max consistency.
- Same model, same resolution.
- On success bind via `slates_set_character_expression_asset`.

### 5. Hand back
> "Character {name} ready. Turnaround + expressions bound. Use `@{name}` in any prompt to attach these references."

## Anti-patterns

- **Don't** generate turnaround and expressions in one prompt. Slates expects them as two separate assets in two separate slots.
- **Don't** skip binding. The slots are what the storyboard pipeline reads — an unbound asset doesn't help downstream.
- **Don't** invent character details. Stick to what's in the reference image and the user's description.
- **Don't** use 4k unless asked — wastes credits, no quality gain at sheet scale.
