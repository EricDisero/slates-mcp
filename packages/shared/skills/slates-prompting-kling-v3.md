---
name: slates-prompting-kling-v3
description: How to prompt Kling V3.0 (Kuaishou). Read before calling slates_generate_video with kling-v3.0-std, kling-v3.0-pro, or kling-v3.0-omni. Kling has dialogue + SFX + ambient native syntax (Omni adds multi-character dialogue and language codes). Multi-shot rules differ from Seedance/Veo — don't cross syntaxes.
---

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

Pick by capability: need dialogue/audio → Omni; need maximum visual quality silent → Pro; everything else → Standard. Prices change — call `slates_estimate_generation_cost` or `slates_list_available_models` for current numbers before choosing a tier.

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

## Pre-flight: references arrive inline, refer by code

When you call `slates_generate_video` with `firstFrameAssetId` or `ingredientAssetIds`, the first call returns those references **inline as image content blocks** alongside cost + `requires_confirm: true`. Look at them, revise prompt if needed, then re-call with `confirm=true`. Kling Omni multi-character with several ingredient images especially benefits — confirm each character image lands cleanly before spending.

When talking to the user about the gen, refer to each reference by its short code: `IMG-A12 — Detective Closeup`. The user sees that code as a gallery badge.

- ✅ "I'm anchoring on **IMG-A12** as the detective and **IMG-A18** as the alleyway environment — Omni will handle the line delivery in EN."
- ❌ "I'm using the detective image and the alley one..." (which alley? Three exist.)

## Sources

- [fal.ai — Kling 3.0 Prompting Guide](https://blog.fal.ai/kling-3-0-prompting-guide/)
- [Vidguru — Kling 3.0 Omni Guide](https://www.vidguru.ai/blog/kling-3.0-omni-guide.html)
- [AcceptPrompt — Kling 3 Prompt Guide](https://www.acceptprompt.com/blog/kling-3-prompt-guide)
- [DataCamp — Kling 3.0 Tutorial](https://www.datacamp.com/tutorial/kling-3-0)
