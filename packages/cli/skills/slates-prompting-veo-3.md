---
name: slates-prompting-veo-3
description: How to prompt Veo 3.1 (Google). Read before calling slates_generate_video with veo-3.1-fast or veo-3.1-standard. Veo has the strongest first-frame + last-frame workflow of the three video models, native synchronized audio, and a different cinematography formula than Seedance/Kling. (no subtitles) is mandatory after every dialogue line.
---

# Veo 3.1 — prompting

Google DeepMind's video model. Two tiers: `veo-3.1-fast` (cheaper, quick) and `veo-3.1-standard` (higher quality). 4k variants exist for both.

**Native single-shot duration: 4, 6, or 8 seconds.** Longer durations require chaining clips via Extend / last-frame reuse — quality degrades if naively requested past 8s in a single generation. Aspect ratios: **16:9 OR 9:16**.

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
