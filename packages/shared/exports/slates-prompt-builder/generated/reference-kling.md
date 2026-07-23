<!-- Generated from the Slates production prompting guides. Do not edit — this file is rebuilt from source. -->

> **This is the real thing.** Every rule below is the working doctrine Slates runs in production against this model — not a summary written for a handout. Slates automates it end to end; the doctrine works by hand too.

# Kling V3.0 — prompting

Kuaishou's video model. Three tiers: `kling-v3.0-std` (general use, no audio), `kling-v3.0-pro` (higher visual quality, no audio), `kling-v3.0-omni` (multi-character dialogue + audio-visual co-generation).

Up to 15s. Multi-shot supported (up to 6 cuts in 15s total). Strong on image-to-video — preserves identity, layout, and text from the input image well.

## Subject definition rule (verbatim, fal blog)

> "Define your core subjects clearly at the beginning of the prompt and keep descriptions consistent across shots."

## Dialogue syntax

```
Character says, "exact words here"
```

Use quotation marks for precise speech. Languages (Omni only): EN, ZH, JA, KO, ES.

## Voice direction formula (Omni)

```
Gender + Age Range + Voice Quality + Speech Rate + Emotional Tone + Language
```

Example:
```
[Character A: Detective, mid-40s, raspy voice, slow cadence, weary]: "I've seen this before."
```

Tone phrases that fire:
- `speaking in a hushed, trembling whisper`
- `shouting with commanding authority`
- `clear, fearful voice`
- `with a trembling voice, "I'm scared"`

## The `Immediately` keyword (Omni only)

Without `Immediately`, Kling adds a natural conversational beat between speakers. With it, dialogue is back-to-back. Use when timing matters.

```
[Alice]: "Get down!" Immediately, [Bob]: "Where?"
```

## Speaker label discipline

Unique labels per character. **No pronouns or synonyms after first introduction** — they cause voice drift.

✅ `[Character A: Black-suited Agent]` ... `[Character A: Black-suited Agent]: "Stop."`
❌ `[Agent]... then he says...`

## Multi-character dialogue (Omni)

```
Alice says in English, "Hello!" Then Bob replies in Spanish, "¡Hola!"
```

## Sound effects, ambient noise, music

```
SFX: thunder cracks, footsteps approaching
Ambient noise: city traffic, birds chirping, ocean waves
Background music: tense orchestral strings, low cello
```

SFX accepts physical-cause specificity:
- ✅ `SFX: heavy boots on wet pavement, distant siren wailing`
- ❌ `SFX: footsteps`

## Image-to-video guidance

**Verbatim (fal blog):**
> "Treat the input image as an anchor. Kling 3.0 excels at preserving the identity, layout, and text details. Focus prompts on how the scene evolves *from* the image: subtle movements, camera motion, or environmental changes."

**Don't re-describe what's already in the image.** Focus on motion, changes, evolution.

## Multi-shot — what makes them hit

**Hard cap: total duration ≤ 15s across all shots. Max 6 cuts.**

Hit conditions:
- Shot labels are explicit: `Shot 1:`, `Shot 2:`
- One primary action per shot
- Subject described identically in each shot block
- Camera move per shot is **one verb**, not a chain
- Per-shot blocks: 30-60 words

Miss conditions:
- Compressing narrative into one paragraph
- Pronoun-only references after the first shot
- Mixing camera moves within a shot ("pan then orbit then push in")
- Extreme wide → extreme close in adjacent shots without reference images

## Element references (Omni)

Upload 2-4 multi-angle reference photos per character/object. Tag inline:

```
@element1 is the protagonist (refs: front, side, back angles).
@element2 is the antagonist.
```

## Reference discipline (character / environment refs)

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

<!-- @inject:reference-rules-core -->
Identity = a few flat-lit neutral angles; one reference per role, named inline; 2-4 refs not 12; describe environments instead of feeding a grid.

1. **2-4 strong references beat both extremes.** Not 1 (warps toward itself), not 12 (averages worse). Start with 2-3 focused refs — each one adds context AND another variable to balance.
2. **One reference per ROLE, named in the prompt** — identity / style-grade / environment. The model does **not** infer a reference's role from its position in the list; the inline name carries it. Same-role competitors drift (two "identity" refs of different people blend into a third face). Slates composes the naming for you from your `@mentions` / `#tags` — you never hand-write role labels.
3. **One identity sheet per character, named inline.** A character's identity is a single asset (dominant portrait + body panels), so attach that one asset rather than a pile of views: **fewer competing renderings of a face is better, because the model cannot tell which one is authoritative and averages them.** Slates cites it as `Marcus (image 1)`. **Do NOT hand-write a "Reference Image Instructions" block or role essays** ("use for identity, ignore the outfit, render a neutral expression") — that drags the sheet's studio lighting and wardrobe into a scene that asked for neither. The prompt leads; the user's words own wardrobe, expression, lighting, and action.
4. **Flat-light identity refs.** Prep identity references with flat, even, shadowless lighting on a plain neutral background. A studio-lit or scene-lit character sheet bleeds its lighting into every generation — the failure looks like the subject was green-screen-pasted in front of the location. Reference prep beats prompting here.
5. **Environment: describe it, don't feed a grid.** Default to describing the location in words and let the model build a space that fits the shot. Reserve an environment reference for a mandatory exact-match, and then use ONE clean establishing image with natural ambient light that reads as the location's real light — never a multi-panel grid fed whole.
6. **Grids: explore, don't input.** Use grids to explore compositions cheaply, then pick a cell. Never feed a grid back in as a reference — the cells share a split detail budget and were generated jointly, so their flaws propagate.
7. **Reuse the same refs across every shot** in a sequence. Lock a set and keep it; swapping references mid-sequence causes drift, because the model adapts each reference to the current prompt rather than copying it.
8. **Legible in-shot text → bake it into a still start frame, never trust text-to-video.** Have an image model render the text, then animate from that locked frame. Video models smear type.
9. **Working from existing media — describe ONLY what changes.** The source already carries its composition, motion, timing, and performance; re-describing them fights the model. Narrate the delta. (Video lane: restyle your own clip while keeping the performance; delayed-VFX on "video one"; marker-object insertion; video-as-reference for a series.)
10. **Style transforms happen in natural language.** By default the source's artistic medium and visual style are inherited. To change it, add a plain-text instruction ("anime → real person"). There are no preset pickers, and there is no style slider.
<!-- @end:reference-rules-core -->

### For Kling specifically

- **Kling's consistency lever is "lock the subject with a fixed label reused verbatim."** That is Kling's phrasing for rules 2 and 3, and it is stricter than the others: **pronoun and synonym drift breaks it**, so the exact same label must appear on every single mention — not "he", not "the detective" after you named him. Reusing the label verbatim is the whole game. Slates composes this for you from `@mentions`.
- **Element references are the transport for rule 1** — 2-4 multi-angle photos per character/object, tagged `@element1` / `@element2` (see Element references above). The cap is 4 combined refs on the edit path.

## Negative prompting — has a real field

Kling exposes `negative_prompt` on the fal endpoint (different from Seedance which has none). Default block to start from:

```
blurry, low quality, watermark, text overlay, distorted hands, extra fingers,
duplicate limbs, unnatural skin texture, overly saturated colors, lens flare,
floating objects, inconsistent shadows, jittery, flickering, morphing face
```

Layer scene-specific suppressions on top.

## Cinematic tactics

- **Motion adverb precision** modulates motion energy directly: `slowly`, `rapidly`, `gently`, `explosively`
- **Camera vocabulary that registers as instructions:** profile shot, tracking, following, freezing, panning, "moving in sync with the subject"
- **One primary camera move per shot** — never stack

## Tier choice

- **Standard**: general use, no audio
- **Pro**: higher visual quality, no audio
- **Omni**: multi-character dialogue, audio-visual co-gen, language codes, `@elementN` references

Pick by capability: need dialogue/audio → Omni; need maximum visual quality silent → Pro; everything else → Standard. Prices change — check current numbers before choosing a tier.

## Benchmark prompt structure

```
[Character A: <role>, <voice quality>]: "<line>." Immediately, [Character B: <role>, <voice quality>]: "<reply>."
Ambient noise: <soundscape>.
Camera <single move>.
```

Cinematic example (paraphrasing fal blog patterns):
> "Shot 1: Wide establishing shot of a neon-lit alleyway in heavy rain, steam rising from grates. Camera slowly tracks forward.
> Shot 2: Medium shot of a detective in a trench coat ducking under an awning, water dripping from his hat brim. [Detective: weary, raspy]: 'I knew she'd come back.' Ambient noise: distant traffic, rain on metal.
> Shot 3: Close-up on his eyes, narrowing as headlights flash across his face."

## Video-to-video EDIT — @Video1 / @ElementN / @ImageN

Kling O3 edit takes an EXISTING 3-15s clip and changes only what the prompt names — character swap, environment change, style transfer — in one pass, no masking. Original motion, camera, and audio are preserved by default. Its notation is Kling's own, different from the "image N" naming used everywhere else:

- **`@Video1`** — the source clip (always; the transport anchors the instruction to it).
- **`@Element1..`** — subjects to swap IN. Each element = one frontal image + up to 3 angle images.
- **`@Image1..`** — style/appearance references.
- Max **4 combined** element + image refs per edit.

**Prompt shape — the change, not the whole scene:**

```
Replace the man in @Video1 with @Element1, keeping his walk cycle, the camera move, and the rain unchanged.
```

```
Edit @Video1: turn the daytime street into a neon-lit Tokyo alley at night, wet asphalt reflections. Apply the visual style of @Image1. Keep the subject and camera motion exactly as they are.
```

Rules:
- Name what CHANGES; explicitly state what stays ("keep the motion / camera / everything else unchanged") — the model preserves better when told to.
- One edit intent per pass. Chain passes for compound changes (each output is itself an editable clip, linked to its parent).
- Billing is per second of OUTPUT ≈ the clip length, rounded UP to the next second. A 7.3s clip bills as 8s.
- Clip constraints: 3-15s, 720-3840px, MP4/MOV. Agents can pre-trim on the timeline when a clip runs long.
- Routing: Kling edit is the default edit tool (element lock + audio intact); Seedance edit/relocate wins style-transfer-heavy re-imaginings.

## Sources

- [fal.ai — Kling 3.0 Prompting Guide](https://blog.fal.ai/kling-3-0-prompting-guide/)
- [Vidguru — Kling 3.0 Omni Guide](https://www.vidguru.ai/blog/kling-3.0-omni-guide.html)
- [AcceptPrompt — Kling 3 Prompt Guide](https://www.acceptprompt.com/blog/kling-3-prompt-guide)
- [DataCamp — Kling 3.0 Tutorial](https://www.datacamp.com/tutorial/kling-3-0)
