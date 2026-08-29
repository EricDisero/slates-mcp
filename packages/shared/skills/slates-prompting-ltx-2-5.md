---
name: slates-prompting-ltx-2-5
description: How to prompt LTX-2.5 and LTX-2.5 Pro. Read before calling slates_generate_video with model ltx-2-5 or ltx-2-5-pro. LTX scores the picture on the same pass that draws it, so SOUND IS THE FIRST THING YOU WRITE — Lightricks ranks the prompt sound, camera, character detail, shot type and scene, then scene dressing, all in one flowing paragraph. It is also the catalogue's native MULTISHOT seat: one generation carries two to four connected shots holding character, light and voice across the cuts. Base ltx-2-5 is the distilled build — 720p/1080p/1440p/4K, clips of 6 to 20 seconds in EVEN steps, and the cheapest native 1080p second in Slates; ltx-2-5-pro is the full diffusion build and is NOT a superset, reaching only 1080p and 10 seconds for about a third more money. Three hazards live here: durations are even numbers only from six (there is no 5s or 7s clip), the model has NO reference endpoint at all so identity references are unavailable, and any sound not anchored to something in frame gets invented for you.
---

# LTX-2.5 — prompting

LTX-2.5 generates picture and sound **in a single pass**, with a Gemma-4 12B text encoder reading
one flowing paragraph. That single fact drives everything below: the prompt is not a shot
description with audio bolted on, it is **a scene where the sound is load-bearing** — and
Lightricks' own priority order puts sound first, ahead of the camera.

Two seats, and the naming is a trap:

| | `ltx-2-5` (base) | `ltx-2-5-pro` |
|---|---|---|
| Build | Distilled, 8-step | Full diffusion ("Diffusion Fidelity Rendering") |
| Resolutions | 720p / 1080p / **1440p** / 4K | 720p / 1080p |
| Durations | 6–20s, even steps | 6 / 8 / 10s |
| Price | $0.09–$0.30 per second | $0.12–$0.17 per second |
| Reach for it when | iterating, long takes, 4K delivery, batch volume | one dense final render inside 1080p and 10s |

**Pro is not "base plus more."** It buys picture quality on a *narrower* envelope — it cannot make
a 1440p frame and it cannot make a 12-second clip. Reaching for it out of habit costs a third more
*and* takes away the reach.

---

## 1. The six parts, in priority order, in one paragraph

Lightricks ranks the elements of an LTX prompt like this. When a prompt sprawls, **cut from the
bottom.**

1. **Sound** — highest priority; the model scores the picture as it draws it.
2. **Camera** — framing decides visual weight and the feel of the shot.
3. **Character detail** — expressed as physical action.
4. **Shot type and scene** — the action itself.
5. **Scene dressing** — the first thing to trim.

Write it as **one flowing paragraph**, not a list of labelled sections. LTX is not Seedance (eight
engineering slots) and not H3 (three separate audio layers) — it wants continuous prose.

---

## 2. Sound: anchor it or it gets invented

**Write the audio line last, then go back and check every cue has a source you could point at.**
Anything unanchored, the model invents for you.

The test is **"visible, or at least locatable."** A distant whistle is fine *if* you have named the
marshal's post it comes from. A "distant whistle" with nothing to attach to is a coin flip.

> the rope creaks against the cleat as she leans back, gulls calling somewhere off the port bow,
> the hull knocking hollow against the fenders

**Never write mood adjectives as sound.** "Tense atmosphere", "a sense of dread" and "ominous
ambience" produce nothing usable. If a scene feels thin, the fix is **one more moving object in
frame with a sound attached to it** — never another adjective.

### Dialogue

Quote it, and name the language and accent:

> "We should not have come back," in English with a slight German accent.

Two rules that decide whether the lip sync lands:

- **Give the character a beat of stillness before they speak.** The sync needs something to lock
  against; a character already mid-motion when the line starts drifts.
- **Describe the beat structure** — when they look, how long they wait, when they speak, where they
  look afterwards.

Slates pins the frame rate at 25fps, which is also what Lightricks recommends for dialogue: at 50fps
the performance "pulls toward a video look."

---

## 3. Character emotion is physical

The model renders actions. It does not render adjectives.

| Instead of | Write |
|---|---|
| she looks anxious | her jaw sets, she turns the ring on her finger twice |
| he seems exhausted | he blinks slowly and lets his shoulder take the doorframe |
| a tense standoff | neither moves; his thumb finds the strap and stays there |

---

## 4. Multishot — the thing this model is uniquely for

**One LTX generation can carry several connected shots**, holding character, environment, lighting,
voice and style across every cut. Nothing else in the catalogue does this natively; everywhere else
you generate separate clips and stitch them, and identity drifts between them.

**Working range is two to four shots.** Three is the comfortable stopping point.

At **every** transition you must supply four things:

1. **Name the edit in the prose** — "hard cut", "dissolve", "match cut".
2. **Re-establish the shot completely** — scale, angle, lens and light all reset at a cut. A cut is
   not a continuation.
3. **Re-identify recurring characters by their original descriptor.** "The woman in the bronze
   gown", never "she". Pronouns lose the character across a cut — this is the single most common
   multishot failure.
4. **State what the sound does at the cut.** Silence is not assumed; if the room tone should drop
   out, say so.

A shape that works:

> Wide establishing shot of the workshop, dust in the window light, a lathe turning somewhere off
> frame — hard cut — macro close-up of the brass fitting as it seats, the turning noise gone,
> replaced by a single dry click — match cut — medium shot of the woman in the bronze gown stepping
> back, the room tone returning underneath her.

---

## 5. Camera: write it, don't enumerate it

fal exposes a `camera_motion` enum (dolly in/out/left/right, jib up/down, static, focus shift).
**Slates does not surface it, deliberately** — and prose is the better instrument anyway:

- **A written move can be tied to a specific moment.** "A slow push-in that settles as she reaches
  the door, then holds" is not expressible as an enum value.
- **For multishot it would be actively wrong** — one enum value would impose a single camera
  behaviour on three shots that each want their own.

So name the lens, the framing, the move, and **the moment the move resolves**.

---

## 6. The hard constraints

### Durations are even numbers only, starting at six

**6, 8, 10, 12, 14, 16, 18, 20.** There is no 5-second LTX clip and no odd duration of any length.
Asking for 7s is not a rounding matter — that generation does not exist.

**And the long end is 1080p-and-below only.** At 1440p and 4K the ceiling drops to **6, 8 or 10**.

fal's own default is `auto`, which lets the model pick the length from the described action.
**Slates always sends an explicit length instead**, so what you choose is what you are billed for.
Choose the length the beat needs.

### Aspect ratios: 16:9 and 9:16, and nothing else

The narrowest set in the catalogue alongside Veo. Square, 4:5 and 21:9 are not available on this
model at any resolution.

### Frames, not references

LTX takes a **start frame** and an **optional end frame** (which generates a transition between the
two). It has **no reference-to-video endpoint at all** — no identity references, no style
references, no environment references, no reference video, no reference audio.

**For character consistency across separate shots, use MiniMax H3 or Kling.** Within a single LTX
generation, use multishot instead — that is precisely the gap it fills.

In image-to-video, **do not cut away from the opening frame too early.** You have paid for that
frame; let it play before the first move.

### Do not ask for text on screen

Neither the spelling nor its stability from frame to frame can be relied on. Signage, labels,
captions and lower-thirds belong in post.

---

## 7. Audio is free here, and that changes the routing

Native synchronised audio is **included at every resolution on both seats**, with no surcharge and
no toggle that costs money — unlike Kling, where sound is a paid dimension. A 6-second 1080p LTX
clip **with sound** is 39 credits.

Combined with 1080p at $0.13/s — the cheapest native 1080p second in Slates — this makes LTX **the
coverage seat**: the one to reach for when the job is many takes rather than one hero shot, when a
sequence needs its own sound, or when the credit budget is the binding constraint.

Route away from it when you need identity references (H3, Kling), a ratio other than 16:9 or 9:16
(Seedance, Kling), or authored multi-layer audio direction (H3).
