---
name: slates-blocking-to-prompt
description: Write the generation prompt that matches a blocking clip second by second, so the reference video and the text agree instead of fighting. Use after rendering a previs blocking pass, when a generated shot ignores the reference video, when timings drift, or when the model invents shots and camera angles that are not in the blocking.
---

# Blocking → prompt

You have a blocking clip. This is how you write the prompt that goes with it.

## The one idea

The clip already contains the camera, the cuts and the timing. **The prompt's job is to say what everything looks like — and, where the grey boxes are ambiguous, to disambiguate them.** It is not a second, competing description of the motion.

State that contract inside the prompt, because the model needs it as much as you do:

> Where a timeline line below names a camera position or move, it is a restatement of what the reference video already does at that timestamp — a disambiguation, never a new instruction.

And give it a tie-break, because ambiguity is guaranteed:

> If any text in this prompt appears to disagree with the reference video about camera, framing, direction, motion, timing or object placement, the reference video wins.

Those two sentences do more work than any other part of the prompt.

## Get the real numbers first

```
slates_blender_scene
```

Write timings from `camera.keyframeSeconds`, never from the shot list you intended to build. At 24fps cuts land on frame boundaries and the honest values are not round — `7.79s`, `9.33s`, `19.875s`. **Use the exact ones.** Rounding to `7.8` is a tenth of drift you are handing the model for free.

## Structure

Order matters — contract, then globals, then timeline, then the re-assertion.

```
TITLE — one line: what this is, how long, that it is video-to-video

LOGLINE — 2-4 sentences. The whole piece in plain language.

ACTIVE REFERENCES
  <one entry per reference: what it defines, and what is NOT inherited>

STYLE / LOOK
LIGHTING
COLOR
CAMERA
PHYSICS            (only if things move, collide or deform)

RULES              (numbered — the invariants, see below)

ACTION TIMING      (beat by beat, against the clip's real timestamps)

AUDIO
  [Sound design]   [Timed accents]   [Dialogue]   [Music]

HOLD FOR THE FULL TIMELINE
  <the 5-6 constraints most likely to drift, compressed>
```

## ACTIVE REFERENCES — every entry has an exclusion

The single highest-leverage format in this whole workflow. Each reference is a **positive claim plus an exclusion list**, because a reference the model over-reads is as damaging as one it ignores.

Label each by the badge code Slates echoes back (`IMG-A8`, `VID-C2`) or by an unmistakable role name, and use that same label everywhere below.

**The blocking clip:**

> VID-C2 = the blocking previz (30s, 720 frames, 24fps) — the MASTER for everything that moves and everything that stands. It defines the full edit one-to-one: every cut point, every camera position, angle, move and framing, all action timing, screen direction, and the geometry of the world. Its untextured grey surfaces, flat colours and viewport grid are NOT inherited — every grey proxy is dressed into a real object in the exact position the previz puts it. Proxies give position, angle, scale and motion only; never surface, shape detail or design.

That last sentence is the **placement-only clause** and it is not optional. Without it the model renders grey boxes.

**A character sheet:**

> IMG-A8 = the driver — defines his face, hair and wardrobe. Identity 100% consistent at every distance and through every motion blur. Background, lighting and pose are NOT inherited.

**A location/style reference:**

> IMG-B3 = the tunnel — defines location geometry, look and grade. Camera angle, framing and any people in it are NOT inherited; the camera comes exclusively from VID-C2.

**References can be scheduled.** If something is only true for part of the timeline, say so: *the hooded panel applies only to 0–7.0s and 27.5–30s.*

## Translate the blocking's artifacts

Your grey-box render contains things that are *notation*, not content. Every one needs an explicit reinterpretation or it gets rendered literally:

| In the blocking | Say in the prompt |
|---|---|
| Colour-coded bodies | `red = the boss, green = the kid, blue = the driver` |
| A marked face on a proxy | `RED face = the direction he faces, BLACK = his back` |
| A checkered floor or wall | `the checkerboard is a scale reference, not a surface — it becomes <the real material>` |
| Flat black background | `a PLACEHOLDER — replace with the location assigned below` |
| A floor grid | `a motion-tracking aid — render as light on the surface, never as wireframe or tiles` |
| A deliberate black gap | `CUT 7 (14.5-17.0, black gap in the reference) — <what fills it>` |
| Frame goes dark mid-move | `the camera is passing through the ground — a doorway to the NEXT location, never back to a previous one` |

## RULES — the invariants

Numbered, short, absolute. These are the things that must hold in every frame, and they are where you put anything that has already gone wrong once.

Two patterns worth stealing outright:

**Countable state.** Give the model arithmetic it can check itself against:

> At every second: standing + fallen + on the lintel = 6. Never a seventh figure — no extras, no duplicates, no distant silhouettes, no half-bodies at frame edges.

> Bodies on the ground count exactly: 0 before 12s → 1 → 2 → 3 → 4 at 12/13/14/16s → 5 at 20s → 6 at 26s. Never more.

**Named misreads.** When a generation gets something specifically wrong, do not rewrite the description — **name the wrong reading and kill it**:

> The lamp is a man-made steel structure — NOT an animal, NOT a snake, NOT any living or organic shape.

> The rear of the car and its tail lights are NOT visible in this shot.

This is the highest-value edit available after a failed roll, and it is why the prompt grows rather than changes between takes.

## ACTION TIMING — the beats

One block per shot or beat. Two notations; pick one and hold it.

**For a continuous take**, ranges with a camera note and a closing state audit:

```
8-12s — THE SWEEP (per VID-C2: elevated rear push, swinging to profile by 12s):
<what happens, in prose, with sub-beats on tenths and → chaining cause to effect>
END 12s: bodies 1 (behind him as he steps past) · standing — four ahead, holding.
```

**For a cut edit**, numbered shots ending on their cut:

```
9.33-10.33s — SHOT 10 — Interior over the centre console as in VID-C2: <what the
frame contains>. Hard cut at 10.33s.
```

Three habits that separate a beat that works from one that does not:

- **Declare the frame's contents as a closed set** when the shot is tight: *the frame holds exactly the console, the lever, his hand, and the edges of both seats.* An open description invites additions.
- **Chain cause to effect inside one sentence** with `→`. `he overcommits a lunge → the Hero drops low and sweeps his standing leg → he hits the earth at 12s`.
- **Put events on tenths.** `11.7s`, `19.5s`, `22.5s`. Vague beats generate vague timing.

Density: roughly 60–130 words per second of screen time is what these prompts actually run at. That is much denser than a normal video prompt, and it is the point.

## AUDIO

`[Timed accents]` uses the same timestamps as the beats:

> 3.1s tyres light up into the burnout squeal · 7.0s drift-entry screech · 10.1s hard mechanical shifter clack · 20.3s full-speed pass-by whoosh

`[Dialogue]` is a closed list — count the lines, give each a window, quote it verbatim, and forbid everything else:

> Exactly TWO vocal events in the entire 30 seconds, both screamed, in English, VERBATIM: 1. 17.3-18.6s "STOOOOOP!!" 2. 23.4-24.0s "You crazy!" Nothing else is ever spoken.

Two rules that stop dialogue from breaking the edit:

> DIALOGUE NEVER CREATES SHOTS: spoken lines happen inside the reference's takes exactly as blocked — no cutaways to a speaker, no reverse shots, no added close-ups. If a line plays while the camera is elsewhere, the line stays off-screen audio.

> A line marked off-screen must STAY off-screen — never show the speaker, never move him into frame, never route the camera to him because he spoke.

Model note: dialogue direction as separate layers is minimax-h3's seat; native synced audio is Veo's. Route per `slates-model-selection` and read the model's own prompting skill before writing the audio block.

## HOLD FOR THE FULL TIMELINE

Close with a terminal re-assertion of only the constraints most prone to drift — five or six lines, compressed, no new information:

```
HOLD FOR THE FULL TIMELINE
- VID-C2 camera path 1:1 — any deviation = failure.
- Six and only six figures; the count above holds at every second.
- IMG-A8 identity constant at every distance and through motion blur.
- The IMG-B3 location in every frame; no subtitles, no watermarks.
```

Restating is not redundancy here. It is the last thing the model reads.

## Checklist before you generate

- [ ] Timings taken from `slates_blender_scene`, frame-exact, not rounded
- [ ] Every reference has an explicit "NOT inherited"
- [ ] The placement-only clause is present
- [ ] The tie-break clause is present
- [ ] The disambiguation clause is present
- [ ] Every blocking artifact (colours, grid, gaps, black frames) is translated
- [ ] Counts are stated where anything is countable
- [ ] `videoReferenceSecondsEach` matches the clip's real duration
- [ ] A HOLD block closes it

## Related

`slates-previs-blocking` (producing the clip) · `slates-camera-language` (the moves being described) · `slates-dialogue-blocking` (multi-character continuity) · `slates-restyle-from-blocking` (reusing this prompt across styles) · `slates-prompting-seedance-2-5` / `slates-prompting-minimax-h3` (model-specific rules)
