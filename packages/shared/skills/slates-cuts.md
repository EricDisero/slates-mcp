---
name: slates-cuts
description: "Tighten an edit on a Slates timeline: trim, roll, ripple, slip, split, speed, J-cuts and L-cuts."
---

# Cutting — Slates craft

This is the editing pass after clips are on the timeline: making the cut play. Every tool here changes the timeline only; source files are untouched, nothing is generated and nothing is spent. Read the cut first with `slates_get_timeline` (clip ids, `startFrame`, `endFrame`, `sourceInFrame`, `sourceOutFrame`, frame rate).

## Which edit

All of these are `slates_edit_timeline_clips`:

- **Trim** (`action: "trim"`, `edge`, then `frame` or `deltaFrames`): shorten or lengthen one end. A trim cuts media and never changes speed.
  - `mode: "ripple"`: the lane's later clips move by the change, so no gap opens and nothing is covered. Use it to tighten a sequence.
  - `mode: "roll"`: moves the cut between this clip and the one that meets it; the lane keeps its length. Use it to make a cut land on an action or a word.
  - `mode: "overwrite"` (default): grows over a neighbour, covering it.
- **Slip** (`action: "slip"`, `deltaFrames` or `deltaSourceFrames`): keeps a clip's place and length and shows a different part of its file. Use it when the timing is right but the moment is not.
- **Move** (`action: "move"`, `startFrame` or `deltaFrames`, optional `trackId`): `mode: "insert"` pushes the lane's later clips right; `overwrite` covers what it lands on. `trackId` moves clips onto another lane of the same type, such as a B-roll lane above the main one.
- **Split** (`action: "split"`, `frame` or `sec`): cuts every clip there, or only `clipIds`. Split, then trim or remove a piece, to drop a stumble from the middle of a take.

To close a gap left by a removed clip, use `slates_remove_clip` with `ripple: true`.

## Pacing

- Cut on action: end a clip mid-motion and start the next on the same motion.
- Trim the air: the frames before an action starts and after it ends are where an edit feels slow. Ripple-trim them.
- Ads: the first second carries the hook. Ripple the opening clip until something happens in its first frame.
- Hold a beat longer on a reveal or a punchline than feels necessary; cut faster through a list.

## J-cuts and L-cuts

`slates_update_clip` with `audioOffsetFrames` on a video clip moves its own sound against its picture, in sync:

- **J-cut** (below 0): the next scene's sound starts before its picture. The viewer hears where they are going; it pulls them across a scene change and is the usual way into dialogue.
- **L-cut** (above 0): a clip's sound runs on after its picture has cut away. Use it for a reaction shot while someone keeps talking, or to let a line land over the next image.

Half a second (12 frames at 24 fps) is a common starting point. The clip next to it gives way to the shifted sound.

## Speed and level

`slates_update_clip` also sets `speed` (2 is twice as fast and half as long; 0.5 is slow motion and twice as long; `ripple: true` moves the lane's later clips by the change), `volume` (linear gain, 1 unchanged), and fades in frames for the picture (`fadeInFrames`, `fadeOutFrames`) and the sound (`audioFadeInFrames`, `audioFadeOutFrames`). A fade out to black at the end of a piece and a short sound fade on music edges are almost always right. Transitions between two clips: `slates-transitions`.

## Check the cut

After a pass, read the timeline again and watch it in the open Cut, or export it (`slates_export_video`) and look at the frames around each change. Say what you changed in the user's words: "tightened the opening by half a second, rolled the cut to her line".
