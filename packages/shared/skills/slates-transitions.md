---
name: slates-transitions
description: "Choose and place transitions between clips on a Slates timeline, or keep the plain cut."
---

# Transitions — Slates craft

A transition sits on a cut: two clips that meet on one lane. Most cuts in a good edit are plain cuts. A transition says something the cut cannot: time passed, a place changed, a mood turned, or a beat hit. Put one only where it carries that meaning.

## Choosing one

- **Plain cut** (no transition): continuous action, dialogue, a cut on motion, anything that should feel immediate. This is the default; leave it.
- **Calm kinds** (a dissolve, a dip to black or white, a light leak): time passing, a memory, a soft scene change, the end of a section. A dip to black closes a chapter; a dip to white reads as a flash of memory or a reveal.
- **Lively kinds** (a wipe, push, slide, iris): a list, a before-and-after, a change of place in an upbeat piece. Repeat one kind through a sequence so it reads as a device, not noise.
- **Loud kinds** (a zoom, flash, whip pan, glitch and the other stylised ones): on a musical hit, a hook, a product reveal in an ad. Use them sparingly; three in a 30-second ad is already a lot.

`slates_get_timeline` returns `transitionKinds`, each with its `label`, `description`, `energy` (calm, lively, loud) and the lane it belongs on (picture kinds on video and overlay lanes, a crossfade on audio lanes). Choose from that list; never invent a kind.

## Length and placement

- The default is half a second centred on the cut. Fast edits and ads want 0.25 to 0.5 s; a slow, emotional piece can take 1 to 2 s.
- `alignment`: `center` straddles the cut and uses media from both clips; `start` begins at the cut (the next clip's start is covered); `end` finishes at the cut.
- A length the clips cannot hold is refused with the longest that fits. Leaving the length out takes the default, shortened to fit.

## Short media

If a clip's file runs out inside the transition, it still saves and the result's `shortHandles` says how many frames are missing. Pick one fix with `slates_update_transition`: `fix: "freeze"` holds the edge frame for those frames (fine for a still moment), or `fix: "shorten"` cuts the transition to what the media covers (better when the clip is moving). Tell the user which you chose.

## Sound

A picture transition crossfades the two clips' sound with it unless its `params.audio` is `false`. On an audio lane, put a crossfade between two music or voice clips that meet, so the join has no click. For a fade to or from silence or black on one clip, set that clip's fades with `slates_update_clip`, not a transition.

## Doing it

1. Read the cut with `slates_get_timeline`: clip ids, which clips meet, existing `transitions`.
2. `slates_add_transition` with `fromClipId` and `toClipId` (or `clipId` and `side`), and the `kind`, length and `alignment` you chose. Adding where one exists changes it.
3. Change one later with `slates_update_transition`; take one off with `slates_remove_transition`.
4. Check the result: watch the cut in the open Cut, or export it (`slates_export_video`) and look at the frames around the cut.

None of this generates media or spends credits.
