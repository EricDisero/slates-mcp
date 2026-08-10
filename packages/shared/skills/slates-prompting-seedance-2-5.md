---
name: slates-prompting-seedance-2-5
description: How to prompt Seedance 2.5 and Seedance 2.5 Edit. Read before calling slates_generate_video with model seedance-2.5, or slates_edit_video with model seedance-2.5-edit. 2.5 is a SECOND SEAT next to 2.0, not an upgrade — it buys 30-second takes, 30 image references and audio-only references, and it gives up 1080p and 4K entirely. Shares 2.0's prompt grammar (read slates-prompting-seedance for the shot structure, subject binding, camera and constraint vocabulary); this file covers only what is different, plus the two hazards unique to 2.5 — the prompt-intent task classifier and the cost trap at 720p.
---

# Seedance 2.5 — prompting

**Read `slates-prompting-seedance` first.** The prompt GRAMMAR is the same model family: the
8-slot advanced formula, the `Shot 1 / Shot 2 / Shot 3` storyboard, subject binding by
`<Subject_N>@<Image_N>`, camera vocabulary, externalised emotion, inline constraint words, the
anti-twin fix. None of it is restated here. This file is only what 2.5 changes.

---

## The one fact that decides whether you use it at all

**Seedance 2.5 is 480p or 720p. There is no 1080p and no 4K, on any provider.**

That is not a Slates limitation or a tier gate — the model does not produce those resolutions.
So 2.5 does not replace 2.0; it sits beside it:

| | Seedance 2.0 | Seedance 2.5 |
|---|---|---|
| Resolution | 480p / 720p / 1080p / **native 4K** | **480p / 720p only** |
| Length | 4–15s | **4–30s in one take** |
| Reference budget | 15 (9 image + 3 video + 3 audio) | **50 (30 image + 10 video + 10 audio)** |
| Combined reference video/audio | ≤15s | **≤30s** |
| Audio-only reference | ✗ (needs an image or video alongside) | **✓** |
| Video edit as its own task type | ✗ | **✓ (`seedance-2.5-edit`)** |
| Default video model | **yes** | no |

**Route to 2.5 when the shot needs LENGTH, MANY REFERENCES, or an audio-only reference.
Route to 2.0 when resolution matters at all** — which, for anything a client will see full-screen,
is most of the time.

---

## 🚨 Hazard 1 — the prompt-intent task classifier

This is the one that costs money and time, and it has no equivalent on 2.0.

**Seedance 2.5 sorts every request into one of five task types** — text-to-video,
reference-to-video, first/last-frame, **video edit**, **video extend** — from the reference roles
attached **plus the intent of your sentence**. Each type then has its own parameter constraints,
and a violation comes back **asynchronously**: the task queues, credits are reserved, and only then
does it fail.

The trigger words are ordinary English:

| Reclassified as | Words that do it |
|---|---|
| **video edit** | `add` · `remove` · `replace` · `change` · `edit the video` |
| **video extend** | `extend` · `continue` · `continue the story` |

So a perfectly legitimate reference-to-video prompt — *"a wide shot of the workshop, **remove** the
tripod from frame"* — gets classified as an edit and fails on constraints it never set.

**What to do:**

1. **If you mean to edit an existing clip, say so with the MODEL, not the sentence.** Call
   `slates_edit_video` with `model: 'seedance-2.5-edit'`. That routes to a dedicated
   task-typed endpoint and the classifier never has to guess.
2. **If you mean a fresh shot, describe the finished frame rather than an instruction to change
   one.** Not *"remove the tripod"* → *"the workshop bench, clear and uncluttered"*. Not
   *"add rain"* → *"heavy rain falling through the streetlight"*. This is better prompting anyway:
   the model renders what you describe, it does not take edits to an imagined draft.
3. The trigger only fires when **references are attached**. A plain text-to-video prompt is safe
   however it is worded.

**Slates will warn you, and it will never rewrite your prompt.** When a 2.5 reference generation's
prompt contains one of these words, the composer shows a warning that NAMES the words and the agent
route returns the same string. Silently editing the user's sentence to dodge a provider classifier
is forbidden — the words that reach the model are always the words the user can see.

---

## 🚨 Hazard 2 — 720p is not "the cheap one" any more

Every other model in Slates trains the habit that lower resolution means lower cost. 2.5 breaks it,
because the thing that moves the bill is **length**, and 2.5's length ceiling is double 2.0's.

Worked, at the shipped rates:

| Generation | Credits |
|---|---|
| 2.5 · 480p · 5s · faceless | 28 |
| 2.5 · 720p · 5s · faceless | 59 |
| 2.5 · 720p · 30s · faceless | 355 |
| 2.5 · 720p · 30s · AI-face route | **484** |
| 2.5 · 720p · 30s · consented real-face route | **710** |
| *(for scale)* 2.0 · 1080p · 15s · AI-face route | 411 |

**A 30-second 720p clip can cost more than a 15-second 1080p one** — and a base licence starts
with 1,000 credits. Someone who reads "720p" as "cheap" and asks for a 30-second take on the
real-face route has spent 71% of their welcome grant on one clip.

**Discipline:**

- **Always quote with `slates_estimate_generation_cost` before a take over ~10 seconds,** and say
  the number out loud before generating.
- **Draft at 480p and 4–8 seconds.** Prove the composition, the motion and the identity first;
  spend the length only on the take you already know works.
- **Length is a creative decision, not a default.** 30 seconds is available; it is rarely the right
  answer for a single shot. Multi-shot storyboards inside one 30s generation are what the length is
  actually for.
- Read `slates-cost-discipline` — all of it applies, more sharply here.

---

## What the extra reference budget is actually for

30 image references (up from 9) does **not** mean "attach 30 images". Every rule in
`slates-prompting-seedance` about references still holds — 2–4 strong references beat both extremes,
one reference per role, one authoritative rendering per subject, and past **4 reference people**
output stability drops regardless of the cap.

The larger budget earns its keep in exactly two places:

- **A long multi-shot take** where different shots need different subjects and locations bound —
  the budget is spread across the storyboard, not stacked on one frame.
- **Video and audio references alongside images**, which is where 2.5's 10 + 10 matters far more
  than the image count.

### Audio-only references — the genuinely new input

2.0 required an image or video alongside any audio reference. **2.5 accepts audio on its own.**
That makes one recipe possible that was not before: drive a scene's timing, voice or ambience from
a recording with no visual anchor at all — a voice line, a music bed, a room tone — and let the
model build the picture to it. Cite it the same way as any other reference
(`Reference the timbre in <Audio_N> to generate…`), and remember that audio references carry **no
billing dimension** on any Seedance route: audio is included.

### Video references

Up to 10 clips, ≤30s combined (2.0: 3 clips, ≤15s). A reference VIDEO switches the cost key to
`seedance-2.5*-vref-{res}-{T}s`, where **T = Σ input seconds + output seconds** — the sum is across
**every** clip attached, not just the longest. Three 6-second references on a 12-second output bills
30 seconds, not 12 and not 18. Quote before confirming.

**The cap is a refusal, not a trim.** Attach an eleventh clip, or push past 30 combined seconds, and
the composition is rejected before anything uploads. That asymmetry is deliberate: reference images
warn-and-trim because dropping one doesn't change the price, and a dropped reference VIDEO would be
one you were quoted for and the model never saw.

### Mixing all three in one call

50 files total (30 image + 10 video + 10 audio) is a shared budget. Everything is cited positionally
by type — `image 1`, `video 2`, `audio 1` — in attachment order, so reordering the attachments
renumbers the citations. Write the prompt against those numbers:

```
Marcus (image 1) performs the motion from video 1 in the workshop from image 2,
speaking the line in audio 1. Preserve his identity, appearance and outfit.
```

Frames and reference media stay mutually exclusive, in every combination — the reference endpoint
has no first/last-frame parameters at all, so this is a shape mismatch rather than a preference.

---

## Seedance 2.5 Edit (`slates_edit_video`, `model: 'seedance-2.5-edit'`)

Its own picker row and its own op call, deliberately: the task type is **the model you chose**,
never something inferred from your sentence.

**Why route here at all:** it is the **only edit engine in Slates that accepts a clip longer than 15
seconds** (4–30s, versus Kling O3 Edit's 3–15s and Omni Flash Edit's 3–10s). For a clip inside the
others' range, choose on fidelity instead — Omni Flash Edit won the prompt-only head-to-head, and
Kling O3 Edit is the one that takes element and style reference images.

**How it behaves:**

- **Output length follows the SOURCE clip**, and the bill is the ceiled source length. The provider
  requires an automatic duration on this task type, so there is no length knob — the clip you attach
  is the quote.
- **The aspect ratio follows the source clip too.** No ratio control; the frame is the clip's frame.
- **480p or 720p output**, native audio.
- **Prompt and source clip only** on this op — no character or style reference images. If the edit
  needs a reference image to lock an identity, that is Kling O3 Edit's job.
- **An edit bills roughly DOUBLE a plain 2.5 generation of the same length**, because every provider
  charges an edit on input + output seconds. Read the confirm gate's number; do not reason from the
  generation rate.
- **Set `seedanceFace: true` when a character's face is visible in the clip.** The faceless provider
  blocks faces outright — this is not a price optimisation, it is whether the job runs at all.
- **There is no consented-real-face route for editing.** Real-person footage that the AI-face route
  rejects has to go to Kling O3 Edit.

**Prompting an edit** — the same discipline as every other edit engine: **describe only what
changes.** The source already carries its composition, motion, timing and performance; re-describing
them fights the model. Use Seedance's own edit grammar from `slates-prompting-seedance`
(*"Strictly edit `<Video_1>`, and modify `<Original_Characteristic>` to `<New_Characteristic>`"*) and
**never** write *"reference video 1"* in an edit — the official guide is explicit that this phrasing
gets the request reclassified as a reference task, which is the same landmine as Hazard 1.

---

## Faces, and what does NOT change

The three-tier face routing is identical to 2.0 — faceless → default route, an AI character's face →
`seedanceFace: true` (the relaxed provider, a real cost premium), a real person's photo → the
consent-gated premium route after a `[REAL_FACE_DETECTED]` rejection, with `realFaceConsent: true`
set **only** after the user explicitly confirms they hold the rights to the likeness. The full rules,
including why the real-vs-AI call is the provider's and not yours, are in
`slates-prompting-seedance`.

Also unchanged, and worth restating because 2.5's length makes each one more expensive to get wrong:

- **No time stamps.** `Shot 1 / Shot 2 / Shot 3`, ordered by when events occur, pacing left to the
  model. A 30-second take makes this rule matter more, not less — it is more shots, not longer
  segment labels.
- **One primary camera move per shot.**
- **No lens / aperture / film-stock vocabulary.** That is image-model syntax and a Seedance
  anti-pattern.
- **No `negativePrompt` field** — constraints go inline.
- **Legible in-shot text still belongs in a baked start frame**, not in the video prompt.
