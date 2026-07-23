<!-- Generated from the Slates production prompting guides. Do not edit — this file is rebuilt from source. -->

> **This is the real thing.** Every rule below is the working doctrine Slates runs in production against this model — not a summary written for a handout. Slates automates it end to end; the doctrine works by hand too.

# Seedance 2.0 — prompting

ByteDance's video model — first-party via **BytePlus ModelArk** (credits only, no BYOK). Audio always generated alongside the video. Single model `seedance-2` across the full resolution ladder (480p / 720p / 1080p / native 4K — 4K video is Pro-only, default 1080p), 4–15s, first+last frame, and up to 9 reference images / 3 videos / 3 audio clips.

> **How to read this file.**
> **[official :NNNN]** — ByteDance's own BytePlus ModelArk prompting guide, line `NNNN` of the archived doc dump (`research/seedance-2-modelark-docs.md`). Receipt-grade; treat as law.
> **[community]** — third-party guides and our own field notes. Useful, but an `[official]` block always wins.
> **[slates]** — how the Slates app composes or bills this; not ByteDance doctrine.
>
> The split is load-bearing. A community-sourced "narrative timing beats" doctrine shipped in this file for months teaching the **exact inverse** of ByteDance's published guidance. Never merge the two registers again.

---

# Part 1 — Official ByteDance doctrine

## What Seedance actually is `[official :1450-1452]`

Seedance 2.0 is a multimodal AI director. It reads text, images, video and audio **simultaneously** and internally decomposes them into two dimensions:

- the **spatial layer** — what is in the frame
- the **temporal layer** — how things change over time

So a good prompt is **not "copywriting-style description" but an "engineering-style instruction"**: who, in what scene, doing what action, how the camera moves, and in what chronological order events occur — delivered respectively to the spatial layer and the temporal layer.

## The advanced formula — 8 slots `[official :1455]`

```text
precise subject + action details + scene/environment + lighting & color tone
+ camera movement + visual style + image quality + constraints
```

⚠️ There is **no official "6-step formula."** `Subject + Action + Environment + Camera + Style + Constraints` is community branding with no ByteDance source, and it silently drops the **lighting & color tone** and **image quality** slots. Use the 8 slots above.

## Task-type sentence patterns `[official :1389-1425]`

Seedance classifies your request from the phrasing. Use the pattern that matches the task:

| Task | Pattern |
|---|---|
| **Image reference** | ``Reference `<Subject_N>` in `<Image_N>` to generate…`` |
| **Video reference** | ``Reference `<Action / Camera_movement / Style / Sound_effect>` in `<Video_N>` to generate…`` |
| **Audio reference** | ``Reference the timbre in `<Audio_N>` to generate…`` |
| **Video edit — modify** | ``Strictly edit `<Video_N>`, and modify `<Original_Characteristic>` in it to `<New_Characteristic>``` |
| **Video edit — add** | ``<Element_Features>` + `<Timing>` + `<Location>`` |
| **Video edit — delete** | Name what to delete; for anything that must stay, say so explicitly |
| **Video extend** | ``Extend `<Video_N>` forward/backward to generate…`` |
| **Combined** | ``Reference `[Dimension]` of `<Image/Video_N>`, strictly edit `<Video_X>`, `[Specific_Edits]``` |

### ⚠️ Edit / extend phrasing landmine `[official :1431]`

> *"For edit / extend video tasks, directly use `<Video_N>` to refer to the video. **Do not use "reference `<Video_N>`"**, to avoid being incorrectly identified as a reference task."*

This is easy to trip: Slates has an edit lane. Writing *"reference video 1 and change the jacket to red"* gets classified as a **reference** task — the model generates a brand-new clip inspired by the source instead of editing it. Write *"Strictly edit video 1, and modify the blue jacket to red."*

## Shot structure — "Shot 1 / Shot 2 / Shot 3" `[official :1563-1598]`

> *"Use shot order, write a simple 'Shot 1 / Shot 2 / Shot 3' storyboard for each segment of the video, and then merge them into a complete prompt."*

**❌ Never second-stamp.** No `0:00–0:03`, no "At 4 seconds", no per-segment durations.

> *"Do not impose strict limits on the duration of each segment; prioritize allowing the model to naturally generate the pacing based on the plot."* `[:1580]`
>
> *"The model's support for precise timing (such as 0–3 seconds) is **unstable**, and forcibly limiting duration may lead to **abnormal generation results**."* `[:1586]`

Order shots by when events occur — primary first, secondary later. Let the plot set the pacing.

**Per-shot internal order** `[official :1590-1598]` — organize each shot in exactly this sequence:

1. **Camera movement or shot transition** — "slowly push in from a wide shot", "fixed camera position", "cut to…"
2. **Subject actions and expressions** — the key actions and expression changes of the core character/object
3. **Position or spatial change** — where the subject is, and how that relationship shifts
4. **Audio** — sound effects, voices, background music for that shot

**One primary camera move per shot** — see Camera below. `[official :1648]`

## Subject binding — names + image indexes `[official :1488-1556]`

Every time a subject appears, it must be **explicitly referred to**. Two supported forms:

- **Undefined subjects** — bind inline every mention: `<Subject_N>@<Image_N>`. Official example: **`Zhang San@Image 1`**. `[:1540]`
- **Pre-declared subjects** — define once, then reuse the same label verbatim: *"Define the tall man in **Video 1** as **police officer**, and define the other short man as **thief**"*, then say "police officer" every time after. `[:1514]`

**One subject spread across several assets** — bind them together: *"Define `[…]` in **Image 1** and `[…]` in **Image 2** as `<Subject N>`."* `[:1514]`

⚠️ **An Asset ID must never substitute for `<Image/Video_N>`.** `[:1546]` *"the model cannot directly associate the Asset ID with the reference content."* Always cite by index.

Also official: keep descriptions concise, avoid redundancy, avoid semantic conflicts (contradictory traits for one subject), and prefer expressing spatial relationships through reference images rather than dense text. `[:1550-1556]`

**`[slates]`** — the app composes this for you. `composeReferences()` cites each reference inline as `Name (image N)` / `Name (images 1 and 2)` in the exact order it sends them, which is ByteDance's own duplicate-character format (*"Zhang San (corresponding to image 1)"* `[:1976]`). You never hand-write role labels or index numbers.

## Action description `[official :1602-1621]`

- **Body-part specificity + quantified degree.** Name hands, legs, head, shoulders, back — and supplement **range, speed, and force**. *"slowly raise a hand", "quickly turn the head", "push hard off the ground", "slightly lower the head."*
- **Prioritize slow, gentle, continuous small movements.** Avoid high-burst, large-dynamic actions — sprinting, big jumps, violent rolls. *"walk slowly", "gently raise a hand", "sit down naturally with the motion."* **This is the official basis for the folk rule that "fast" degrades quality** — it is not a banned token, it is a class of motion the model handles badly.
- **Supplement transitions between actions.** Specify inertia and continuity between consecutive beats so movement reads coherent: *"use the inertia of turning around to naturally raise a hand", "naturally transition from a pause into raising a hand."*

## Externalize emotion `[official :1623-1636]`

Replace abstract emotion words ("very sad", "extremely angry") with **specific physical detail**. This is the highest-leverage single habit in the official guide:

| Abstract | Externalized as actions and details |
|---|---|
| **Sadness** | head lowering, shoulders trembling slightly, eyes reddening, fingers unconsciously clutching the corner of clothing, tears welling but not falling |
| **Joy** | corners of the mouth rising uncontrollably, brows and eyes relaxing, steps becoming light, unconsciously humming a tune |
| **Nervousness / anxiety** | frequently checking the watch, fingers constantly tapping the tabletop, rapid breathing, eyes darting away |
| **Anger** | both fists clenched, jawline tense, chest heaving, eyes sharp, squeezing words out through gritted teeth |
| **Relief** | letting out a long breath, tense shoulders completely relaxing, a faint smile appearing, looking up toward the distance |

## Camera `[official :1643-1648]`

> *"The model has a **strong understanding of camera movement terms**, so you can **directly use standard camera movement terminology**, such as 'medium shot, close-up, wide shot, slow push-in, smooth lateral tracking, fixed shot.'"*

This is an **open vocabulary, not a fixed list** — and it explicitly includes **shot size** (close-up / medium / wide / long shot), which is as much a camera instruction as the move itself.

> ⚠️ *"Try to specify only 1 type of camera movement in a single shot. Do not require push, pull, pan, and move at the same time, as this will increase image instability."* `[:1648]`

## Image quality, style, and constraints `[official :1656-1679]`

These three slots "define creative boundaries for the model, unify image quality and artistic tone, and avoid visual flaws and random deviations."

**1. Image quality** — define clarity, texture detail, and lighting quality. Official vocabulary: `HD` · `rich details` · `cinematic texture` · `natural colors` · `soft lighting`.

> ⚠️ This is a **real slot with real vocabulary** — do not confuse it with Stable-Diffusion-era quality incantations. `8K` / `masterpiece` / `trending on artstation` remain banned slop tokens (see Part 3); *"cinematic texture, rich details, natural colors"* is the officially sanctioned way to ask for the same thing.

**2. Style** — the overall art style and visual tone: `cyberpunk cool blue-purple tone` · `retro film` · `fresh Japanese style`.

**3. Constraint words** — *"Constraint words are very important. They can effectively avoid visual flaws, deformities, breakdowns, and unreasonable elements."* Official templates, verbatim:

- **No subtitles** — "keep it subtitle-free" / "avoid generating any text or subtitles"
- **No logo** — "do not generate a logo"
- **No watermark** — "do not generate a watermark"

Seedance has **no `negativePrompt` field** — constraints go inline in this slot. See Part 3 for the wider inline-negative kit.

## 🔴 Duplicated characters — the twin problem `[official :1948-1994]`

**Symptom:** in frames with **many characters**, where **three-view / multi-view character images** are supplied as references, two identical characters appear in the same generated frame.

**Root causes** `[:1954-1959]`:
1. Character subjects are not clearly defined in the prompt, so the model cannot distinguish roles.
2. *"When character **three-view / multi-view images** are used as reference assets, it is easy to confuse the model's character recognition, causing it to generate duplicate characters of the same appearance."*

**Official fixes, in their order** `[:1971-1994]` — ByteDance is explicit that these *reduce probability*, not eliminate it:

1. **Bind each character to its image explicitly**, in a consistent format. Official example: *"Zhang San (corresponding to image 1) throws the green passbook toward Li Si (corresponding to image 2), who is standing."*
2. **Append the global constraint verbatim** at the end of the prompt `[:1982]`:
   > *"Throughout the video, characters with completely identical appearance, clothing, and accessories are prohibited. Do not generate duplicate avatars or a twin effect. Keep only a single corresponding character in the same frame, and do not reproduce repeated copies of characters."*
3. **Optimize reference assets** `[:1988]` — *"For character reference images, prioritize independent single-person photos. Three-view or multi-view assets are not recommended."*
4. **Simplify the prompt** — do not paste a whole script; redundant copy confuses the model.

**Scope this honestly.** This is troubleshooting for the twin problem in **multi-character frames**, not a blanket verdict on turnaround sheets. Practical rule for Slates:

- **Multi-character Seedance shot** → bind every character to its image, append the anti-twin constraint, and prefer single-person / dominant-portrait references over multi-view sheets.
- **Single-character shot** → the standard character-sheet flow is fine.

**Too many reference people** `[official :2048-2052]` — past **4 reference people**, output stability drops (wrong headcount, duplicates). Official workaround: group the cast into images of ≤4 people each, generate those stills first, then drive the video from them.

## Worked examples `[official :1689-1745]`

These are ByteDance's own end-to-end cases. Note the shape: an asset-binding preamble, then `Shot N` blocks in event order, then a trailing style + stability paragraph. No time stamps anywhere.

**Example 1 — dormitory emotional short drama (dialogue-focused).** Assets: `@Image 1` half-body photo of the female lead · `@Image 2` dormitory scene reference · `@Video 1` camera-movement reference · `@Audio 1` indoor ambience.

> Use the girl in @Image 1 as the main character, use @Image 2 as the dormitory scene style reference, and refer to the camera movement in @Video 1.
>
> **Shot 1**: At dusk, **girl @Image 1** walks briskly to the **dormitory entrance @Image 2**. The camera follows steadily in a medium shot. Warm yellow sunlight spills into the hallway from the window. She pauses at the doorway, takes a deep breath, and looks slightly nervous.
>
> **Shot 2**: **Girl @Image 1** pushes the door open and enters the dormitory. The camera cuts to an indoor medium shot. Her roommates look up at her while organizing their books. One of them smiles and asks {How did the exam go? Did you pass?}. The camera slowly cuts between half-body close-ups of several people.
>
> **Shot 3**: **Girl @Image 1** first lowers her head with a dejected expression. The camera gives her a close-up. Then she raises her head, unable to hold back a smile, laughs out loud, and says {I was kidding}. Her roommates start chasing and play-fighting with her. The camera slowly pulls back and freezes on a wide shot of the dormitory filled with laughter.
>
> The entire video should have a high-definition cinematic documentary style, with warm tones and soft lighting. The character's face remains stable without deformation; movements are natural and smooth, with no stutter or flicker. The ambient sound blends naturally with @Audio 1.

**Example 2 — ancient-style cliff confrontation (action/atmosphere-focused).** Assets: `@Image 1` female lead in red · `@Image 2` assassin in black · `@Image 3` cliff and bamboo forest · `@Video 1` martial-arts camera reference · `@Audio 1` drum beats.

> Use the woman in red from @Image 1 as the female lead, use the woman in black from @Image 2 as the opponent, use the cliff and bamboo forest environment in @Image 3 as the scene reference, refer to the overall camera movement and action rhythm in @Video 1, and synchronize the background sound effects with @Audio 1.
>
> **Shot 1**: At dusk, the camera slowly pushes in from a side medium shot of **woman in red @Image 1**. She stands at the edge of the cliff and lifts a wine flask to drink. Her sleeves and robe hem sway gently in the mountain wind. The camera circles halfway around her, moving from the front to her back. In the distance, a figure in black is faintly visible in the bamboo forest.
>
> **Shot 2**: The camera zooms and fades into a long shot. From a drone perspective, it overlooks the entire cliff and bamboo forest. The two characters stand at opposite ends of the cliff. The mountain wind lifts their robe hems and dust, and the rhythm slightly accelerates with the drum beats.
>
> **Shot 3**: The camera cuts back to a ground-level close shot. The two slowly draw their swords and face off. **Woman in red @Image 1** shifts from a careless expression to a cold gaze. **Woman in black @Image 2** looks determined, and the sword tip trembles slightly. The camera steadily follows the two as they circle each other, finally freezing on a close-up of the instant before the two swords meet.
>
> The overall visual style should feel like a cinematic wuxia world in misty rain, with cool tones, low saturation, a film-grain texture, and rich light-and-shadow layers. The characters' faces and body proportions remain stable without deformation. Movements are continuous and natural, not stiff, with no clipping or stutter.

## Other official notes

- **On-screen text** `[official :1758]` — Seedance can render common text (ad slogans, subtitles, speech bubbles) and will auto-match style/colour from context, or take an explicit colour / style / timing / position. Prefer **common characters**; avoid rare glyphs and special symbols. (For *guaranteed* legible text, the start-frame route in Part 3 is still safer.)
- **Extension degrades quality** `[official :2004-2024]` — using a generated video as the input for extension compounds degradation, with mottled colour blocks in face regions. Limit repeated continuations; prefer HD assets as input.
- **Special effects that miss** `[official :2031-2044]` — when a described effect comes out wrong (a countdown that scrolls randomly), define it with a **reference video** instead of words: *"the way the number '2999' appears should reference video 1."*

---

# Part 2 — Slates-specific `[slates]`

## Reference media — caps and transport

Reference-to-video accepts up to **9 reference images, 3 reference videos, 3 audio clips** `[official :275-281]`. Text+audio-only and audio-only inputs are not supported.

**Mutually exclusive:** first-frame/last-frame mode CANNOT be combined with reference images. The error reads `"first/last frame content cannot be mixed with reference media content."` Pick one or the other. *(Official note `[:284]`: you can approximate first/last frames via prompt wording inside a multimodal call, but if the frames must be exact, use the dedicated first/last-frame route.)*

### Motion transfer & lip-sync recipes (reference video / audio)

These aren't separate Seedance features — they're prompting strategies over reference media.

- **Motion transfer:** subject image as a reference + the driving clip (2–15s) + `The character from image 1 performs the exact motion, choreography, and camera movement from video 1. Preserve the character's identity, appearance, and outfit.`
- **Lip-sync / dialogue:** write the line in the prompt — `The person in video 1 says: "…"` — with audio generation on (always on in Slates). A **video** source's own voice is cloned natively; an **audio** reference (≤15s) drives speech from an existing recording: `…speaks the dialogue from audio 1 with accurate lip sync.`
- **Voice + face from one clip (the talking-head recipe):** ONE unedited 2–15s clip of the person speaking (clear voice, no music, no cuts) as the video reference + prompt with the new script → their likeness AND voice deliver the new line.

## Reference rules (the verified ones)

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
3. **One identity sheet per character — and whatever you do attach for a subject, NAME it as one entity.** A character's identity sheet is a single asset (dominant portrait + body panels), so attach that one asset rather than a pile of views: **fewer competing renderings of a face is always better, because the model cannot tell which one is authoritative and averages them.** Where a character carries a second bound sheet — an explicit expression range, or a legacy turnaround+expression pair — cite BOTH under the SAME name, `Marcus (images 1 and 2)`. That shared name, not a role essay, is what tells the model they are ONE person and stops the varied expressions from averaging the face. **Do NOT hand-write a "Reference Image Instructions" block or role essays** ("use for identity, ignore the outfit, render a neutral expression") — that drags the sheet's studio lighting and wardrobe into a scene that asked for neither. The prompt leads; the user's words own wardrobe, expression, lighting, and action.
4. **Flat-light identity refs.** Prep identity references with flat, even, shadowless lighting on a plain neutral background. A studio-lit or scene-lit character sheet bleeds its lighting into every generation — the failure looks like the subject was green-screen-pasted in front of the location. Reference prep beats prompting here.
5. **Environment: describe it, don't feed a grid.** Default to describing the location in words and let the model build a space that fits the shot. Reserve an environment reference for a mandatory exact-match, and then use ONE clean establishing image with natural ambient light that reads as the location's real light — never a multi-panel grid fed whole.
6. **Grids: explore, don't input.** Use grids to explore compositions cheaply, then pick a cell. Never feed a grid back in as a reference — the cells share a split detail budget and were generated jointly, so their flaws propagate.
7. **Reuse the same refs across every shot** in a sequence. Lock a set and keep it; swapping references mid-sequence causes drift, because the model adapts each reference to the current prompt rather than copying it.
8. **Legible in-shot text → bake it into a still start frame, never trust text-to-video.** Have an image model render the text, then animate from that locked frame. Video models smear type.
9. **Working from existing media — describe ONLY what changes.** The source already carries its composition, motion, timing, and performance; re-describing them fights the model. Narrate the delta. (Video lane: restyle your own clip while keeping the performance; delayed-VFX on "video one"; marker-object insertion; video-as-reference for a series.)
10. **Style transforms happen in natural language.** By default the source's artistic medium and visual style are inherited. To change it, add a plain-text instruction ("anime → real person"). There are no preset pickers, and there is no style slider.
<!-- @end:reference-rules-core -->

### For Seedance specifically

- **Describe the ACTION, never the reference's content.** With refs attached, prompt only what is *happening* — motion, change, camera. Never re-describe what's in the reference, and never say "still / scene / from a movie / from the image." The model already sees the refs; narrating them wastes tokens and induces drift. Injection is stochastic — if a roll misses, **re-roll, don't re-engineer** (and a slow gen is not a failed one).
- **Seedance's own idiom for rule 2 is `Reference <Subject_N> in <Image_N>`** `[official :1389]` — `Image_N` indexes the order the refs are attached, so the name plus the index carries the role. The full binding grammar is in Part 1 (Subject binding).
- **Rule 3 has an official ceiling here.** The trend is MORE references (video and audio into Seedance), all addressed by name — but for **multi-character frames** see the twin-problem section above: bind every character to its image, append the anti-twin constraint, and prefer single-person references. Past 4 reference people, stability drops `[official :2048-2052]`.
- **Rule 8 holds even though Seedance can render common text natively** `[official :1758]`. A baked NB2 start frame is still the reliable route for text that must be legible.
- **Rule 5 pairs with the first/last-frame exclusion** — frames and reference images are mutually exclusive on this model (see Reference media above), so an environment you must match exactly costs you the frame lane.

---

# Part 3 — Community field notes `[community]`

Third-party guides and Slates field experience. Useful heuristics — but if one of these ever appears to contradict Part 1, **Part 1 wins**.

## Length

**Sweet spot 60-150 words** for a single shot (not 150-300 — that's the upper bound). Multi-shot storyboards run longer; official Example 1 above is ~230 words across three shots.

## Pin the subject in the first 20-30 words

The opening sentence is the **identity anchor**. If the subject isn't locked early, the model hallucinates new subjects mid-clip. (Compatible with Part 1: the binding preamble comes before `Shot 1`.)

```
A matte black earbud case sits on a polished obsidian surface...
```

## Lighting is a top quality lever

Lighting has an outsized impact on output quality — which is why it has its own slot in the official 8-slot formula. Describe it before or alongside the subject.

```
A cool-white diagonal beam from upper left, dust particles drifting through.
Soft golden hour lighting from low west angle.
Dramatic rim light against dark background.
```

## Camera and subject motion — separate sentences

Mixing them is a common cause of glitchy / shaky output.

❌ "The camera speed ramps as the earbud rises."
✅ "The earbud rises smoothly. The camera tracks upward."

## Slow-motion works; "fast" is a known bad token

Speed ramps and slow-motion are supported in natural language, and `fast` is widely reported as a quality-degrading keyword. **The official version of this rule is stronger and better founded** — prioritize slow, gentle, continuous small movements and avoid high-burst action (Part 1, Action description `[:1611-1615]`). Prompt the motion class, not the adjective.

```
the lid opens in slow-motion · the blade whips through the air
```

**Slop tokens to avoid:** `epic`, `amazing`, `beautiful`, `lots of movement`, `8K`, `masterpiece`, `trending on artstation`. These are quality *incantations* — the officially sanctioned way to ask for quality is the image-quality slot vocabulary in Part 1 (`HD`, `rich details`, `cinematic texture`, `natural colors`, `soft lighting`).

## Style block at the end

One primary anchor + 2-3 supporting details, as the trailing paragraph (both official examples do exactly this). End with `Single continuous take` if you want one shot with no cuts. **Never** write `no cut` or `seamless transition` — not in the training vocabulary.

## ⚠️ Don't cross-pollinate image-model syntax

Named **lenses, apertures, film stocks, and camera bodies** — `85mm f/1.4`, `Kodak Portra 400`, `ARRI Alexa 65`, `shot on Sony A7S3` — are an **image-model lever** (correct and encouraged in `reference-nano-banana.md`) and a **Seedance anti-pattern**. ByteDance's guide uses shot sizes, camera moves, pacing words, and the image-quality/style vocabulary throughout, and never once mentions fps, shutter angle, f-stop, or lens millimetres.

If you are carrying a look over from an NB2 start frame, translate it: `85mm f/1.4, Portra 400` → `close-up, shallow depth of field, warm natural colors, cinematic texture, film-grain texture`.

## Negative prompting — inline only

Seedance has **no `negativePrompt` field**. Put negatives in the constraints slot, led by the three official templates (Part 1):

```
keep it subtitle-free · do not generate a logo · do not generate a watermark
avoid jitter and bent limbs
avoid temporal flicker
avoid identity drift
no distortion, no stretching
```

Also fine: positive reframing ("empty street" not "no cars").

## Image-to-video / first-frame guidance

**Describe motion, not image.** The model already sees the visual; tokens spent re-describing appearance are wasted.

Stability phrases that help:
- `preserve composition and colors`
- `maintain exact appearance from reference image`
- `consistent character throughout, no deformation or drift`

**Cap I2V prompts under 60 words** when possible. Over 100 words frequently triggers silent generation failure.

## Common failure modes + fixes

| Failure | Fix |
|---|---|
| Hallucinated subject mid-clip | First 20-30 words = identity anchor |
| Bent limbs / extra fingers | `avoid jitter and bent limbs` in Constraints |
| Identity drift across multi-shot | Re-name the bound subject in **every** `Shot N` block `[official :1537]` |
| Two identical characters in one frame | The twin fix in Part 1 — bind each character to its image + append the global anti-twin constraint |
| Silent generation failure on I2V | Cut prompt under 100 words, single primary camera move |
| Speech / motion conflict | Limit dialogue to one line per action shot |
| Erratic/random pacing | You second-stamped. Remove all time markers and use `Shot N` `[official :1586]` |

## Sources

**Official (authoritative):**
- BytePlus ModelArk — Seedance 2.0 prompting guide, archived at `research/seedance-2-modelark-docs.md` (all `:NNNN` refs above)

**Community (secondary):**
- [fal.ai — How to Use Seedance 2.0](https://fal.ai/learn/tools/how-to-use-seedance-2-0)
- [apiyi.com — Seedance 2.0 Prompt Guide](https://help.apiyi.com/en/seedance-2-0-prompt-guide-video-generation-camera-style-tips-en.html)
- [atlabs.ai — Ultimate Seedance 2.0 Prompting Guide](https://www.atlabs.ai/blog/the-ultimate-seedance-2.0-prompting-guide-47-prompts-2026)
