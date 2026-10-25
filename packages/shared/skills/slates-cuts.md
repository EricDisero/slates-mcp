---
name: slates-cuts
description: "Cut a Slates timeline: trim, roll, ripple, slip, split, speed, J/L-cuts, music cut to the sample."
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

To remove a clip and close its gap, use `slates_remove_clip` with `ripple: true` and the `projectId`.

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

## Audio follows the slow motion

When the picture slows down, slow the sound with it and the moment lands. Put every key on one clock: in, hold, out, end, in frames from each sound clip's start (one short used 4.6, 5.2, 7.2 and 7.9 s: frames 110, 125, 173 and 190 at 24 fps). The ease into and out of the hold is `{ cubicBezier: [0.3333, 0, 0.6667, 1] }`; the key at the start of the hold is `linear`. Each line is one `slates_update_clip`:

- **The music's tape speed:** `speedRamp` keys 1 at 110 (eased), 0.5 at 125, 0.5 at 173 (eased), 1 at 190. Pitch and tempo drop together, an octave at 0.5. The clip keeps its media in and out and its length becomes what the keys take, so choose the source range that lands at the length the cut needs, then read it back with `slates_get_timeline`. Not with `speed`.
- **The music, muffled:** an `eq` effect with `params: { "lowpass.q": 0.7071 }` and `keyframes: { "lowpass.frequency": ... }` on the same four keys, 20000 to 1000 Hz and back. The cutoff moves by octave, so the eased keys sound like an even fall.
- **The shot's own sound:** the same `eq` keys with the floor at 2500 Hz, lighter than the music's, so the action stays clear under it.
- **Level:** a constant level is `volume` (linear; -4 dB is 0.631, +1 dB is 1.122). A dip on the slow part is a `volume` effect with `gainDb` keyed on the same clock. End the music with `audioFadeOutFrames` (6 is a quarter second at 24 fps).

`effects` is sent whole, so send back every effect the clip keeps. Keys sit on whole frames: a clock between frames rounds to the nearest one. Export and listen across the ramp before calling it done.

## Music cut downbeat to downbeat

To shorten a song, or loop a bar, cut from one downbeat to a later one and join them with a 10 ms crossfade. A beat rarely lands on a frame, so set the edges in seconds (to the sample, at 48 kHz) instead of frames. Find each downbeat's time in the file first, from the user, a beat map or by listening. The worked example keeps 28.000 to 39.890 s of a song, then 41.570 s onward, 16.000 s in all, at 24 fps:

- **The first piece:** `slates_add_clip_to_timeline` with the audio `assetId`, `startSec: 0`, `sourceInSec: 28`, `sourceOutSec: 39.89`. Its sound ends at 11.890 s, between frames 285 and 286.
- **The second piece:** the same asset on the same lane (`trackId` from the first result), `startSec: 11.89` (where the first ends), `sourceInSec: 41.58`, `sourceOutSec: 45.69`. Leave out `startSec` and it starts where the lane's last sound ends, which is the same place.
- **The join:** `slates_add_transition` with `fromClipId` and `toClipId`, `durationMs: 10`, `curve: "linear"`, `alignment: "end"`. The first piece fades out over its last 10 ms (11.880 to 11.890 s) while the second fades in over the 10 ms of its file before its in point, so the later downbeat lands at 11.890 s and the second piece is heard from 41.570 s. Linear suits a join inside one song: both sides are the same music and add up. Two different sounds want `"equal-power"`, the default.
- **Read it back:** `slates_get_timeline` lists each clip's `startSec`, `endSec`, `sourceInSec` and `sourceOutSec` (with `sampleAxis: true`) and the transition's `durationSec` and `curve`. The second piece should end at 16.000 s.

If you were handed the edit as filter text, `atrim=28.000:39.890` then `atrim=41.570:57.570` joined by a 10 ms triangular crossfade and cut to 16 s, it is the edit above: the first trim is the first piece, and the second piece's in point is the second trim's start plus the crossfade (41.570 + 0.010 = 41.580), its out where 16 s runs out (41.580 + 16 - 11.890 = 45.690).

Sample counts work too: `sourceInSample` and `sourceOutSample` instead of the seconds. To move a join, `slates_update_clip` with the first piece's new `sourceOutSec`, then the second piece's `startSec` set to the first's new `endSec` (from `slates_get_timeline`); `ripple: true` moves later clips by whole frames only, so it does not keep a join exact. A clip with a speed ramp keeps its edges on frames. The preview hands the sound over at the nearest frame; the export joins it to the sample, so export (`slates_export_video`, `audioBitrate: 320` for the clearest sound) and listen across the join.

## Two clips stacked in a split screen

Two clips share one tall frame, one above the other, with a picture over both for the labels. The worked example is a previs under its final in a 1080x1920 short at 24 fps, 360 frames. Each line is one op:

- **The frame:** `slates_update_timeline_settings` with `width: 1080`, `height: 1920`, `frameRate: 24`, before any clip goes in: an empty timeline takes its size from its first clip, and a later larger clip raises the canvas.
- **One clip per lane:** `slates_add_clip_to_timeline` with `startFrame: 0` and the lane's `trackId`. The previs (1920x1080) goes on video lane 1, frames 0 to 360. The final (1280x720) goes on video lane 2, frames 0 to 360; overlapping video resolves top lane wins, and its own sound lands on audio lane 1.
- **Size and place each lane:** `slates_set_clip_keyframes` with one key at `frame: 0` per property; one key holds its value for the whole clip. `scale` multiplies the clip's framed size about the frame's centre (1 is as framed). `positionX` and `positionY` move its centre in frame widths and heights (0.1 is a tenth of the frame right or down). So a negative `positionY` sits above the middle. The previs takes `scale: 0.907407`, `positionY: 0.134375` (258 px below the middle of 1920). The final takes `scale: 0.901852`, `positionY: -0.197656` (379.5 px above).
- **Labels over both:** text clips, frames 0 to 360, each in its own font at an exact size (`slates_add_text_clip` with `style: "plain"`, `font` such as `bebas-neue` or `montserrat-extrabold`, and `fontSize` as a fraction of the frame's height). A logo before its words is the clip's `pictureAssetId`; clips that share a `line` (`{ name, place }`) sit side by side, left to right by `place`, and are centred as one, which is how a `[logo] Blender + [logo] slates` strip is set. The reference row's pictures are `slates_add_image_overlay` items.
- **Read it back:** `slates_get_timeline` shows the frame size, the frame rate, each clip's range and its keys (`timeline.keyframes`). Check all of them against the numbers above.

## Check the cut

After a pass, read the timeline again and watch it in the open Cut, or export it (`slates_export_video`) and look at the frames around each change. Say what you changed in the user's words: "tightened the opening by half a second, rolled the cut to her line".
