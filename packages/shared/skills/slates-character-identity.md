---
name: slates-character-identity
description: Build a Slates character from a reference image — generate one identity sheet and bind it to the character so the card updates live. Use when the user wants to create a character, build a character from an image, or starts a storyboard flow that needs consistent character references.
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

Slates generates **one identity sheet per character**, bound as the character's canonical reference:

| Panel | What it carries |
|---|---|
| **Chest-up portrait, three-quarter angle, largest panel (~25–30% of the sheet)** | The face. **This is the only place the model reads facial identity from** — every detail it will ever know comes from those pixels, so it gets the resolution. Off-frontal, never dead-on: an angled head reads its volume instantly. |
| **Full-body front, relaxed A-pose — framed from the collarbone down, head not shown** | Build, proportion, wardrobe. Headless on purpose: a front-facing body panel renders a ~40px face that can't match the portrait's, so the sheet would carry two competing identities and the model averages them. |
| **Full-body back, head and hair visible** | Hair fall and the back of the outfit — the only panel where either reads. Keeps its head because there's no face to compete with. |

The rule is **kill every competing rendering of the FACE, not every head** — which is why exactly one body panel is headless.

On a deep neutral-grey plate (`#3a3a3c`), flat and shadowless, with catchlights in the eyes, irises never crushed to black, surface texture at the medium's own natural level of detail, broken symmetry, and no over-clean 3D-game-model look. Quadrupeds and non-bipedal characters are carved out — natural standing stance, head shown on both body panels.

**The sheet inherits the source's medium** — photo, anime, illustration, painterly, 3D render — unless the user explicitly asks for a transform. None of the craft clauses above override that: they ask for *readable* eyes and *material-looking* surfaces within whatever medium the character is in, not for photorealism.

**Why one sheet.** Every `@character` mention attaches that character's canonical identity image, so each character costs one reference slot. It also reduces competing facial renderings to **one** — with the front panel headless and the back panel turned away, the portrait is the only face on the sheet, so there is nothing left to average.

## Workflow

### Get the reference
The user has either:
- Pasted/uploaded an image of the character (real person, drawing, AI render).
- Described the character in text only.

If image: upload it as a reference<!-- slates-only --> (`slates_upload_reference_image`)<!-- /slates-only -->.
If text only: generate from prompt-only — less consistent, so warn the user.

<!-- slates-only -->
### Create the character record
`slates_create_character` with:
- `name` (ask if not given)
- `description` — 1-2 sentences, *visual* only ("tall, dark hair, scar over left eye"), not personality.
- `style` — leave as the source's own medium by default. Only name a transform if the user wants one (e.g. anime → realistic).
<!-- /slates-only -->

### Generate the sheet
<!-- slates-only -->
`slates_generate_character_identity` with `characterId`, `projectId`, and `baseAssetId` (the source portrait).

**Do not hand-write the sheet prompt.** Slates builds it from the canonical template in `@slatesvideo/shared/prompts` (`buildCharacterIdentityPrompt`) — panels, plate, lighting and craft clauses included — and appends your `userNotes`. Use `userNotes` for what the template can't know: *"use the woman on the left"*, *"keep the scar on the right cheek"*. A hand-written prompt is a fork of the template and will drift from it.

- Estimate cost first with `slates_estimate_generation_cost` and announce in **credits** — never quote a price from memory.
<!-- /slates-only -->

- Default to Nano Banana 2 at 2K. **Never 4K** — no identity gain at sheet scale, wasted spend.
- When the result returns inline, **evaluate it before binding**:
  - Is the portrait clearly the largest panel, and is it off-frontal?
  - **Is the front body panel cleanly headless** — an empty collar with the garment holding its shape, no partial face, no floating jaw, no smeared neck stump? A botched crop is worse than no crop.
  - Do the body panels read as the same build, wardrobe and hair as the portrait?
  - Catchlights present, irises readable rather than black holes?
  - Is it in the source's medium, and does it read as *that* medium done well — or has it drifted toward the over-clean game-model look?
  - Plate a flat deep grey, not white and not black?
- If off: one focused refinement, then regenerate. The sheet is upstream of everything — it is worth a re-roll that a scene frame is not.
<!-- slates-only -->
- The op binds the result as the canonical identity automatically.

### Hand back
> "Character {name} ready — identity sheet bound. Use `@{name}` in any prompt and Slates attaches it and names it inline, so the face stays consistent."
<!-- /slates-only -->

## How the reference gets used at scene time

Slates cites the sheet inline under the character's name — `{name} (image N)` — in the exact order it sends references. That **name** is the anti-averaging lever, and it is each model's own official mechanism (NB2: "assign a distinct name"; Seedance: `Reference <Subject_N> in <Image_N>`; Kling: reuse a fixed label verbatim).

Critically, the app injects **no** wardrobe, expression, or lighting directive. The user's scene prompt owns all of that — which is why `@{name}` dropped into a movie-still injection keeps the still's own clothing and lighting instead of dragging the sheet's.

## Anti-patterns

- **Don't** studio-light, white-background, or black-background the sheet. White bleeds into the video and washes out the location; black eats edge detail. Flat, even, shadowless light on a deep neutral grey.
- **Don't** hand-write the sheet prompt when the op will build it — that is how the template and the shipped prompt fork.
- **Don't** create a second character image. One canonical identity is what the storyboard pipeline reads.
- **Don't** skip binding. An unbound asset doesn't help downstream.
- **Don't** invent character details. Stick to what's in the reference image and the user's description.
- **Don't** describe the headless front panel as removal or decapitation — in `userNotes` or any hand-written variant. The template asks for it as *framing* — "cropped at the collarbone, head not shown, invisible-mannequin presentation" — which is a standard e-commerce genre with deep training data. Removal phrasing is untested and invites a refusal.
- **Don't** use 4K — wastes credits, no quality gain at sheet scale.
- **Don't** feed a multi-view sheet into a Seedance shot that has **several characters in frame** without binding each character to its image and appending the anti-twin constraint — ByteDance documents multi-view assets as a cause of duplicate characters. See `slates-prompting-seedance`.
