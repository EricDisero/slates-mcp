---
name: slates-prompting-suno
description: How to prompt Suno in Slates. Read before calling slates_generate_audio with model suno. Full music tracks - EVERY call returns TWO variations for one flat price and duration is FREE up to 360 seconds. The rule that decides everything - in CUSTOM mode the prompt field is the EXACT LYRICS (sung as written), in DESCRIPTION mode it is a description and the lyrics get written for you. Covers the mode matrix, style vs prompt steering, instrumental scoring, negative tags, and the character caps.
---

# Suno — prompting

Full music generation, reached through the sunoapi.org wrapper. Models `V4`, `V4_5`, `V4_5PLUS`, `V4_5ALL`, `V5`, `V5_5`.

**Two facts that should shape every decision:**

1. **Every call returns TWO songs** — two genuinely different takes on the same brief, for one flat price. Audition both before re-rolling.
2. **Length is free.** A 360-second track costs exactly what a default one costs (measured against the live provider balance 2026-07-31: a default call and a `duration: 240` call both debited the same). There is never a reason to generate a bed shorter than your edit.

## Where it routes

- **Anything a listener would call a song or a score** — theme, underscore, needle-drop, montage bed, end-card sting.
- **NOT** ambience or room tone — that is `seed-audio`, which is cheaper and better at it.
- **NOT** a single effect — that is `eleven-sfx`.
- **AUDIO-ONLY.**

## 🚨 THE RULE: which mode you are in changes what `prompt` means

| `customMode` | `instrumental` | Required | What `prompt` means |
|---|---|---|---|
| `false` | either | `prompt` only (≤500 chars) | **A description.** Lyrics get written for you. |
| `true` | `true` | `style`, `title` | **Unused.** Style + title do all the steering. |
| `true` | `false` | `style`, `title`, `prompt` | **THE EXACT LYRICS**, sung as written. |

Putting a description in the prompt field while `customMode: true` and `instrumental: false` gets your description **sung back at you**. This is the single most common Suno mistake and it costs a full generation every time.

## Description mode — the fast path

```
customMode: false
prompt: "brooding synthwave for a night drive, analog bass, no vocals, 90 bpm"
```

Use it when you need a mood and do not care about specific words. 500-character cap. This is the right default for background beds.

## Custom mode — when the words matter

```
customMode: true
instrumental: false
style:  "dream pop, hazy, reverb-heavy guitars, female vocal, 100 bpm"
title:  "Blue Hour"
prompt: "[Verse 1]\nThe lights come on before we're ready\n..."
```

Structure tags (`[Verse]`, `[Chorus]`, `[Bridge]`, `[Outro]`) inside the lyrics are how you control the arrangement. Everything that is not a structure tag will be sung.

## Instrumental scoring

```
customMode: true
instrumental: true
style: "tense orchestral strings, low brass swells, no percussion"
title: "Approach"
```

`instrumental: true` is the right answer for almost every film bed — a vocal you did not ask for will fight your dialogue.

## Steer with `style`, not with adjective piles

Genre + era + instrumentation + tempo belong in `style`, not stuffed into `prompt`.

```
✓ style: "90s trip-hop, dusty breakbeat, Rhodes piano, upright bass, 85 bpm"
✗ prompt: "a really cool dusty 90s trip hop song with a Rhodes and..."
```

`negativeTags` removes what keeps creeping in: `"brass, EDM drop, male vocal"`.

## The steering knobs

| Param | Range | Reach for it when |
|---|---|---|
| `duration` | 10–360s (**V5_5 + custom mode only**) | Always, when the bed must outlast the cut. It is free. |
| `vocalGender` | `m` / `f` — **the wire values, not "male"/"female"** | A specific voice is required. |
| `styleWeight` | 0–1 | The style field is being ignored (raise) or strangling the song (lower). |
| `weirdnessConstraint` | 0–1 | Takes are too safe (raise) or falling apart (lower). |
| `audioWeight` | 0–1 | Balancing an audio input against the prompt. |
| `personaId` / `personaModel` | — | A series needs the same voice/sound across episodes. |

## Character caps

| Field | V4 | V4_5 / V4_5PLUS / V5 / V5_5 | V4_5ALL |
|---|---|---|---|
| prompt (custom = literal lyrics) | 3000 | 5000 | 5000 |
| prompt (non-custom = description) | 500 | 500 | 500 |
| style | 200 | 1000 | 1000 |
| title | 80 | 100 | 80 |

## Iterating

- **Audition both returned songs first.** A re-roll costs a full generation; the second variation is already paid for.
- Wrong genre → fix `style`. Wrong words → you are in the wrong mode, check the matrix above.
- Something keeps appearing that you do not want → `negativeTags`, not more prompt.
- Three failed generations on the same brief means the style field is too vague, not that the seed is unlucky.

## Ops notes

- Tracks take 2–3 minutes; a streamable preview exists ~30–40s in. Use `background: true` and poll.
- The provider hosts files for a limited window — **Slates downloads and stores them locally as soon as the track finishes**, so nothing expires out from under a project.
- Suno has **no official public API**; this rides an unofficial wrapper. Treat availability as best-effort and do not build a deadline around it.

## Content notes

Provider-side moderation rejects lyrics and style prompts naming real artists or protected material (`SENSITIVE_WORD_ERROR`). Describe the sound, not the artist. See slates-content-policy.
