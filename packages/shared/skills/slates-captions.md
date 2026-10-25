---
name: slates-captions
description: "Caption speech in a cut: free local transcription, correcting a transcript, word-timed captions from the transcript, the Shot's line or your own words, phrasing, emphasis, caption components and mismatches."
---

# Captions from speech

<!-- @operative:start -->
**Operative summary.**
- Transcribing and captioning are free, so there is nothing to estimate; say so before the first transcription on a machine, because the speech models download once. (§ Transcribe)
- Caption real speech with `slates_add_captions` from the transcript source; use the script source only when recognition fails, and tell the user the words may drift. (§ Add captions)
- Correct misheard words once in the transcript with `slates_edit_asset_transcript`, never caption by caption. (§ Correct a transcript)
- Phrase by what each line is doing, and never split a name, a number from what it counts, or a prepositional phrase. (§ Phrases)
- Ration emphasis tiers: emphasis is rare, italic and slam rarer, and only caption components draw the tiers. (§ Emphasis; § Caption components)
- Read `mismatches` and `skipped` in the result, tell the user whether the recognizer or the performer was wrong, then look at the frames. (§ Read the result)
<!-- @operative:end -->

Captions are text clips on an overlay track, one per phrase, each carrying its words so the spoken word lights up on the frame it is said; or one HTML clip drawn by a caption component. Transcribing and captioning are both free: they run on the user's machine and spend no credits, so there is nothing to estimate.

## Transcribe

`slates_transcribe_asset` turns a video or audio asset's speech into words timed to within a frame. The first run on a machine downloads the speech models once, about 595 MB, and can take minutes; say so before the first call. The result's `downloadedModelsMB` says what it fetched, and later runs are offline. If the call times out, the desktop keeps working: read `slates_get_asset_transcript` before calling again.

A repeat reuses the stored transcript (`reused: true`). `force` transcribes again and replaces a transcript the user edited (`edited: true`), so force only when they ask. `noSpeech: true` is an answer, not a failure.

`slates_add_captions` transcribes any clip that needs it, so a separate transcribe call is for reading the words first: checking names, choosing emphasis, planning phrases.

## Correct a transcript

`slates_edit_asset_transcript` takes the whole transcript text back, edited, the way the user edits it in the app's **Transcript** editor. A corrected word keeps its time, a removed word goes, and a new word takes the silence beside it or a share of its neighbour's time. Only the words count; paragraph breaks are free. Then the captions heard from that asset are made again from the corrected words, on the same tracks in the same style (`recaption: false` skips that). Captions estimated from the Shot's line or made from your own words are left alone.

Correct the transcript, not each caption: one fix reaches every caption heard from that asset and any made later. Read the text first with `slates_get_asset_transcript`, change only the misheard words, and send it all back.

## Add captions

`slates_add_captions` takes one of three sources:

- **transcript** (the default): the words heard in each clip, through its in and out points. Use it whenever there is real speech.
- **script**: the clip's Shot line spread over the speech the audio holds. Its timing is estimated (the result's `timing` says `estimated`), so use it only when recognition fails, as under a loud music bed, and tell the user the words may drift.
- **words**: your own words in timeline seconds, such as a corrected transcript or a line whose timing you already know.

By default every clip with sound is captioned, on a new Captions track on top. `clipIds` narrows it and `trackId` names an existing overlay track. Read `slates_get_timeline` first for the clip ids and where they sit.

## Phrases

Unless you pass your own, the app groups the words by the caption rules it ships with. A phrase breaks at a sentence end, a clause comma, a pause of 150 ms or more, and before a conjunction once it holds a few words. A phrase is at most two lines of 42 characters. It shows from 80 ms before its first word to 150 ms after its last, and where two windows overlap they split the gap, so one phrase shows at a time. Windows always come from the word times, never from you: a window that opened after its first word would skip that word.

The automatic grouping knows punctuation, not intent. Reading what a line is doing is your job, and `phrases` is how you act on it:

- a hook, a kicker or a payoff: one or two words, turning over fast;
- a conversational bridge: three to five, broken at breaths and clause changes;
- a measured, reflective line: four to six, held longer.

Never split a name, a number from what it counts ("44 markdown files") or a prepositional phrase ("in a folder").

`phrases` are `[from, to)` ranges of word indexes: `from` is the phrase's first word and `to` is one past its last, counted across the whole call in timeline order, in order and without overlap. The words counted are the ones the call captions: each clip's words between its in and out points, clip after clip in timeline order. `slates_get_asset_transcript` returns the whole file, so for a trimmed clip skip the words said before its in point (compare their times with the clip's source in and out in `slates_get_timeline`), or pass `words` yourself so the indexes are yours.

## Emphasis

`tiers` marks words by index as `italic`, `emphasis` or `slam`; every other word is `regular`. Emphasis that is everywhere means nothing, so ration it:

- **emphasis**: about one word in eight, at most one or two a phrase. Brand and product names, a number that carries the claim, a contrarian word, the payoff.
- **italic**: two or three in a piece, for soft contrast ("just", "only", "even").
- **slam**: one or two in a piece, on the word the line lands on. It draws largest, so choose a short word; when the payoff is long, slam a shorter word in the same line or make the long one emphasis.

Only caption components draw the tiers: **caption-editorial-emphasis** sets italic and emphasis (slam draws as emphasis), and kinetic-slam, clip-wipe, particle-burst, neon-glow and neon-accent colour the emphasis and slam words as their keywords. The text styles below show every word as regular.

## Styles

`style` defaults to **word-pop**: bold captions in which the spoken word lights up. The others:

- **keyword**: one or two big words, for punch-beat phrases;
- **subtitle**: sentence-case lines on a dark box low in the frame, for long talk;
- **headline**: a title near the top of the frame;
- **clean**: plain text with a soft shadow.

Keep captions off faces and clear of the platform's buttons: the app's **Show safe area** marks where those sit. Change a caption later with `slates_update_overlay_clip`.

## Caption components

`component` draws the captions with a caption component instead of text clips: one HTML clip from the first word to the last, animating every word in that component's look, so `style` does not apply. Twelve are checked to draw fed words: caption-highlight, caption-pill-karaoke, caption-weight-shift, caption-glitch-rgb, caption-neon-glow, caption-gradient-fill, caption-kinetic-slam, caption-clip-wipe, caption-matrix-decode, caption-particle-burst, caption-neon-accent and caption-editorial-emphasis. Each has a preview video: `slates_list_motion_blocks` with query `caption` and type `component`.

Your `phrases` become the component's word groups and your `tiers` its emphasis, so phrase and ration emphasis as above. The result's `findings` is Slates' composition check of the fed composition; a warning is worth reading, and an error means the clip will not draw. The components are drawn for a 16:9 frame and fit inside a vertical one, so on 9:16 they sit smaller; text-clip captions fill a vertical frame better. A transcript correction does not reach a component clip: after correcting, remove the clip with `slates_remove_clip` and add the captions again.

## Read the result

Where a heard word and the Shot's written word are the same word, the caption takes the Shot's spelling, so brand names keep their casing. Where they differ, the caption shows what was said, and `mismatches` lists each place: heard, written, and the time.

Each mismatch is one of two things. The recognizer misheard a name or a term: correct the transcript with `slates_edit_asset_transcript`, which keeps the timing and makes the captions again. In the app's **Transcript** editor the same words are underlined, with the script's word on hover. Or the performer changed the line: the caption is right, and the Shot's line is what to update if the script should match, or the take to regenerate if the exact words matter (that one spends credits; `slates-cost-discipline`). Tell the user which you found rather than quietly changing either side.

`skipped` names each clip left out and why. A caption remembers the Shot line it was made against, so after the line is edited the app shows "Script changed": caption that clip again. Then look at the frames (`slates-vision-feedback-loop`) to check the placement and the line breaks.
