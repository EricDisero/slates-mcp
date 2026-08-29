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

TECHNICAL BLOCK    (format, grade, lens, and the blanket negatives — see below)

STYLE / LOOK
LIGHTING
COLOR
CAMERA
PHYSICS            (only if things move, collide or deform)

RULES              (numbered — the invariants, see below)

ACTION TIMING      (beat by beat, against the clip's real timestamps)

AUDIO
  [Sound design]   [Timed accents]   [Dialogue]   [Music]

ENDING LOCK        (one line — where the film stops)

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

**An atmosphere or style master — a reference that is never a shot:**

> IMG-D9 = ATMOSPHERE MASTER — NOT a keyframe, NOT a location to reproduce, NOT a frame that ever appears in the film: its own subject, framing and composition are never seen in any shot. It defines ONLY the weather, light, colour and grade: deep clean night just after rain, wet asphalt as a dark mirror, cool white-cyan lamps as the ambient key, teal-and-amber grade, deep clean blacks. Every shot is lit and graded in this regime for all 30 seconds.

Without those three NOTs the model reproduces the reference's composition as an actual shot — you get its street corner in your film. The same wording covers a rendering-style master; see `slates-restyle-from-blocking`.

**References can be scheduled.** If something is only true for part of the timeline, say so: *the hooded panel applies only to 0–7.0s and 27.5–30s*, or per-reference: *Active for 00:03.3–00:06.7 only.* On a piece that travels through several locations, every location still carries its own window and the model stops blending two sets into one shot.

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
| The source hard-resets mid-move | `each reset begins a NEW, completely different room — never a replay of one already seen` |
| A proxy that is a PROP or VEHICLE | `the low-poly flying model in SHOT 18 is THE HELICOPTER · blocks on the rear bench are the luggage · the small dark block in his hand IS the pistol` |
| A blocky proxy limb in a tight insert | `the blocky low-poly leg is a stand-in and must NOT be replicated — generate complete human anatomy: a real boot, a real trouser leg, a correct ankle at this exact camera angle` |
| A stray object at the frame edge | `ignore it completely — never blend two sets into one shot` |

## TECHNICAL BLOCK — format, lens, and the blanket negatives

One paragraph, before the timeline. It carries the things that are true of every frame and that no beat should have to repeat:

> Cinematic, photoreal. 21:9. 30s. SFX only, no music. Kodak 500T film look, natural 35mm grain, organic colour, soft highlight roll-off, anamorphic lens character with oval bokeh and gentle barrel distortion at the edges, chromatic aberration creeping in at the frame edges, natural motion blur on every fast move, faint bloom on hot speculars. Every location well exposed — night interiors bright and readable, open shadows, no crushed blacks, no murk. NO CGI. NON-IP, no brand badges or logos anywhere, no text, no watermark.

Three parts worth naming:

- **Lens realism is a list, not an adjective.** Aberration, motion blur, depth of field, barrel distortion, bloom, grain. "Cinematic" buys you nothing; these buy you the look.
- **Exposure needs saying on dark work.** Models crush night scenes into murk. *Night interiors bright and readable, open shadows, no crushed blacks* is what keeps a scene legible.
- **The blanket negatives go here once** — `NON-IP`, no logos, no on-screen text, no subtitles, no watermark — rather than being scattered through the beats.

## RULES — the invariants

Numbered, short, absolute. These are the things that must hold in every frame, and they are where you put anything that has already gone wrong once.

Two patterns worth stealing outright:

**Countable state.** Give the model arithmetic it can check itself against:

> At every second: standing + fallen + on the lintel = 6. Never a seventh figure — no extras, no duplicates, no distant silhouettes, no half-bodies at frame edges.

> Bodies on the ground count exactly: 0 before 12s → 1 → 2 → 3 → 4 at 12/13/14/16s → 5 at 20s → 6 at 26s. Never more.

**Every mass is dressed, and nothing is invented.** The blocking is authority over what EXISTS, not just what moves — otherwise the model deletes the masses it finds boring and adds architecture you never blocked:

> Every lamppost, guardrail, road and terrain mass visible in the reference exists in the output in the same place, at the same scale, in the same position in frame — the opening blocks are dark-brick warehouse facades, the roadside masses are the waterfront skyline, the finale rocks are the city's tower walls. Nothing is deleted, and no structure is invented where the reference shows none.

**Anatomy is never inherited from a proxy.** Tight inserts on hands and feet are where blocking leaks straight into the render:

> The reference shows only WHERE hands and feet are. In the output they are always complete human anatomy — a five-fingered gloved hand with natural knuckles, a real leg in wool trousers, a real foot in a leather shoe — never the proxy's blocky shape.

**A ledger for anything that happens a countable number of times.** A ritual, a reload, a set of falls: state it as a linear sequence, each step exactly once, and close with the tally:

> Strictly linear, six steps in fixed order, each happening EXACTLY ONCE and never repeating; once a step is done it is done for good, and the sequence only ever moves FORWARD, never backward. Count of weapon events in the entire video: one draw, one magazine insertion, one slide rack, one shot.

Without the ledger the model loops the most cinematic beat — it will rack the slide four times because racking looks good.

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

**Then forbid the lines it will invent anyway.** A closed list is a rule; an enumerated blacklist is enforcement, and the phrases to list are the clichés the scene invites:

> FORBIDDEN — she never says any of these and no one else says anything: "they're behind us", "cops", "go go go", "are you crazy", "you're insane", or ANY other invented phrase. All other human voice is wordless screaming or laughing.

**When lines are lip-synced, give each one a timestamp** in the same list, and say that they change nothing else:

> Timing: "You wind up for this one?" ~18.2s · "Three full turns." ~19.0s · "Company." ~24.3s. Every line lip-synced; the lines never change the camera.

Two rules that stop dialogue from breaking the edit:

> DIALOGUE NEVER CREATES SHOTS: spoken lines happen inside the reference's takes exactly as blocked — no cutaways to a speaker, no reverse shots, no added close-ups. If a line plays while the camera is elsewhere, the line stays off-screen audio.

> A line marked off-screen must STAY off-screen — never show the speaker, never move him into frame, never route the camera to him because he spoke.

Model note: dialogue direction as separate layers is minimax-h3's seat; native synced audio is Veo's. Route per `slates-model-selection` and read the model's own prompting skill before writing the audio block.

## ENDING LOCK

One line, and it is the cheapest fix in the document. Models drift at the end — they hold a frame too long, add a beat after the last one, or fade somewhere the reference does not:

> The film ends exactly where the reference ends: the final take runs unbroken to its last frame, and that source frame IS the final frame of the film. Nothing follows. The last five seconds follow the source exactly as strictly as the first five.

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
- [ ] Every blocking artifact is translated — colours, marked faces, checkers, grid, black background, gaps, dark dips, resets, prop proxies, proxy limbs, strays
- [ ] Any style/weather reference is declared NOT a keyframe and never a shot
- [ ] The every-mass-is-dressed / nothing-invented rule is present
- [ ] Tight inserts on hands or feet demand complete anatomy
- [ ] Counts are stated where anything is countable, and repeatable actions carry a ledger
- [ ] A TECHNICAL BLOCK carries format, lens realism, exposure and the blanket negatives
- [ ] `[Dialogue]` is a closed list with a FORBIDDEN blacklist
- [ ] An ENDING LOCK says where the film stops
- [ ] `videoReferenceSecondsEach` matches the clip's real duration
- [ ] A HOLD block closes it

## Related

`slates-previs-blocking` (producing the clip) · `slates-camera-language` (the moves being described) · `slates-dialogue-blocking` (multi-character continuity) · `slates-restyle-from-blocking` (reusing this prompt across styles) · `slates-prompting-seedance-2-5` / `slates-prompting-minimax-h3` (model-specific rules)
