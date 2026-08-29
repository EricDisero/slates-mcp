---
name: slates-dialogue-blocking
description: Keep multiple characters spatially consistent across cuts — seating, screen direction, eyelines, the 180-degree rule — by blocking the scene in 3D first. Use for any multi-character dialogue scene, conversations around a table or in a car, or when generated characters swap seats, change sides, or look the wrong way between shots.
---

# Dialogue blocking — six people who stay where you put them

The hardest thing to generate, and the case where previs beats raw prompting by the widest margin.

## Why this is hard

Every cut is an independent guess unless something forces agreement. Prompt a six-person conversation four times and you get four different seating charts: characters swap places, the 180-degree line breaks, and nothing cuts together. The failure is not aesthetic — the shots are simply unusable as an edit, and you find out only after paying for all four.

**The blocking fixes it structurally.** Positions exist in 3D, so every camera sees the same arrangement, and consistency stops being something the model has to remember.

## Build

Follow `slates-previs-blocking` and add these.

### Seated proxies, colour-coded

Simple seated shapes. **Do not animate the heads** — a proxy head turning the wrong way is worse than one that never turns.

Give each character a distinct viewport colour and write the mapping down. This is the identity channel:

> red = the boss · green = the kid · blue = the driver · yellow = the fixer · purple = the cousin · cyan = the nephew

That mapping goes verbatim into the generation prompt. It is what lets the model bind a grey body to a character sheet across four cuts.

Set both `object.color` and a material — Workbench renders `object.color`, the viewport reads the material.

### Fix the geography, then never move it

Place people once. Write down who sits where relative to the camera's opening position, in words, because that sentence is going into the prompt:

> Across the table, facing camera: yellow dead centre, purple far left, blue and green to the right.

### The camera plan

Per `slates-camera-language`, with two things specific to dialogue:

- **Below shoulder height, slow rail glides.** Eye-level-and-above reads as surveillance.
- **Decide who owns the near foreground in each cut and honour it.** A shoulder in frame is a spatial anchor; a different shoulder in the next cut relocates the whole room.

The move that earns the most: **a gaze handoff without a cut** — the camera keeps gliding while the target hands off across the table, face to face, slowing on each but never stopping. Build it by keyframing the Track To target's position between subjects.

### Crossing behind someone

A head wiping frame during a move is a strong depth cue. It is also a spatial claim, so pick who gets crossed and say so — *the camera crosses directly behind cyan's back mid-shot and his head wipes the frame once.*

## The prompt

Everything in `slates-blocking-to-prompt`, plus these blocks.

### Geography — restate it as a rule

> TABLE GEOGRAPHY — do not deviate: the camera is never parked behind red. Only in the opening seconds does his dark shoulder hang at the near frame RIGHT edge, and it slides out as the camera travels LEFT. The true near-foreground of this shot is cyan: the camera crosses directly behind him mid-shot. After the opening seconds red is gone from the foreground, and the camera never travels behind anyone except cyan.

### Screen direction, and the mirror that is not a swap

The 180-degree rule survives on its own in the blocking. What breaks is the model **"correcting" a legitimate mirror** — when the camera faces back through a scene, sides invert, and that inversion is correct. Say so explicitly or it gets flipped:

> The driver's seat is on the LEFT for the entire timeline; this layout never mirrors or flips. When a camera faces BACKWARD into the car, screen sides mirror naturally: the driver reads on the RIGHT of frame, the passenger on the LEFT — that is correct left-hand drive, not a swap. They never swap seats or roles anywhere in the timeline.

Then compress it into the HOLD block: *(backward camera mirrors them: he right of frame, she left)*.

### Presence

> A seated person stays drawn even when partially occluded — in every interior frame some part of each seat's owner is visible: a hand, an arm, a shoulder, a head above the bolster. Every occupied seat visibly holds its person.

### Keep everyone alive

Three orthogonal layers. Without them, whoever is not speaking freezes:

- **ONGOING BUSINESS** — a small continuous physical action per character, running whether or not they are speaking. *turns his glass a quarter every few seconds · thumbs a lighter without lighting it.*
- **BACKGROUND LIFE** — soft-focus, low contrast, never pulls attention, never crosses in front of a speaking face.
- **SCENE EVENT** — the unnamed thing everyone is playing but nobody says. One line, repeated verbatim in every character's direction: *keep tomorrow sounding like a fishing trip.*

### Acting, per character

Same six slots each. Terse:

```
ACTING TASK — <character>
  SCENE DIRECTION (shared, unspoken): <the same line for everyone>
  MOTIVE (his fuel): <what he wants underneath>
  GOAL: <what he wants in this scene>
  OBSTACLE: <what is in the way>
  TACTIC: <how he goes about it>
  Moment to moment: <2-3 beats keyed to timestamps>
  (Safety: gaze always engaged in the task — never a frozen, glassy,
   unfocused stare; natural blink cadence.)
```

That safety line is not filler. Dead eyes are the characteristic failure of generated faces in dialogue, and naming it is what prevents it.

### Dialogue must not restructure the edit

Both of these, verbatim, every time:

> DIALOGUE NEVER CREATES SHOTS: spoken lines happen inside the reference's takes exactly as blocked — no cutaways to a speaker, no reverse shots, no added close-ups. If a line plays while the camera is elsewhere, the line stays off-screen audio.

> OFF-SCREEN VOICES RULE: a line marked off-screen must STAY off-screen — never show the speaker, never move him into frame, never route the camera behind him because he spoke.

A sentence may cross a cut. Say so where it does: *the sentence does not pause for the edit.*

## Model routing

Dialogue directed as separate layers (voices, scene sound, score) is **minimax-h3**'s seat; it also takes declared reference relationships, which suits a colour-coded cast. Native synced audio is **Veo**'s niche. seedance-2.5 carries the reference-video capacity. Route per `slates-model-selection` and read the chosen model's prompting skill before writing the audio block.

## Checklist

- [ ] Colour→character mapping written down and pasted into the prompt
- [ ] Heads not animated in the blocking
- [ ] Seating stated as a geography rule
- [ ] Foreground owner named per cut
- [ ] Mirror-is-not-a-swap clause present if any camera faces back through the scene
- [ ] Presence rule present
- [ ] Ongoing business, background life and scene event all specified
- [ ] Acting task per character, safety line included
- [ ] Dialogue-never-creates-shots and off-screen-voices rules present

## Related

`slates-previs-blocking` · `slates-camera-language` · `slates-blocking-to-prompt` · `slates-character-identity` (the sheets) · `slates-prompting-minimax-h3`
