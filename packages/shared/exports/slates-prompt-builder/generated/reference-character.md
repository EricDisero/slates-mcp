<!-- Generated from the Slates production prompting guides. Do not edit — this file is rebuilt from source. -->

> Generated from the production Slates guide. Model-specific syntax and measured examples apply to the endpoints named below. For another generation tool, check its current schema and reference handling; its limits, billing and defaults may differ.

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
| **Full-body front, relaxed A-pose — cropped at the collarbone, just the face cropped out** | Build, proportion, wardrobe. The face is cropped off on purpose: a front-facing body panel renders a ~40px face that can't match the portrait's, so the sheet would carry two competing identities and the model averages them. **Only the face** — neck, arms and hands render as skin. |
| **Full-body back, head and hair visible** | Hair fall and the back of the outfit — the only panel where either reads. Keeps its head because there's no face to compete with. |

The rule is **kill every competing rendering of the FACE, not every head** — which is why exactly one body panel is headless.

On a deep neutral-grey plate (hex `3a3a3c`, written bare; since the composer fix `#3a3a3c` reads the same — see the resolved composer hazard in Don'ts), flat and shadowless, with catchlights in the eyes, irises never crushed to black, surface texture at the medium's own natural level of detail, broken symmetry, and no over-clean 3D-game-model look. Expression is **a slight natural smile with the teeth just visible** — a closed mouth carries no dental information, so every downstream smiling shot invents teeth, and teeth are person-specific.

**Two carve-outs, scoped differently on purpose.** Non-human characters get a natural neutral expression instead of a smile — that one is scoped by *having a human mouth*, so a bipedal robot or humanoid alien is covered. Quadrupeds and non-bipedal characters get a natural standing stance with the head shown on both body panels — that one is *anatomical*. **Both are conditionals the image model evaluates against your reference; neither is a code branch, because the op has no character-kind input.**

**The sheet inherits the source's medium** — photo, anime, illustration, painterly, 3D render — unless the user explicitly asks for a transform. None of the craft clauses above override that: they ask for *readable* eyes and *material-looking* surfaces within whatever medium the character is in, not for photorealism.

**Why one sheet.** Every `@character` mention attaches that character's canonical identity image, so each character costs one reference slot. It also reduces competing facial renderings to **one** — with the front panel headless and the back panel turned away, the portrait is the only face on the sheet, so there is nothing left to average.

## Workflow

### Get the reference
The user has either:
- Pasted/uploaded an image of the character (real person, drawing, AI render).
- Described the character in text only.

If image: upload it as a reference.
If text only: generate from prompt-only — less consistent, so warn the user.

### Generate the sheet

Attach the source portrait to your image generator and submit this canonical sheet prompt. For a text-only character, add the user's visual description.

```text
A single character identity reference sheet of one character, three panels side by side on one plate: a large chest-up portrait on the left at a three-quarter angle (never dead-on), a full-body front view in a relaxed A-pose in the centre, cropped at the collarbone — an invisible-mannequin presentation with just the face cropped out, and a full-body back view on the right with the head and hair fully visible. The portrait is the largest panel and occupies roughly a quarter to a third of the sheet — it is the sole authority for the face, so render it at maximum facial detail. No second rendering of the face anywhere on the sheet. A slight natural smile with the teeth just visible, and identical appearance, wardrobe and hair across all three panels. Preserve the artistic medium and visual style of the reference image (photograph, anime, illustration, 3D render, painterly, etc.). Render on a plain, deep neutral-grey background (hex 3a3a3c) with flat, even, shadowless lighting so the sheet captures the character's identity, not scene lighting. Crisp catchlights in the eyes and open, readable irises — never crushed to black. Render surface texture at the medium's own natural level of detail — skin, hair and fabric should read as material, not airbrushed or plastic. Break perfect symmetry — avoid a mirrored face or dead-square framing. Whatever the medium, avoid the over-clean 3D-game-model look. For non-human characters, use a natural neutral expression instead of a smile. For quadruped or non-bipedal characters, replace the A-pose with a natural standing stance, show the whole animal including the head on both body panels, and keep the same three-panel layout. No text, no labels, no captions, no panel borders.
```

If the user requests a style transform, replace `Preserve the artistic medium and visual style of the reference image (photograph, anime, illustration, 3D render, painterly, etc.).` with that explicit transform; do not ask for both preservation and transformation. Append only user-specific identity details.

After inspection, save one approved sheet under the character's name. Attach that same sheet to every shot containing the character and name its reference inline using the selected model's syntax. Keep the attachment order stable and inspect the target tool's reference limits.

- When the result returns inline, **evaluate the sheet before reuse**:
  - Is the portrait clearly the largest panel, and is it off-frontal?
  - **Is the front body panel cleanly headless** — an empty collar above a normally rendered body, no partial face, no floating jaw, no smeared neck stump? A botched crop is worse than no crop.
  - **Is the body still there?** Neck, forearms and hands rendered as skin, not an empty outfit floating on nothing. A hollow garment means the invisible-mannequin genre ran unbounded.
  - Do the body panels read as the same build, wardrobe and hair as the portrait?
  - Catchlights present, irises readable rather than black holes?
  - Is it in the source's medium, and does it read as *that* medium done well — or has it drifted toward the over-clean game-model look?
  - Plate a flat deep grey, not white and not black?
- If off: one focused refinement, then regenerate. The sheet is upstream of everything — it is worth a re-roll that a scene frame is not.

## How the reference gets used at scene time

Slates cites the sheet inline under the character's name — `{name} (image N)` — in the exact order it sends references. That **name** is the anti-averaging lever, and it is each model's own official mechanism (NB2: "assign a distinct name"; Seedance: `Reference <Subject_N> in <Image_N>`; Kling: reuse a fixed label verbatim).

Critically, the app injects **no** wardrobe, expression, or lighting directive. The user's scene prompt owns all of that — which is why `@{name}` dropped into a movie-still injection keeps the still's own clothing and lighting instead of dragging the sheet's.

## Anti-patterns

- **Don't** studio-light, white-background, or black-background the sheet. White bleeds into the video and washes out the location; black eats edge detail. Flat, even, shadowless light on a deep neutral grey.
- **Don't** create a second character image. One canonical identity is what the storyboard pipeline reads.
- **Don't** invent character details. Stick to what's in the reference image and the user's description.
- **Don't** describe the front panel's crop as an absent head — in `userNotes` or any hand-written variant. The template asks for it as *framing*: **"cropped at the collarbone, an invisible-mannequin presentation with just the face cropped out"**, a standard e-commerce genre with deep training data. **"the head not shown" is a hard 422 on GPT Image** (measured on `gpt-image-2`, the model 2.5 replaced; the classifier is OpenAI's, not the version's, so the rule carries — but nobody has re-run it on Flare or Sunburst) — fal returns `content_policy_violation` with `loc: ["body","prompt"]`, so the text is rejected before any image is read, because an anatomical absence reads as gore to OpenAI's classifier. It passed NB2, which is why the original receipt looked safe: **it was model-scoped.** State an exclusion as a framing choice, never as a missing body part.
- **Don't** invoke the invisible-mannequin genre without bounding it to the face. **"an invisible-mannequin presentation where the clothing holds its own shape" removed all the skin** — no neck, no hands, no forearms, a garment floating on nothing — because that *is* the e-commerce genre in full: an empty outfit. **"with just the face cropped out"** keeps the anchor and bounds it. Generalises: a genre anchor imports the whole genre, so name what STAYS, not only what goes.
**Resolved composer hazard:** on 2026-07-30, `#3a3a3c` reached fal as `background ()` because unresolved sigils were deleted. The composer now preserves unresolved `#` and `@` text byte-for-byte; a token binds a reference only when it resolves. Literal hex colours and handles are safe. The sheet template keeps its bare hex as a wording choice, not a workaround.
- **Don't** use 4K — wastes credits, no quality gain at sheet scale.
- **Don't** feed a multi-view sheet into a Seedance 2.0 shot that has **several characters in frame** without binding each character to its image and appending the anti-twin constraint; ByteDance documents multi-view assets as a cause of duplicate characters on 2.0. See `reference-seedance.md`. Seedance 2.5 supports multi-view subject references; see `reference-seedance-2-5.md`.
