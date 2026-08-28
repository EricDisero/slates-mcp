---
name: slates-prompting-minimax-h3
description: How to prompt MiniMax H3 and MiniMax H3 Max. Read before calling slates_generate_video with model minimax-h3 or minimax-h3-max. H3 is the only Slates video seat where AUDIO IS AUTHORED rather than toggled — synchronised dialogue, scene sound and an audience-only score are three separate sections of the prompt, generated in one pass — and the only one where a reference carries a DECLARED RELATIONSHIP (kept whole, partly kept, transferred onto a different subject, or a loose echo). Base minimax-h3 runs 480p/768p/2K/4K and reads 9 images + 3 video + 3 audio references; minimax-h3-max is fal's faster post-train, capped at 768p, takes NO references of any kind, and costs MORE than base H3 at 768p — a deliberate speed pick, never the default and never the cheap one. Two hazards live here: reference images past the fifth cost 4 credits each on the base row, and audio written into the wrong section is dropped or duplicated.
---

# MiniMax H3 — prompting

H3 is an **omni transformer**: it generates picture and sound in the same pass, at 24fps with
32kHz stereo, 5–15 seconds, in 11 stably-supported languages (Arabic, Chinese, English, French,
German, Italian, Japanese, Korean, Portuguese, Russian, Spanish). That single fact drives
everything below — the prompt is not a shot description with sound bolted on, it is a **timeline
with three audio layers you author separately**.

**Two seats, one grammar.** Everything in this file applies to both. They differ only in what the
endpoint accepts:

| | `minimax-h3` | `minimax-h3-max` |
|---|---|---|
| Resolution | 480p / 768p / **2K / 4K** | 480p / 768p |
| References | 9 images + 3 video + 3 audio (12 files) | **none — no reference endpoint exists** |
| Frames | start and/or end | start and/or end |
| Price at 768p | **$0.060/s** | $0.080/s |
| Why pick it | resolution, references, and the cheaper second | **speed** — a 5s 768p clip in **4.8s** vs **57s** (measured) |

**Max is the premium seat, not the budget one.** It is 33% dearer at the one tier they share and it
tops out lower. Route there when a fast turnaround on a text-to-video or start-frame shot is worth
paying for; route to base H3 for anything needing resolution, references, or the same tier cheaper.

**The speed is measured, not claimed** (2026-08-27, same prompt and params on both rows): a 5-second
768p text-to-video finished in **4.8 seconds** on Max against **57 seconds** on base H3 — roughly
**12x**, queue to finished file. fal advertises "under 3 seconds"; the literal claim did not hold at
4.8s wall-clock, but the order of magnitude did. For iteration loops and client-present work that gap
is the entire reason the seat exists.

---

## The one thing that makes H3 different: audio is a THREE-LAYER instruction

Every other video seat treats sound as on or off. H3 splits it, and the split is enforced by where
you write each thing. Get the section wrong and the sound is dropped, doubled, or attributed to the
wrong source.

| Layer | What belongs in it | Where it goes |
|---|---|---|
| **Synchronised events** | dialogue, singing, and any sound tied to a specific shot or action | the **body** of the prompt, on the beat it lands |
| **Scene sound** | ambience and physical sounds that run across the whole clip — room tone, rain, traffic, a ventilation hum | the **soundscape** section |
| **Score** | music the characters cannot hear; audience-only | the **music** section |

**Three rules, all from MiniMax's own guide:**

1. **Dialogue and singing NEVER go in the soundscape section.** They are synchronised events; they
   belong in the body, at the moment they happen.
2. **Diegetic music — music the characters can hear** (a radio in the scene, a busker) — also
   belongs in the **body**, not in the score section. The score section is audience-only.
3. **Write the score in instrumental terms, not mood words.** Name the instruments, the tempo, and
   how it develops. *"A restrained solo-piano score at a slow tempo, sustained low cello underneath,
   no swell"* — not *"emotional music"*.

Use **N/A** for a section only when silence or absence is genuinely what the shot wants. An empty
score section is a real choice; a vague one is a wasted layer.

### The shape, in the one prompt field

Slates sends one prompt string, so write the three layers as labelled paragraphs in this order:

```
[Shot 1] Live-action, cinematic. A medium-wide shot frames a baker opening the shutters of a
small street bakery before sunrise. The camera pushes in with small amplitude at slow speed as
the middle-aged baker with a calm, slightly raspy voice places a fresh loaf on the counter and
says: "First batch of the morning." [Shot 2] At 00:05.000, the camera cuts to a close-up of
steam rising from the sliced bread while his final words carry over from the previous shot.

Soundscape: wooden shutters scrape open over a quiet street, trays clink softly inside, a
doorbell rings once, then light footsteps and the crisp sound of bread being sliced.

Score: a soft acoustic-guitar pattern at a moderate tempo, joined by sparse upright-bass notes,
gentle fade at the end.
```

**Body target: 350–500 words** for a reference-carrying shot. Dialogue-heavy content prioritises
fitting the complete spoken timeline over hitting a word count.

🚨 **Slates disables the provider's prompt expander.** H3's API can rewrite your prompt before
generation; Slates turns that off, because a model rewriting the user's words invisibly is banned
outright (prompt transparency: what the composer shows is what the model gets). The practical
consequence is on you: **nothing will pad a thin prompt.** Write the whole body.

---

## Shots and timing

The first shot carries **no timestamp**. Every later shot opens with the bracket and a cut time
that increases and stays inside the clip length:

```
[Shot 2] At 00:03.500, the camera cuts to ...
```

Transition verbs the model knows: **cuts to · transitions to · changes to · switches to**.

**Dialogue that continues across a cut** needs the continuity said out loud — *"his final words
carry over from the previous shot"* — or the line restarts. **Speech that ends abruptly** should be
described as cut off rather than trailed off.

---

## Camera — write the move into the sentence

The model has a named motion vocabulary:

> Zoom In / Zoom Out · Push In / Pull Out · Pan Left / Pan Right · Truck Left / Truck Right ·
> Tilt Up / Tilt Down · Pedestal Up / Pedestal Down · Arc Shot · Tracking Shot · Static Shot ·
> Shake Slightly / Shake Strongly · POV · Roll Clockwise / Roll Counterclockwise

Modify with **amplitude** (`with small amplitude` / `with large amplitude`) and **speed**
(`at slow speed` / `at fast speed`).

🚨 **Integrate the motion into the sentence — never stack labels.** MiniMax's own example:
*"The camera pushes in with small amplitude at slow speed toward the folded letter in her hands."*
Not *"Push In. Small amplitude. Slow."*

---

## Speakers and dialogue

Give each speaking character a stable identity in the prose and keep it: describe the voice once
(*"a young woman with a quiet, breathy voice"*), then refer back to the same description at every
line. Identification, delivery and action sit **outside** the quoted line; the line itself is only
the words.

```
The young woman with a quiet, breathy voice says: "I get off at the next station."
```

**Voiceover** needs two things — the phrase *"says in an off-screen voiceover"* **and** an explicit
statement that the lips stay closed. Without the second half the model animates a mouth.

```
The man says in an off-screen voiceover: "I still remember that road." — his lips remain
completely closed.
```

**On-screen text** — signs, banners, labels, subtitles, neon — goes in double quotes with the
original wording preserved exactly: *A red neon sign reading "Open Late" glows above the doorway.*

---

## References — H3's real differentiator is the declared RELATIONSHIP

*(Base `minimax-h3` only. `minimax-h3-max` has no reference endpoint — Slates refuses references
on that row rather than dropping them silently.)*

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

### Cite references by number — Slates already does it for you

H3 on fal takes references as **typed slots** and expects the prompt to name them by modality and
order: **`image 1`, `image 2`, `video 1`, `audio 1`**. That is exactly what the Slates composer
emits from your `@mentions` and `#tags` (`Marcus (image 1) in the workshop (image 2)`), in the
exact order it sends them.

🚨 **Do NOT hand-write angle-bracket reference tags.** MiniMax's own model-card grammar uses
`<Subject N>` / `<Picture N>` / `<Video N>` / `<Audio N>` labels; the fal endpoints Slates calls do
not — they build the binding from the typed slots and ask for plain numbered prose. Typing the tags
yourself puts literal angle brackets in the prompt the model reads.

### State how much of each reference survives

This is the lever no other model in the catalogue gives you. Say, in plain words, what each
reference is FOR and how much of it should carry through:

| Intent | Say something like |
|---|---|
| Keep it whole | *"Keep the woman in image 1 exactly as she appears — hair, cardigan, necklace."* |
| Keep part of it | *"Use the café in image 2 for the brick wall and the sofa; the lighting is late evening, not daylight."* |
| **Move a trait onto someone else** | *"Give the man in image 3 the weathered leather texture of the jacket in image 4."* |
| Loose echo | *"Match the general palette and grain of image 5; nothing else from it."* |

The third row is the one with no equivalent anywhere else in Slates: **transferring a characteristic
onto a different subject** is a first-class thing H3 understands. Reach for H3 when that is the job.

**Audio references** bind a voice or a texture without copying the words. Say which speaker an
audio reference is for (*"the woman in image 1 speaks in the voice timbre of audio 1"*), and when
you are referencing only the timbre, **do not carry the reference clip's original dialogue into your
prompt** — write the new line. When you genuinely want the same words re-performed, quote them
exactly and say so.

**An audio reference cannot travel alone** — H3 refuses a reference set that is audio only. Pair it
with at least one image or video reference.

### 💸 Reference images past the fifth cost 4 credits each

The first **5** reference images are free. Each additional image — the model takes **9** — adds
**4 credits** to the generation, at every resolution and every length. Four extra images on a 10s
768p clip add 16 credits to a 30-credit generation: **more than half again**, for references that
often make the output worse rather than better (see the 2–4 rule above).

Attach the references the shot needs, not the ceiling. Call
`slates_estimate_generation_cost` with `referenceImages` set to the real count before a
reference-heavy job — a quote that omits it under-reports the bill.

---

## Frames

`minimax-h3` and `minimax-h3-max` both take a **start frame**, an **end frame**, or both. With an
end frame, land it explicitly: describe the final pose, spacing and composition as the thing the
shot **settles into** at the end, rather than hoping the model finds it.

> *"…she rotates the handle into the final angle and settles into the pose, spacing and composition
> of image 2 at the end of the shot."*

**Frames and references are mutually exclusive** on both rows — they are different endpoints, and
the reference endpoint has no frame slots at all. Slates refuses the combination rather than
dropping one side.

---

## Cost discipline

| Combination | Credits |
|---|---:|
| `minimax-h3` · 768p · 5s | 15 |
| `minimax-h3` · 768p · 10s | 30 |
| `minimax-h3` · 2K · 10s | 65 |
| `minimax-h3` · 4K · 10s | 80 |
| `minimax-h3-max` · 768p · 10s | 40 |
| every reference image past the fifth | **+4** |

**768p is the default for a reason.** It is the tier the model natively generates.

🚨 **2K and 4K are UPSCALES of a 768p render, not larger generations.** fal's own schema says so:
*"480P and 768P are native generation modes; 2K and 4K upscale a 768P base result."* The upscaler
(H3-Regenerate-2K) is a separate stage bolted onto a finished take — it can enlarge detail but it
cannot add information.

**In our own test (2026-08-27, same prompt, same seed) the 2K pass came back with MORE artifacting
than the 768p original it was built from**, while costing 33 credits for a 5-second take against 15,
and taking nearly twice as long to return. One shot, so treat it as a warning rather than a law —
but the mechanism explains it, and the burden of proof is on 2K.

**So: generate at 768p and judge it at 768p.** Reach for 2K or 4K only when a delivery spec demands
the pixels, and expect to be paying for size rather than quality — a post-production upscale from a
clean 768p master is very often the better result. **4K video is Pro-only** (the server returns
`PRO_REQUIRED` for a base account); 2K is open to every tier.

---

## Quick checklist

- Body written as a timeline, first shot untimestamped, later shots on `[Shot N] At MM:SS.mmm`.
- Camera motion written **into** a sentence with amplitude and speed.
- Dialogue and diegetic music in the body; ambience in the soundscape section; audience-only score
  in the score section, described by instrument and tempo.
- Voiceover carries both the off-screen phrase and the closed-lips statement.
- References cited as `image 1` / `video 1` / `audio 1`, each with a stated job and a stated degree
  of retention. No angle-bracket tags.
- Reference count is deliberate — you are paying 4 credits for each one past the fifth.
- Frames **or** references, never both.
- The prompt is the prompt: no expander will fill it out for you.
