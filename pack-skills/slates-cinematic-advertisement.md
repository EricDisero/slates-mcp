---
name: slates-cinematic-advertisement
description: Write cinematic direct-response ad footage that does not read as AI — the craft layer for scripted, world-hopping, character-driven commercial video. Covers the never-illustrate-the-line law, operator-physics camera direction, the three channels that must all pass (frame, motion, voice), performance and room acoustics, and the failure catalogue. Use when writing prompts for a scripted ad, a commercial, a branded film, a satirical or dramatised spot, or any short-form video where a written script drives the images. For phone-shot influencer/testimonial ads use slates-ugc-advertisement instead.
---

# Cinematic advertisement — the craft layer

This is not a button-pressing workflow. This is **how the prompt is worded** so the result reads as filmed rather than generated. Pair it with whichever production workflow you are running.

**The register:** a written script, a cast of characters, many locations, a deliberate camera. Polish is the point here — which is exactly why every AI tell costs you double.

---

## §0 — Never illustrate the line. The governing law.

**The words and the picture do two different jobs.** The line argues; the image escalates. When the image simply shows what the line just said, you have spent a shot to say one thing twice, and the ad flattens.

| Line | ❌ Illustrating | ✅ Escalating |
|---|---|---|
| "It costs a fortune" | someone frowning at an invoice | a bidding war breaking out over the last one |
| "It takes forever" | a clock, a loading bar | a man who has visibly aged waiting in the same chair |

**The test:** cover the audio. Does the picture still have a reason to exist? If not, rewrite the picture.

⚠️ **A shot with nobody in it is almost always the illustrating version.** A sign, a product on a table, a screen — those are captions with a budget. Put a person in frame having a problem.

---

## §1 — Every beat needs all four, and a trim survives only if they hold

1. **A camera move** — named, never "static, no camera movement"
2. **A physical action** per person in frame
3. **A named register** for the delivery (deadpan is a face, not a mood)
4. **One interaction** — between people, or between a person and an object

A beat missing any of these renders as a postcard with breathing in it.

---

## §2 — Camera: operator physics, never slider moves

**Smooth lateral tracks, slow orbits, constant-speed floats and gentle push-ins are the default output of every video model alive.** That is precisely why they read as AI. A real operator has feet, mass, and a reason to be moving.

🚨 **Name the rig, then describe the operator's body. Neither works alone.**

`Single continuous handheld shot` tells the model what the camera **is**. The operator's body tells it what the camera **does**. Ship one without the other and it renders its default move — a shot prompted `handheld` with no operator described comes back as a smooth slow zoom with no shake in it.

| ❌ Camera path | ✅ Operator's body |
|---|---|
| the camera drifts along the car | hurrying alongside the car to keep up with the window |
| slow push-in on his face | stepping in close because he has stopped shouting |
| the camera tilts up | ducking under the branch and coming up on the other side |

**And let the world register the camera.** Water splashing with each step, dust kicked up, the frame clipping a doorframe. *A move that nothing in the frame reacts to is a move nobody made.*

⚠️ **Static is never the default and is never phrased as an absence.** "No camera movement" produces a still with people breathing in it. Static is earned only when the people in frame are genuinely moving — environmental motion does not rescue motionless subjects.

---

## §3 — Performance: describe the instrument, not the psychology

The model cannot render "conflicted." It can render a throat, a breath, a volume, a speed, a face.

| Axis | Direct it as |
|---|---|
| **Volume** | shouting over the noise · barely above a whisper |
| **Speed** | tripping over the words · leaving a gap before the last one |
| **Throat** | tight and strangled · gravel at the bottom of the register |
| **Breath** | out of breath · holding it between phrases |
| **Face** | jaw set · half-laughing · completely blank |
| **The room** | the acoustic the voice is recorded in |

🚨 **The room is the axis everyone forgets.** A perfectly dry voice in a tiled kitchen is acoustically impossible and the ear catches it even when the viewer cannot name why. Name the space: hard slap off concrete, dead and close in a small bedroom, open air with no reflections at all.

---

## §4 — The three channels, and why fixing one does not save the clip

**Frame · motion · voice.** Naturalness in one does not rescue the others, and *perfection* in any one of them contaminates the whole clip.

| | Reads as AI | Reads as filmed |
|---|---|---|
| **Frame** | flawless symmetry, perfect light | ordinary composition, a real light source |
| **Motion** | constant-speed track or orbit | arrives, overshoots, corrects |
| **Voice** | announcer read, studio-dry | conversational, in a room |

A stumbling handheld camera on a flawless plate with a stock narrator voice is still two-thirds generated. **The viewer reads the composite, never the best channel.**

---

## §5 — If it could read as a mistake, it is out

**A defect and a deliberate impossibility can look identical**, and the viewer resolves the ambiguity against you every time — you are the ad arguing that this footage is good.

Banned as a class: continuity that breaks across a move, objects that pop or vanish between frames, faces or hands that change mid-shot, geometry that does not survive a camera move, text that morphs.

**The test:** *if a broken generator did this by accident, would it look like this?* Yes → cut it, however clever it is.

---

## §6 — References

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

⚠️ **Always attach one.** Reference-free prompts come back faceless, then glossy. When a beat needs a camera angle the source plate cannot demonstrate, attach a second reference purely for the angle and say so in the prompt.

---

## §7 — Density scales with line length

The frame is on screen for exactly as long as its line takes to say, so **read-time is set by the dialogue, not by the art direction.** A twenty-word line can carry a wall of detail; a three-word line carries one thing. The failure is a loaded frame under a short line — the reward for looking is in there and nobody has time to find it.

You can buy the seconds back with a camera move, which is why a slow pull-out can still run dense under a short line.

---

## §8 — Script shape

- **One target per ad.** Drill a single pain for the whole runtime. Everything else is ammunition for a different ad.
- **The script is one unbroken piece, then cut into locations on keywords** — never scenes with dialogue attached afterwards.
- **Split sentences across the cut.** A line that ends on a full stop lets the model sit in one room; a clause left unresolved is what forces the change of location.
- **The product enters as dialogue, never as an announcement.** "It's a real app on your computer" reads as a 1960s advertorial. Make it a rumour one character passes to another.
- **Pace is an edit problem, not a prompt problem.** Generate long, cut the air out, J-cut the split lines, run a continuous sound bed underneath.

---

## §9 — Still gate

<!-- @inject:still-gate -->
**A visible defect in the still is already a STOP.** Do not animate it. Fix the frame first, then move to motion — and go to motion only when the crop passes the still scan and you genuinely need movement to confirm an uncertain edge, reflection, or object.

This is a **cost** rule as much as a craft rule: a 1080p/10s premium video generation costs many multiples of an image re-roll, and video is where a defect stops being fixable. Anything wrong in the still gets worse in motion — soft geometry mushes, broken-but-plausible objects fall apart, oily textures start crawling. **Animating a known-bad frame is the single most expensive mistake in the pipeline.** Re-rolling the image is the cheap move; re-rolling the video is not.
<!-- @end:still-gate -->
