---
name: slates-shot-variety
description: Why AI-generated sequences start to look the same, and what to vary to stop it. Use when planning a set of shots, before firing a batch, when the variety counts on a shot list show one bucket dominating, or when a finished piece reads as flat, samey or repetitive despite each shot being individually fine.
---

# Shot variety — why it all starts to look the same

The failure this skill exists for is mechanical, not artistic: **every shot is fine and the sequence is dead.** It happens because a model asked ten times in a row, from ten similar prompts, returns ten similar framings — and because the person writing those prompts is thinking about *what is in the shot* rather than *how this shot differs from the one before it*.

Slates counts the sameness for you. It does not judge it. **`slates_list_shots` returns the distribution with every listing** — shot sizes, camera moves, models, durations, and any bucket repeating three or more times in a row — so the numbers are in front of you before you spend anything. Reading them is the job; deciding what to do is yours.

## Read the table as a COLUMN, not as rows

This is the whole technique, and it is one sentence:

> Sort the list by shot size and count. Sort it by camera move and count. **If push-in is the plurality, or every row says wide, the batch is wrong before a single credit is spent.**

A shot list read row by row always looks fine, because each row was written to be good on its own. The sameness only shows up in the column. That is why the counts ship in the op result rather than in your head.

## What to vary, in order of how much it matters

1. **Shot size.** The single biggest lever, and the one that collapses first. A sequence of seven mediums reads as a slideshow no matter what is in them. Wide → close is a cut; medium → medium is a dissolve nobody asked for.
2. **Camera move.** Second-biggest, and the one models default to: ask for "cinematic" and you get a slow push-in, every time. If five of seven cuts push in, four of them should not.
3. **Duration.** Rhythm is not decoration. Seven identical 8-second cuts is a metronome. A 3-second cut lands differently *because* the one before it ran twelve.
4. **Distance between subjects and lens.** A long lens on a close-up and a wide lens on a close-up are different shots, and the model will render the difference.
5. **Location and cast.** If three cuts happen in the same room with the same person, that is a scene — fine. If *nine* do, the piece has one idea.

## When repetition is deliberate — and it often is

Do not treat the counts as a defect list. Repetition is a technique with two real uses:

- **A repeated frame IS the joke, or the point.** Three identical wides with one thing changed each time is a gag structure, and varying them would destroy it.
- **A locked-off frame is a choice.** Static, static, static, then a move — the move only lands because the first three did not have one.

The check catches a bucket dominating. It cannot tell whether you meant it. If you did, say so and move on; the counts do not block anything and never will.

## Choosing the chop: one long take or several short ones

This is the decision that owns the rhythm, and Slates puts the price next to it: `slates_split_shot` and `slates_merge_shots` re-cut a board, and the row's duration and quote move as you do it.

- **Merge** when the words run continuously and the picture has no reason to change. One 16-second take on a model that holds up is cheaper to *make* than two 8-second cuts and reads calmer.
- **Split** when the words keep going and the picture should not. This is the strongest move in the format: one spoken line running unbroken while the visual hard-cuts mid-clause to a new world. Split at a word boundary mid-sentence and both rows carry the same sentence — Slates marks the second as continuing the first, so the script still reads as one line.
- **Split** also when a line will not fit its cut. Slates flags only lines that cannot be read at *any* plausible pace (above the fastest read in a corpus of 71 real ads), so a flag is never a matter of taste — the chop is genuinely wrong. Splitting the line across two cuts or merging into a longer one both fix it.

## Multi-shot generations count as their cuts, not as one

A model that puts three cuts inside one generation contributes **three** rows to the distribution. That is deliberate: counting generations would score a three-cut clip as a single wide shot and miss exactly the sequences this check exists to catch. Money is counted per generation; rhythm is counted per cut, and the header says which is which.

## What this cannot tell you

It measures buckets, not taste. Seven varied shot sizes can still be seven boring shots, and a piece that scores perfectly can still be flat. It catches the one mechanical failure — everything starting to look the same — and nothing else.

It also only sees what is filled in. A board where nobody wrote `shotSize` reports `other` for every cut and tells you nothing. That is correct rather than a gap: inferring a shot size from a prompt would be Slates guessing at your work, and the counts are trustworthy precisely because they are arithmetic on what you actually wrote.
