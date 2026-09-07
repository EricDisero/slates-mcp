---
name: slates-prompting-inworld-tts
description: How to use Inworld Realtime TTS-2, the VOICE seat. Read before calling slates_generate_audio with model inworld-tts-2. Speech in a SPECIFIC voice, billed per character - the prompt is the words spoken, verbatim, max 2000. Covers the identity-versus-acoustics rule (what a reference clip does and does not carry), how to write a line so it is performed rather than read, when to reach for seed-audio instead, and the voice-consent rule.
---

# Inworld Realtime TTS-2 — the voice seat

<!-- @card:start -->
<!-- slates-only -->
<!-- MACHINE-READ. Everything between the @card markers is extracted by
     src/prompts/craft-cards.ts and returned on every cost estimate for this
     model, so it is the ONE piece of positive craft guidance the agent cannot
     skip. Keep it under 2,400 characters (the build fails above that) and keep
     the rationale and the worked examples in the body below. -->
<!-- /slates-only -->
**Card — Inworld TTS-2.** Speech in a SPECIFIC voice. The prompt is the words spoken, verbatim — not a description of them. Max 2000 characters, and the length of the text is the bill.

**IDENTITY, NOT ACOUSTICS — the rule that decides whether cloning works**
A reference carries WHO is speaking: timbre, pitch, accent, age, vowel shape. It does NOT carry WHERE they are — room tone, distance, phone EQ, reverb and mic character are *acoustics*, and this model reproduces the identity while discarding the room. So:
1. **A noisy reference does not give a noisy read — it gives a WORSE identity.** Music, a second speaker or heavy reverb corrupt what is being extracted. Feed it the cleanest 5–15 seconds of one person you have.
2. **You cannot get "on a payphone" by cloning a payphone recording.** Acoustics come from the MIX, or from `seed-audio` which renders a room.

**DIRECTION GOES IN SQUARE BRACKETS. PARENTHESES ARE SPOKEN ALOUD.** `[whispering] I hope nobody notices` is whispered; `(quietly) I hope nobody notices` says the word "quietly" out loud. Verified by ear — the easiest way to ruin a take.

- **Plain English works inside them** — it is natural-language steering, not a fixed vocabulary: `[very quiet]`, `[whisper in a hushed style]`, `[very slow]`, `[say excitedly]`. Non-verbals are their own tags: `[laugh]`, `[sigh]`, `[breathe]`, `[clear throat]`.
- **A tag it does not recognise is still consumed, and still changes the read.** Never spoken, never an error — so a mistyped tag fails SILENTLY and only listening catches it.
- **Tags persist across sentences** until changed; `[reset]` returns to normal.
- **Punctuation is the timing.** `Wait. Stop.` differs from `Wait, stop.`
- **One line, one take.** Split a paragraph so a bad clause costs one re-roll.
- **Spell numbers and titles aloud:** `twenty twenty-six`, `Doctor Reyes`.

**Route elsewhere when:** the scene needs dialogue mixed with effects and room tone in one pass (`seed-audio`), or it is a single non-speech sound (`eleven-sfx`). This surface makes ONE voice saying ONE thing, cleanly.

**Hard constraints:** no duration parameter — length falls out of the text. Max 2000 characters per take. Exactly one voice source: the character's voice clip as `voiceReferenceAssetId` (speak AS the character), `voiceDescription`, or a preset `voiceId`.
<!-- @card:end -->

<!-- @banned:start -->
<!-- slates-only -->
<!-- MACHINE-READ. Every `backticked` token between the @banned markers is
     extracted by src/prompts/banned-tokens.ts and returned on this model's cost
     estimate, and every submitted prompt is matched against it. Keep entries
     backticked and prose outside the backticks. -->
<!-- /slates-only -->
**Never use** — the prompt on this surface is SPOKEN ALOUD, so anything that describes the audio instead of being the audio gets read out as words:

- `SFX`, `Ambient noise`, `Background music` as labels — this model speaks; it does not render a scene. Use `seed-audio` for those.
- shot language: `wide shot`, `slow push in`, `warm tungsten` — video-prompt words, and here they would literally be said aloud
- `voiceover`, `narrator says`, `he says` as stage directions wrapping the line — write only the words that should come out of the speaker
<!-- @banned:end -->

## Why the prompt is not a prompt

On every other surface in Slates the prompt DESCRIBES what you want and the model interprets it. Here the prompt IS the deliverable: each character is spoken aloud and each character is billed. `a gravelly man says he is tired` produces a voice saying the words "a gravelly man says he is tired".

That also means the two numbers a user cares about are the same number. The text length sets the price (in 250-character buckets) and sets the length of the audio. There is nothing to choose and nothing to reconcile.

## Steering the delivery

`VERIFIED BY EAR, 2026-09-05.` Every claim in this section was listened to, not
inferred — an earlier draft of this skill documented tag forms that had only been
probed for an HTTP 200, which proves the request was accepted and nothing about
whether it was obeyed.

**Square brackets are consumed. Parentheses are read aloud.** That is the whole
rule, and getting it wrong is not a subtle degradation — the audience hears a
narrator say the word "quietly" in the middle of your line.

| Written | What comes out |
|---|---|
| `[whispering] I really hope nobody notices that.` | whispered, tag not spoken ✅ |
| `[very quiet] I really hope nobody notices that.` | very quiet, tag not spoken ✅ |
| `[whisper in a hushed style] …` | hushed, tag not spoken ✅ |
| `[very slow] …` | slowed right down, tag not spoken ✅ |
| `[laugh] …` | an actual laugh, then the line ✅ |
| `(quietly, under his breath) …` | 🚨 **the words "quietly, under his breath" are SPOKEN** |

**Plain English works — it is natural-language steering, not a fixed vocabulary.**
Both the documented phrasings (`[whisper in a hushed style]`) and ordinary adverbs
(`[whispering]`) were obeyed. Write the direction the way you would say it to an
actor.

The eight dimensions the model steers on, with a working example of each:

| Dimension | Example |
|---|---|
| Emotion | `[say excitedly]`, `[sound sad]`, `[sound terrified]` |
| Articulation | `[say with force]`, `[articulate clearly]` |
| Intonation | `[say with a rising pitch]` |
| Volume | `[very quiet]`, `[very loud]` |
| Pitch | `[say in a low tone]` |
| Range | `[say playfully]`, `[say with no pitch variation]` |
| Speed | `[very fast]`, `[very slow]` |
| Vocal style | `[whisper in a hushed style]`, `[give a nasal quality]` |

Non-verbals sit inline where they happen: `[laugh]`, `[sigh]`, `[cough]`,
`[breathe]`, `[yawn]`, `[clear throat]`.

### Four rules that are not obvious

1. 🚨 **A tag it does not recognise is still consumed, and still changes the read.**
   `[zzzqqq]` is not spoken and does not error — it produces a different, arbitrary
   delivery. So a typo in a tag is SILENT: there is no rejection, no warning, and no
   way to catch it except listening to the take. Treat an unexpected performance as
   a possible misspelled tag before you blame the voice.
2. **Tags persist across sentences.** A `[very slow]` at the top governs everything
   after it until something changes it. Use `[reset]` to go back to normal rather
   than assuming the next sentence starts clean.
3. **Do not stack opposing directions.** `[whisper in a hushed style]` together with
   `[very loud]` produces unpredictable results — the model is resolving a
   contradiction, and which side wins is not something you can rely on.
4. **Tags COUNT toward the billed characters**, even though they are never spoken.
   They are part of the text sent to the vendor, so the vendor charges for them and
   so do we — billing what was actually sent is the only honest basis. It rarely
   matters (a 13-character tag inside a 250-character bucket), but a line sitting
   just under a bucket boundary can be pushed into the next one by a long
   direction. Prefer `[very slow]` over `[say this one very slowly please]`.

## Identity versus acoustics, at length

This is the distinction that decides whether the feature feels good, and it is worth being precise about because the failure is quiet — you get a usable clip that is subtly not the person.

**What a reference clip transfers:** vocal timbre, pitch range, accent and regional vowels, apparent age, speech rate tendencies, and the particular rasp or breathiness of the source speaker.

**What it does not transfer:** the room, the microphone, the codec, the distance from the mic, any processing on the source, and any other sound present in it.

So the ideal reference is boring: one person, close to a microphone, no music, no second speaker, no heavy reverb, five to fifteen seconds, speaking normally rather than performing. A phone voice memo in a quiet room beats a beautifully produced clip with a music bed underneath it.

**Two failure modes, both common:**

- *"I cloned my podcast intro and it doesn't sound like me."* The intro had music under it. The model averaged the music into the identity. Re-clone from a clean stretch.
- *"I want the line to sound like it's coming through a car radio."* Clone the clean voice, then EQ and process the returned clip on the timeline. A radio-sounding reference makes a worse voice, not a radio effect.

## Getting the voice onto the call

A voice is a field on a CHARACTER — an audio clip, the `voiceAssetId` on the row `slates_list_characters` returns. Exactly one source per call:

- **Speak AS a character:** `voiceReferenceAssetId: <its voiceAssetId>`. The seat clones the clip for that take and discards the vendor voice afterwards, so there is nothing to reconcile — but cloning shares a ceiling of two new voices a minute across every Slates user, so a run of lines in one cloned voice pauses between takes rather than failing. Send each line once; do not re-send one that already came back.
- **A character with no recording:** `voiceDescription` (7–1000 characters of words). Attach the returned clip with `slates_update_character` (`voiceAssetId`) so every later line reuses it instead of designing a new voice each time.
- **A preset:** `voiceId` is a vendor voice id from the desktop's voice bench shelf. It is not a character id and not an asset id, and an agent rarely holds one.

## Consent

Cloning a real person's voice needs that person's explicit, documented permission, scoped to what you are making. Clone from original human recordings only — never from another model's output. This is the same gate the real-face route applies to likeness, and it applies here for the same reason.

## Worked examples

**A line with a direction**

```
[very quiet] I heard what you said in there. I'm not going to pretend I didn't.
```

**A line that needs its numbers spoken**

```
The vote was three hundred and twelve to eighty-nine. It carried at four minutes past midnight.
```

**A paragraph, split into three takes** — so one bad clause costs one re-roll:

```
1. You keep asking me why I stayed.
2. It wasn't loyalty. It wasn't even fear, not by the end.
3. [very slow] It was that I couldn't picture the version of me that left.
```

**What NOT to send**

```
(gravelly, tired) a tired old man narrates the opening of the film, wide shot, warm tungsten
```

Every word of that is spoken aloud — **including the parenthetical**, which is the
trap: it looks like a stage direction and is treated as dialogue. Describe the voice when you are BUILDING one (the character's voice bench takes a description); once the voice exists, send only the words.
