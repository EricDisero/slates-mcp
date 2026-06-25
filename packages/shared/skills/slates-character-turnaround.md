---
name: slates-character-turnaround
description: Build a Slates character from a reference image — generate the turnaround sheet and expression sheet, bind both to the character's slots so the user sees the character card update live. Use when the user wants to "create a character", "build a character from this image", "generate a turnaround for X", or starts any storyboard-flow that needs consistent character references.
---

# Character turnaround — Slates workflow

Slates stores characters with two image slots: turnaround (full-body multi-angle) and expression sheet (face close-ups). At scene time Slates attaches BOTH via `@character` mentions — the turnaround for body/proportion/outfit, the expression-sheet close-ups for high-res facial detail. Building them well = consistent character across every frame.

## Workflow

### 1. Get the reference
The user has either:
- Pasted/uploaded an image of the character (real person, drawing, AI render).
- Described the character in text only.

If image: upload it as a reference (`slates_upload_reference_image`).
If text only: skip step 2's reference and generate the turnaround from prompt-only (less consistent — warn the user).

### 2. Create the character record
`slates_create_character` with:
- `name` (ask if not given)
- `description` — 1-2 sentences, *visual* only ("tall, dark hair, scar over left eye"), not personality.
- `style` — leave as the source's own medium by default. Only name a transform if the user wants one (e.g. anime → realistic).

### 3. Generate the turnaround sheet — the identity anchor
- Use `slates_generate_image` with a prompt like:
  > "Character model reference sheet with 4 full body views of the same character: front view, back view, left side profile, right side profile. Neutral pose, neutral expression, consistent appearance across all views. Preserve the artistic medium and visual style of the reference (photo / anime / illustration / 3D / painterly). Render on a plain neutral-grey background with flat, even, shadowless lighting so the sheet captures identity, not scene lighting. No text, no labels, no captions. {character description}"
- **Flat light + plain background is the whole point.** A studio-lit or scene-lit sheet bleeds its lighting into every later generation (the "green-screen-pasted-in-front-of-mountains" failure). Reference prep beats prompting here.
- To transform the medium (e.g. "make her a real person"), append a plain-language instruction; otherwise the source style is preserved.
- Pass the reference image as a reference. Resolution: **2k** (4k wastes credits at sheet scale — no identity gain).
- Estimate cost first.
- When the result returns inline: evaluate against the reference. Same character? Right angle count? If off, refine the prompt with the explicit angle list and regenerate once.
- When right: bind via `slates_set_character_turnaround_asset` (the user sees the card update).

### 4. Generate the expression sheet — the close-up face reference
- Prompt:
  > "Character expression reference sheet with 3 head-and-shoulder portraits side by side: neutral on left, genuine smile showing teeth in center, serious frown on right. Same character, same flat even shadowless lighting and plain neutral-grey background as the turnaround. {character description}"
- Pass BOTH the original reference AND the just-generated turnaround as references for max consistency.
- Same model, **2k**.
- On success bind via `slates_set_character_expression_asset`.

### 5. Hand back
> "Character {name} ready. Turnaround + expressions bound. Use `@{name}` in any prompt — Slates attaches both sheets and labels them so the face stays consistent."

## Why both sheets (don't gate them)
At scene time Slates attaches the turnaround AND the expression sheet, and writes a reference label that says: use these for the character's identity (face, skin, bone structure, body, outfit) and render the expression the SCENE describes, default neutral. That LABEL — not withholding the expression sheet — is what stops the multiple expressions from averaging the face to a midpoint. The close-ups carry far more facial signal (eyes, teeth, skin) than the postage-stamp faces in a full-body turnaround, so attaching both is a fidelity win. The trend is MORE references (video/audio/3D into newer models), so lean into attaching rich refs and labeling every role.

## Anti-patterns

- **Don't** studio-light or white-background the sheets. Flat, even, shadowless light on a plain neutral-grey background — or the lighting bleeds into every scene.
- **Don't** generate turnaround and expressions in one prompt. Slates expects them as two separate assets in two separate slots.
- **Don't** skip binding. The slots are what the storyboard pipeline reads — an unbound asset doesn't help downstream.
- **Don't** invent character details. Stick to what's in the reference image and the user's description.
- **Don't** use 4k unless asked — wastes credits, no quality gain at sheet scale.
