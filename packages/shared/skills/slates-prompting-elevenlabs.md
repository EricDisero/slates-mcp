---
name: slates-prompting-elevenlabs
description: How to prompt the two ElevenLabs surfaces in Slates. Read before calling slates_generate_audio with model eleven-v3 (Eleven v3 text-to-speech - controlled, repeatable, named-voice voiceover, billed per 100 characters) or eleven-sfx (Sound Effects v2 - one short effect with an EXACT duration, 0.5-22s, billed per second). Covers the "the text field is spoken verbatim" rule, punctuation as the only timing control, stability, describing an effect by its physical cause, and when to use Seed Audio instead.
---

# ElevenLabs — prompting (Eleven v3 TTS + Sound Effects v2)

Two separate surfaces from the same vendor, carried on fal (`fal-ai/elevenlabs/tts/eleven-v3`, `fal-ai/elevenlabs/sound-effects/v2`). They share nothing but a bill — treat them as different tools.

## Where they route

- **`eleven-v3`** — the exact words matter and the read must be **repeatable**: ad reads, narration, character lines you will lip-sync against, anything a client will ask you to re-render after a copy tweak. Billed per 100 characters of text, rounded up.
- **`eleven-sfx`** — a single sound that has to land on a known frame, or a seamless loop. Billed per second, 0.5–22s.
- **Neither** for layered scenes. A room with dialogue *and* clatter *and* ambience is one `seed-audio` pass, not three ElevenLabs generations.
- **AUDIO-ONLY.** Neither can produce images or video.

---

## Eleven v3 (`eleven-v3`) — THE RULES

### 1. 🚨 The text field is the script. Every character is spoken.

```
✗  (excited) Read this fast — "Grab yours today!"
✓  Grab yours today!
```

Stage directions, speaker names, bracketed emotion tags and markdown all get read out loud. There is no instruction channel — direction lives in `stability` and in how you punctuate.

### 2. Punctuation is the only timing control

| You want | Write |
|---|---|
| a hard stop | `It works. Every time.` |
| a beat, not a stop | `It works — every time.` |
| a trailing hesitation | `It works… mostly.` |
| a list rhythm | `Faster, cheaper, and yours.` |

Rewrite the punctuation before you touch a setting. It moves the read more than `stability` does.

### 3. Pick a voice and keep it

20 presets: Aria, Roger, Sarah, Laura, Charlie, George, Callum, River, Liam, Charlotte, Alice, Matilda, Will, Jessica, Eric, Chris, Brian, Daniel, Lily, Bill. Default `Rachel`.

One voice per character, one per piece. A series that swaps voices between shots reads as an accident. There is **no voice cloning on this route** — a cloned ElevenLabs voice ID is not supported and must not be assumed to pass through.

### 4. Stability

| Value | Behavior | Use for |
|---|---|---|
| ~0.3 | expressive, varies take-to-take | one dramatic line, character dialogue |
| 0.5 (default) | balanced | most reads |
| ~0.8 | flat, highly repeatable | long narration, anything you will re-render |

Raise it when re-rolls keep giving you a different performance. Lower it when the read is lifeless.

### 5. Spell out what TTS gets wrong

Acronyms, product names, prices, years and URLs are where it embarrasses itself. Write the pronunciation:

```
SKU        → "ess kay you"
2026       → "twenty twenty six"
$19.99     → "nineteen ninety nine"
slates.video → "slates dot video"
```

Set `languageCode` (ISO 639-1) to force a language when the text is ambiguous or code-switched.

### 6. Length is money, honestly

1–5000 characters, billed in 100-character buckets rounded up. A tightened sentence costs less; a pasted stray paragraph costs more. This is the one Slates surface where editing the copy is also a cost control.

### 7. Timestamps are free — leave them on

Word-level timestamps come back with every generation at no extra charge. They are exactly what a caption/subtitle pass consumes. There is no reason to disable them.

---

## Sound Effects v2 (`eleven-sfx`) — THE RULES

### 1. Describe the physical CAUSE, not the label

```
✗  door sound
✓  heavy oak door slams shut in a stone hallway

✗  whoosh
✓  a thick rope swung fast past a microphone, low air displacement

✗  footsteps
✓  boots on wet gravel, slow, one person
```

Material + weight + surface + room. Naming all four is the difference between a usable effect and a stock-library shrug. Cap is 450 characters — you will not need them.

### 2. One sound per generation

This surface makes a single event. A door, then footsteps, then a siren is three generations layered on the timeline — or one `seed-audio` scene, which is usually cheaper and always more coherent.

### 3. Duration is always explicit, and it is the price

`durationSeconds` is 0.5–22 and Slates **always sends it**. (Left null the model picks, which makes the charge non-deterministic — so it is never left null.)

| Kind of sound | Ask for |
|---|---|
| impact, hit, click | 0.5–1s |
| whoosh, riser, transition | 2–4s |
| loopable bed | 8–22s + `loop: true` |

Over-asking pads the tail with room tone you then trim. Under-asking clips the decay.

### 4. Loops

`loop: true` tiles without a seam — rain, engine hum, crowd murmur, machine noise. Combine with a longer duration so the loop point is not obvious.

### 5. Prompt influence

`promptInfluence` 0–1, default 0.3. Higher hugs your wording with less variation between takes; lower explores. Raise it when a re-roll keeps wandering off the brief; lower it when every take sounds like the same take.

---

## Iterating on either surface

- TTS re-rolls that keep drifting = raise `stability`. TTS reads that sound robotic = lower it, then fix the punctuation.
- SFX re-rolls that keep missing = the prompt named a label instead of a cause. Rewrite it as a physical event.
- Three failed takes means the prompt is wrong, not the seed.

## Content notes

ElevenLabs applies its own moderation, and voice likeness of real people is restricted by their terms. See slates-content-policy.
