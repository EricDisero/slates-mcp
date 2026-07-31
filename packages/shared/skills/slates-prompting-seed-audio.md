---
name: slates-prompting-seed-audio
description: How to prompt Seed Audio 1.0 (ByteDance, via fal). Read before calling slates_generate_audio with model seed-audio. The one-pass audio SCENE model — dialogue, SFX and ambience together from ONE plain sentence. CRITICAL - it has NO duration parameter, so length must be named IN THE PROMPT TEXT and Slates bills the duration you request. Covers the one-sentence doctrine, the crowd-size rule, why Kling "SFX:" syntax hurts here, and the audio-refs-XOR-image input rule.
---

# Seed Audio 1.0 — prompting

ByteDance's one-pass audio scene model, carried on fal (`bytedance/seed-audio-1.0`). It generates dialogue, sound effects and ambience **together**, from a single plain sentence. 1–120 seconds. It is the default audio model in Slates and the workhorse for continuity beds.

## Where it routes

- **Scene audio, room tone, ambience beds, crowd/nature soundscapes** — anything where several sounds share a space. One generation, not three layered ones.
- **Fast scratch dialogue** when the exact wording is still moving. Once the script locks and the read has to be repeatable, switch to `eleven-v3`.
- **NOT** a single effect that must land on a known frame — that is `eleven-sfx`, which takes an exact duration.
- **NOT** music — that is `suno`.
- **AUDIO-ONLY.** It cannot produce images or video.

## THE RULES

### 1. 🚨 There is no duration parameter — the words set the length

This is the single most important fact about this model. Output length is driven by the prompt text ("… 15 seconds"), capped at 120s.

**Slates handles this for you:** the `durationSeconds` param appends the duration to the prompt and **bills that number of seconds**. So:

- Set `durationSeconds` to what you actually want.
- **Do not also write a different length into your sentence.** Two numbers fight, and you pay for the one you selected, not the one you got.
- If the returned clip is shorter than requested you still paid for the request — that is the deal that keeps the displayed price equal to the charge. Ask for what you need.

<!-- slates-only -->
The server re-derives the billed key from `durationSeconds` (a client cannot under-bill), probes the returned `audio.duration` after completion, and logs `SEED AUDIO BILLING DRIFT` if the model overshot. No auto-charge, no refund — the request is the contract.
<!-- /slates-only -->

### 2. One plain sentence. No production jargon.

Field-proven (Higgsfield sprint, 2026-07-27/28). Working prompts look like this:

```
tiny applause of 2 or 3 people at an open mic. 15 seconds
nature soundscape, wide open field cicadas and birds and a loon.
a diner at 2am, one coffee machine hissing, cutlery somewhere behind the counter
```

Not this:

```
✗ AMBIENCE: interior diner, night. SFX: espresso machine (hiss, 2s), cutlery.
✗ Wide shot of a diner. Slow push in. Warm tungsten. Ambient noise: ...
```

Shot language, camera moves and lighting belong to video prompts. Here they are just words the model has to ignore.

### 3. Never bring Kling's audio syntax to this model

`SFX:` and `Ambient noise:` prefixes and `Background music:` labels are **Kling 3.0 video** syntax. Seed Audio has no parser for them — it reads them as text in the scene and the output gets measurably worse. Describe the sounds directly instead.

### 4. Name the crowd size, the room size, the distance

The highest-leverage single edit on any bed. Unqualified nouns default big:

| Vague | What it returns | Fixed |
|---|---|---|
| `applause` | a full auditorium | `tiny applause of 2 or 3 people` |
| `traffic` | a highway | `one car passing on a wet residential street` |
| `crowd` | a stadium | `four people talking at the next table` |

Distance words (`far off`, `muffled through a wall`, `right next to the mic`) work the same way and are how you build depth in one sentence.

### 5. Beds must outlast the cut

Ask for a few seconds more than the clip needs so the edit has handles to fade through. A bed that ends exactly on the cut always sounds clipped. This is a product requirement, not a preference — it is why the duration control exists at all.

### 6. Dialogue goes in quotes, inside the same sentence as the room

```
a tired bartender says, "we closed twenty minutes ago", glasses clinking behind him
```

Pick a preset voice when a specific speaker matters. Leave `voice` unset and the scene casts itself — which is usually right for crowd and background dialogue.

Preset voices (20): `vivi_mixed_en_zh_ja_es_id`, `mindy_en_es_id_pt_zh`, `kian_en_zh`, `cedric_en_zh`, `sophie_en_zh`, `jean_en_zh`, `magnus_en_zh`, `mabel_en_zh`, `nadia_en_zh`, `opal_en_zh`, `pearl_en_zh`, `quentin_en_zh`, `corinne_mixed_en_zh`, `esther_mixed_en_zh`, `lyla_mixed_en_zh`, `tracy_es_zh`, `sandy_es_mixed_en_zh`, `felix_zh`, `celeste_zh`, `monkey_king_zh`.

Set `multilingual: true` for non-English or mixed-language lines.

### 7. Inputs: up to 3 audio clips **XOR** one image. Never both.

- **Audio references** — up to 3 clips, each ≤30s and ≤10MB (wav/mp3/pcm/ogg_opus). Refer to them in the prompt as `@Audio1`, `@Audio2`, `@Audio3`: *"match the room tone of @Audio1"*.
- **Image reference** — one image (jpeg/png/webp ≤10MB). The model scores what it sees.
- Sending both is rejected by the API. Pick the one that carries the intent.

### 8. The knobs, and when to touch them

| Param | Range | Reach for it when |
|---|---|---|
| `speed` | 0.5–2.0 | Dialogue is racing or dragging against picture. |
| `volume` | 0.5–2.0 | Rarely — normalize on the timeline instead. |
| `pitch` | −12…+12 semitones | Ageing or shifting a voice. Small moves only; ±3 is already a lot. |
| `multilingual` | bool | Non-English or code-switched lines. |
| `sampleRate` | 8k–48k | Leave at 24000 unless you are matching an existing stem. |
| `outputFormat` | mp3 / wav / pcm / ogg_opus | wav when this is going into a mix; mp3 otherwise. |

## Iterating

- A bed that came back wrong is almost always a **scale** problem (crowd/room too big) or a **jargon** problem (the sentence reads like a spec). Fix those two before touching `speed`/`pitch`.
- Three failed takes on the same sentence means the sentence is wrong, not the seed. Rewrite it the way you would say it out loud.
- Generations are cheap enough at short durations that auditioning two phrasings beats agonizing over one.

## Content notes

Provider-side moderation applies to voices and to recognizable real people. See slates-content-policy.
