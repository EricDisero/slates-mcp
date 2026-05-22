---
name: slates-prompting-lip-sync
description: How to set up Kling lip-sync. Read before calling slates_generate_lip_sync. Two flows — video→video re-dub and image→video avatar — with different inputs, pricing, and gotchas. Voice catalog, framing rules, audio file constraints, and which tier to pick.
---

# Kling lip-sync — setup guide

Two distinct flows, both 5-second outputs:

| Flow | Source | Model | Cost (5s) | Use case |
|------|--------|-------|-----------|----------|
| Re-dub | video clip | kling-lip-sync-video | $0.11 | Replace dialogue on an existing talking head |
| Avatar standard | still image | ai-avatar/v2/standard | $0.42 | Animate a portrait into a talking avatar |
| Avatar pro | still image | ai-avatar/v2/pro | $0.86 | Higher facial fidelity for hero shots |

Pick `sourceType` deliberately — it decides the pricing tier and the underlying endpoint.

## Choosing video vs avatar

Use **video** (re-dub) when:
- A talking-head clip already exists (Slates-generated, recorded, or imported)
- The mouth/face is already moving and only the audio needs to change
- $0.11 is hard to beat for short dialogue replacement

Use **avatar** when:
- Only a still portrait exists
- The character needs to come alive from a single image
- Identity + face fidelity matter (avatar-pro for hero shots, standard for everything else)

## Source asset constraints

### Video flow (`sourceType: 'video'`)
- Format: mp4 or mov
- Duration: 2–10s (lip-sync output is always 5s — long videos get trimmed)
- Resolution: 720p or 1080p (480p will be rejected)
- Max file size: 100MB
- Face must be visible and roughly facing camera. Profile shots fail.
- Existing audio is replaced.

### Avatar flow (`sourceType: 'image'`)
- Min 512×512, PNG/JPG/WebP
- **Face occupies 60–70% of frame.** This is the single biggest avatar quality lever.
- Eyes open, mouth neutral, looking near-camera. Side profile = bad output.
- Single subject, clean background. Group photos confuse the face anchor.

## Audio source

Two ways to drive the lips:

### TTS (`audioMethod: 'tts'`)
- Pass `ttsText` (the words spoken)
- Optional: `ttsVoice` (default `oversea_male1`), `ttsLanguage` (default EN), `ttsSpeed` (default 1.0)
- **Hard cap: 120 characters of text.** Longer = silently truncated.
- Languages: EN, ZH, JA, KO, ES

### Upload (`audioMethod: 'upload'`)
- Pass `audioFilePath` — absolute path to an audio file on the user's machine
- Format: mp3, wav, m4a, ogg, aac
- Max 5MB
- Duration: 2–60s (output is 5s — longer audio gets trimmed)
- Single clean voice. Music underneath, multiple speakers, or noisy mics produce garbage lips.

Prefer upload for production-quality voice. TTS for fast iteration / placeholder dialogue.

## Voice catalog (TTS)

Reliable English voices (verified working on the fal endpoint as of 2026):

| Voice ID | Description |
|----------|-------------|
| `oversea_male1` | Male, English — default, stable |
| `commercial_lady_en_f-v1` | Female commercial English |
| `uk_boy1` | Young man, UK accent |
| `uk_man2` | Man, UK accent |
| `uk_oldman3` | Older man, UK accent |
| `calm_story1` | Storyteller / narrator |

Avoid `reader_en_m-v1` — listed in fal.ai docs but returns "Voice id not found" in production.

Full 48-voice list (ZH, JA, KO included): https://fal.ai/models/fal-ai/kling-video/lipsync/text-to-video/api

## Speech-rate notes

`ttsSpeed` range 0.5–2.0:
- 0.8–1.0: natural conversational
- 1.1–1.3: punchy ad delivery
- 1.4+: rushed, clips consonants
- 0.6–0.7: slow, weighty (good for dramatic lines)

Default 1.0 unless the line specifically calls for slower or faster cadence.

## Avatar prompt usage

The `prompt` parameter on avatar-v2 (standard + pro) is **scene context**, not motion direction. The mouth animation comes from the audio — the prompt sets ambiance, lighting, micro-expression.

Good:
- `Soft rim light, warm office, gentle confident smile between sentences.`
- `Cool blue evening light through a window, focused intent expression.`

Bad (the model ignores motion verbs):
- ❌ `She turns her head, raises an eyebrow, then speaks.`
- ❌ `Hand gestures while talking.`

Default `"."` is fine if you have nothing useful to add.

## Tier selection — avatar standard vs pro

**Use standard** when:
- Drafts, A/B testing voices, internal review reels
- Wide / medium shots where face isn't the focal point
- Cost matters more than micro-expression fidelity

**Use pro** when:
- Final ads where the avatar's face fills the screen
- The character is named / branded — identity drift kills the take
- You're already paying $1+ for the surrounding video pipeline

Don't default to pro. The $0.44 delta per take adds up across iteration.

## Common failure modes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Lip movement looks "rubber" / disconnected | Source face <60% of frame | Re-crop the still tighter |
| Voice doesn't match character age/gender | Default voice id used | Pick from voice catalog |
| Output truncated mid-word | TTS text >120 chars | Shorten or chain two takes |
| Garbled mouth on uploaded audio | Background music / multi-voice | Use clean dialogue-only audio |
| "Voice id not found" 422 | Hit `reader_en_m-v1` | Switch to `oversea_male1` |
| Avatar eyes drift / cross | Source had closed/angled eyes | Pick a frame with neutral open eyes |
| Generation completes but lips don't move | Profile shot / face >70° off-axis | Use a near-frontal portrait |

## Cost discipline

- Video re-dub at $0.11 is the cheapest dialogue iteration in the entire Slates stack — use it for voice A/B testing
- Avatar standard at $0.42 is fine for medium use
- Avatar pro at $0.86 trips the >$0.50 confirm gate — explicit user OK required every time
- All 5s. There is no shorter option.

## Workflow patterns

**Voice A/B test (cheap):**
1. Generate one base talking-head video clip with Veo or Seedance (~$1.20)
2. Run `slates_generate_lip_sync` with `sourceType: 'video'` against 3–5 different `ttsVoice` values
3. Total cost: $1.20 + (5 × $0.11) = $1.75 to compare voices

**Brand avatar from a single portrait:**
1. Generate or upload the hero portrait (face fills frame, eyes open, neutral mouth)
2. Avatar standard for first-pass dialogue takes
3. Avatar pro only on the final selected take

**Avoid:**
- Avatar pro on first iteration (waste — facial fidelity isn't visible until you've locked the line)
- TTS for final ads (production should use real voice or cloned voice — the upload flow)
- Uploading raw recordings — clean noise + level the file first, lip detection is sensitive

## Confirm gate: cost + codes, no inline preview

Lip-sync is mechanical — the model re-syncs the chosen source to the chosen audio. The confirm response carries the source asset's code so you can announce it in chat.

- ✅ "Lip-syncing **IMG-A12 — Founder Portrait** to the new line. $0.86 on avatar-pro. Confirm?"
- ❌ "Using the founder image..." (which? Three exist.)

Don't second-guess the source. If the output is wrong, iterate on source choice or audio, not on a refinement prompt (there isn't one).

## Sources

- [fal.ai — Kling LipSync API](https://fal.ai/models/fal-ai/kling-video/lipsync/text-to-video/api)
- [fal.ai — AI Avatar v2 Standard](https://fal.ai/models/fal-ai/kling-video/ai-avatar/v2/standard/api)
- [fal.ai — AI Avatar v2 Pro](https://fal.ai/models/fal-ai/kling-video/ai-avatar/v2/pro/api)
