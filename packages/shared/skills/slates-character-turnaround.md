---
name: slates-character-turnaround
description: Build a Slates character from a reference image — generate its identity reference sheet and bind it to the character so the card updates live. Use when the user wants to "create a character", "build a character from this image", "generate a turnaround for X", or starts any storyboard flow that needs consistent character references.
---

# Character identity sheet — Slates workflow

A character's identity sheet is attached to **every** downstream generation that mentions it, so a flaw in the sheet becomes a flaw in every shot made from it. Building it well is the highest-leverage thing you can do for a project.

<!-- @inject:references-read-literally -->
> **The general law: the model reads a reference literally.**
> A reference image is not a suggestion. Whatever is baked into it — lighting, medium, texture, symmetry, competing identities — is read as a **property of the subject** and reproduced downstream. A baked rim light tints every shot made from that sheet. A sheet that looks like a 3D game render gets animated like game footage. Two competing renderings of one face get averaged into a third face.

Every reference rule below is a corollary of that one sentence, which is why "prep the reference" beats "prompt around the reference" every time:

- **Flat, plain identity refs** — because scene lighting in the sheet becomes scene lighting in the output (Slates' own receipt: a studio-lit sheet produced a subject that looked green-screen-pasted in front of mountains).
- **One authoritative rendering per subject** — because the model cannot tell which panel is the real one. ByteDance documents this failure directly: multi-view character assets "confuse the model's character recognition, causing it to generate duplicate characters of the same appearance."
- **No 3D-game-render look in a reference** — the model recognizes the render mood and inherits its motion character, so the *animation* comes out looking like game footage. This is not a taste rule; it is the same literal-reading mechanism applied to the temporal layer.
- **Break perfect symmetry** — mirrored faces and dead-square framing read as synthetic, and the model preserves that reading rather than correcting it.

**What this means in practice:** when output is wrong in a way that tracks the *subject* rather than the *scene* — the lighting is wrong the same way in every shot, the face drifts, the material looks synthetic everywhere — fix the reference, not the prompt. Prompting around a baked-in property is the expensive way to lose.
<!-- @end:references-read-literally -->

## The shape: ONE sheet, three panels

Slates generates **one identity sheet per character**, bound to the character's turnaround slot:

| Panel | What it carries |
|---|---|
| **Chest-up portrait, three-quarter angle, largest panel (~25–30% of the sheet)** | The face. **This is the only place the model reads facial identity from** — every detail it will ever know comes from those pixels, so it gets the resolution. Off-frontal, never dead-on: an angled head reads its volume instantly. |
| **Full-body front, relaxed A-pose** | Build, proportion, wardrobe |
| **Full-body back** | Hair fall and the back of the outfit — the only panel where either reads |

On a deep neutral-grey plate (`#3a3a3c`), flat and shadowless, with catchlights in the eyes, irises never crushed to black, surface texture at the medium's own natural level of detail, broken symmetry, and no over-clean 3D-game-model look.

**The sheet inherits the source's medium** — photo, anime, illustration, painterly, 3D render — unless the user explicitly asks for a transform. None of the craft clauses above override that: they ask for *readable* eyes and *material-looking* surfaces within whatever medium the character is in, not for photorealism.

**Why one sheet and not two.** Every `@character` mention pushes *all* of that character's bound sheets into one reference group, so a two-sheet character costs **two reference slots on every generation**. Against real caps that is brutal — Kling 3.0 takes 4 ingredients (2 characters, zero room for an environment), NB2 has 4 character slots, Seedance 9. One sheet each **doubles the cast you can stage on every model.** It also takes competing facial renderings from six down to two, which is what stops a face from averaging (see the general law above), and it halves the per-character sheet spend.

**The expression slot still exists** and is still read — characters built before this change have one bound and keep working. Generate one only when a character genuinely needs a dedicated expression range, and tell the user it costs a reference slot on every shot from then on.

## Workflow

### 1. Get the reference
The user has either:
- Pasted/uploaded an image of the character (real person, drawing, AI render).
- Described the character in text only.

If image: upload it as a reference (`slates_upload_reference_image`).
If text only: generate from prompt-only — less consistent, so warn the user.

### 2. Create the character record
`slates_create_character` with:
- `name` (ask if not given)
- `description` — 1-2 sentences, *visual* only ("tall, dark hair, scar over left eye"), not personality.
- `style` — leave as the source's own medium by default. Only name a transform if the user wants one (e.g. anime → realistic).

### 3. Generate the sheet
`slates_generate_character_sheets` with `characterId`, `projectId`, and `baseAssetId` (the source portrait).

**Do not hand-write the sheet prompt.** Slates builds it from the canonical template in `@slatesvideo/shared/prompts` (`buildCharacterTurnaroundPrompt`) — panels, plate, lighting and craft clauses included — and appends your `userNotes`. Use `userNotes` for what the template can't know: *"use the woman on the left"*, *"keep the scar on the right cheek"*. A hand-written prompt is a fork of the template and will drift from it.

- Estimate cost first with `slates_estimate_generation_cost` and announce in **credits** — never quote a price from memory. Default is Nano Banana 2 at 2K. **Never 4K** — no identity gain at sheet scale, wasted credits.
- When the result returns inline, **evaluate it before binding**:
  - Is the portrait clearly the largest panel, and is it off-frontal?
  - Is it the same person across all three panels?
  - Catchlights present, irises readable rather than black holes?
  - Is it in the source's medium, and does it read as *that* medium done well — or has it drifted toward the over-clean game-model look?
  - Plate a flat deep grey, not white and not black?
- If off: one focused refinement, then regenerate. The sheet is upstream of everything — it is worth a re-roll that a scene frame is not.
- The op binds the result to the turnaround slot automatically.

### 4. Hand back
> "Character {name} ready — identity sheet bound. Use `@{name}` in any prompt and Slates attaches it and names it inline, so the face stays consistent."

## How the reference gets used at scene time

Slates cites the sheet inline under the character's name — `{name} (image N)` — in the exact order it sends references. That **name** is the anti-averaging lever, and it is each model's own official mechanism (NB2: "assign a distinct name"; Seedance: `Reference <Subject_N> in <Image_N>`; Kling: reuse a fixed label verbatim). If a character has both slots bound, both are cited under the *same* name so the model reads them as one person.

Critically, the app injects **no** wardrobe, expression, or lighting directive. The user's scene prompt owns all of that — which is why `@{name}` dropped into a movie-still injection keeps the still's own clothing and lighting instead of dragging the sheet's.

## Anti-patterns

- **Don't** studio-light, white-background, or black-background the sheet. White bleeds into the video and washes out the location; black eats edge detail. Flat, even, shadowless light on a deep neutral grey.
- **Don't** hand-write the sheet prompt when the op will build it — that is how the template and the shipped prompt fork.
- **Don't** generate an expression sheet by reflex. It is opt-in now, and it costs a reference slot on every downstream shot.
- **Don't** skip binding. The slots are what the storyboard pipeline reads — an unbound asset doesn't help downstream.
- **Don't** invent character details. Stick to what's in the reference image and the user's description.
- **Don't** use 4K — wastes credits, no quality gain at sheet scale.
- **Don't** feed a multi-view sheet into a Seedance shot that has **several characters in frame** without binding each character to its image and appending the anti-twin constraint — ByteDance documents multi-view assets as a cause of duplicate characters. See `slates-prompting-seedance`.
