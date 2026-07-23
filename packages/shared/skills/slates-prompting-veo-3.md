---
name: slates-prompting-veo-3
description: How to prompt Veo 3.1 (Google). Read before calling slates_generate_video with veo-3.1-fast or veo-3.1-standard. Veo is a NICHE pick, never the default (route per slates-model-selection — Kling is the general default, Seedance the premium tier) — reach for it only when native synchronized audio must generate WITH the video in one gen. 16:9 only. Different cinematography formula than Seedance/Kling. (no subtitles) is mandatory after every dialogue line.
---

# Veo 3.1 — prompting

Google DeepMind's video model. Two tiers: `veo-3.1-fast` (cheaper, quick) and `veo-3.1-standard` (higher quality). 4k variants exist for both (4K video requires Slates Pro).

**Native single-shot duration: 4, 6, or 8 seconds.** Longer durations require chaining clips via Extend / last-frame reuse — quality degrades if naively requested past 8s in a single generation. Aspect ratio: **16:9 only** — `slates_generate_video` locks Veo to 16:9; anything else is ignored or fails. For 9:16 vertical, use Kling or Seedance instead.

Native synchronized audio at 48kHz: dialogue, SFX, ambient — generated WITH video, not added after.

## Official Google formula

```
[Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance]
```

Sweet spot length: 50-150 words. Cloud's official benchmark is ~50 words.

Verbatim official benchmark:
> "Medium shot, a tired corporate worker, rubbing his temples in exhaustion, in front of a bulky 1980s computer in a cluttered office late at night. The scene is lit by the harsh fluorescent overhead lights and the green glow of the monochrome monitor. Retro aesthetic, shot as if on 1980s color film, slightly grainy."

## Cinematography vocabulary (Vertex AI docs)

**Lenses:** wide-angle, telephoto, fisheye, anamorphic, 35mm, 85mm, shallow/deep depth of field

**Lighting:** Rembrandt lighting, volumetric lighting, backlighting, golden hour glow, lens flare, rack focus, **vertigo effect** (dolly zoom)

**Camera moves:** dolly (in/out), truck (left/right), pan, tilt, crane, aerial/drone, handheld, whip pan, arc shot, zoom

## Texture-realism phrases (counter the AI-plastic look)

```
fine skin pores · visible fabric weave · subtle contrast, no gloss or sharpening
```

Specify materials concretely: `charcoal cotton hoodie`, `matte concrete`, `silk lapel`. Generic "smooth, beautiful" rendering is the failure mode you're avoiding.

## Dialogue — `(no subtitles)` is mandatory

Every dialogue line you don't want burned in as text overlay needs `(no subtitles)`. Verbatim from the founder talking-head benchmark:

```
The founder says, "This update cuts setup time in half, helping teams get started faster." (no subtitles).
```

Without this, Veo will overlay subtitle text on top of your generation.

## Voice direction — keep it terse

Veo is less responsive to long voice-direction blocks than Kling. Use brief modifiers:

```
says in a weary voice
whispers
shouts
mutters
```

Multi-character: handles 2-3 speakers natively. Past 3, sync degrades — use first-frame/last-frame chaining for 4+.

## SFX with cause

```
✅ SFX: thunder cracks in the distance
❌ SFX: thunder
```

Always specify direction or distance.

## Ambient is mandatory

Always include an ambience line per scene. Without it, the audio mix feels dead.

```
Soft office ambience.
Wind on the open ridge.
Distant city hum.
```

## First-frame + last-frame workflow (Veo's strength)

1. Generate start frame (Gemini 2.5 Flash Image is the recommended pair — Slates' Nano Banana 2 works)
2. Generate end frame
3. Animate with both frames as anchors

**Motion-Lock hack:** Keep ~60% of the same background pixels between start and end frames. Prevents latent drift across the clip.

Verbatim arc-shot example:
> "The camera performs a smooth 180-degree arc shot, starting with the front-facing view of the singer and circling around her to seamlessly end on the POV shot from behind her on stage. The singer sings 'when you look me in the eyes, I can see a million stars.'"

## Ingredients-to-Video (multiple references)

Verbatim example:
> "Using the provided images for the detective, the woman, and the office setting, create a medium shot of the detective behind his desk. He looks up at the woman and says in a weary voice, 'Of all the offices in this town, you had to walk into mine.'"

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

### For Veo specifically

- **Veo's idiom for rule 2 is plain-English role naming in the sentence itself** — *"Using the provided images for the detective, the woman, and the office setting, create a medium shot of…"* (see Ingredients-to-Video above). The role rides in the noun phrase, not in a separate label block.
- **Rule 8 has a second reason to matter here:** Veo bakes subtitle text into the frame unless every dialogue line carries `(no subtitles)`. Text you did not ask for is the failure mode, not just text you did.

## Negative prompting — nouns, not instructions

Veo has a `negativePrompt` field. **Verbatim Vertex AI rule:**
> "Describe unwanted elements as nouns rather than instructions. Use 'wall, frame' instead of 'no walls' or 'don't show walls.'"

Inline: positive reframing in the body too.
- ✅ `"a desolate landscape with no buildings or roads"`
- ❌ `"no man-made structures"`

## Common failure modes + fixes

| Failure | Fix |
|---|---|
| Subject identity shifts mid-clip | Front-load identity at prompt start; use material cues (`charcoal canvas`, `cotton`, `silk`) to stabilize |
| Floaty / weightless motion | Weight verbs (`trudges`, `drops heavily`), ground contact (`boots crunch on gravel`) |
| AI-plastic look | `fine skin pores`, `visible fabric weave`, `subtle contrast` |
| Subtitles baked into video | `(no subtitles)` after every dialogue line |
| Rushed dialogue | Lines fit one natural breath in 8s |
| Mismatched ambience | Always include an ambience line |
| Warped geometry | `photorealistic stability` |

## Timestamp shot syntax (for chained / multi-beat scenes)

Veo accepts `[00:00-00:02]` brackets for timed sequences within an 8s clip. **Do NOT cross syntaxes** — Veo timestamps in a Seedance prompt cause subject drift; Seedance "single continuous take" in a Veo prompt suppresses cuts.

Verbatim multi-beat:
> "[00:00-00:02] Medium shot from behind a young female explorer with a leather satchel and messy brown hair in a ponytail, as she pushes aside a large jungle vine to reveal a hidden path.
> [00:02-00:04] Reverse shot of the explorer's freckled face, her expression filled with awe as she gazes upon ancient, moss-covered ruins. SFX: The rustle of dense leaves, distant exotic bird calls.
> [00:04-00:06] Tracking shot following the explorer as she steps into the clearing and runs her hand over the intricate carvings on a crumbling stone wall.
> [00:06-00:08] Wide, high-angle crane shot, revealing the lone explorer standing small in the center of the vast, forgotten temple complex, half-swallowed by the jungle. SFX: A swelling, gentle orchestral score begins to play."

## Benchmark prompt — founder talking head (full)

> "Camera locked at eye level, medium close-up on a 35mm lens: a startup founder in his late 30s with short black hair and light stubble, wearing a charcoal cotton hoodie, speaking directly to camera, leaning slightly forward as he speaks, lifting one hand to emphasize a point, then relaxing back to neutral, in a quiet office during late afternoon, with blurred monitors glowing faintly in the background, lit by soft daylight from a side window with gentle fill on the opposite side and natural falloff across his face. Style: fine skin pores, visible fabric weave, subtle contrast, no gloss or sharpening. Audio: The founder says, 'This update cuts setup time in half, helping teams get started faster.' (no subtitles). Soft office ambience."

## Pre-flight: references arrive inline, refer by code

When you call `slates_generate_video` with `firstFrameAssetId` / `lastFrameAssetId` / `ingredientAssetIds`, the first call returns those references **inline as image content blocks** alongside a cost estimate and `requires_confirm: true`. Veo's strongest move is first-frame + last-frame; the pre-flight is where you confirm the two frames actually anchor the motion you wrote. Revise the prompt before `confirm=true` if needed.

When talking to the user about the gen, refer to each reference by its short code: `IMG-A12 — Founder Headshot`. The user sees that code as a badge on the gallery thumbnail, so they can match what you're saying to what they're looking at.

- ✅ "I'm anchoring on **IMG-A12** as the open shot and **IMG-A18** as the close — the 180° arc lands on her looking offscreen left."
- ❌ "I'm using two of the founder shots..." (which two? They have six.)

## Sources

- [Google Cloud — Ultimate Prompting Guide for Veo 3.1](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1)
- [Google DeepMind — Veo Prompt Guide](https://deepmind.google/models/veo/prompt-guide/)
- [Google Cloud Docs — Vertex AI Video Generation Prompt Guide](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide)
- [Atlas Cloud — Veo 3.1 Master Guide](https://www.atlascloud.ai/blog/guides/google-veo-3-1-guide-master-image-to-video-ai-with-native-sound-and-4k-realism)
- [Invideo — Veo 3.1 Prompt Guide](https://invideo.io/blog/google-veo-prompt-guide/)
