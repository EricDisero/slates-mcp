---
name: slates-prompting-lip-sync
description: How to set up lip-sync — Kling-only (dedicated lip-sync and avatar endpoints, 5-second outputs). Read before calling slates_generate_lip_sync. Two flows — video→video re-dub and image→video avatar — with different inputs, pricing, and gotchas. Voice catalog, framing rules, audio file constraints, and which tier to pick. Also covers the Seedance alternative, which is a normal video generation rather than a mode of this tool.
---

# Lip-sync — setup guide

<!-- @card:start -->
<!-- slates-only -->
<!-- MACHINE-READ. Everything between the @card markers is extracted by
     src/prompts/craft-cards.ts and returned on every cost estimate for this
     model, so it is the ONE piece of positive craft guidance the agent cannot
     skip. Measured 2026-08-30: a fact inlined where it cannot be skipped moved
     compliance 0/8 to 30/32; the same guidance behind a fetch moved nothing.
     Keep it under 2,400 characters (the build fails above that) and keep the
     rationale, the receipts and the worked examples in the body below. -->
<!-- /slates-only -->
**Card — Lip-sync (Kling only).** Two different flows with different inputs and different prices; every output is 5 seconds.

**The five levers**
1. **Pick `sourceType` deliberately** — `video` re-dubs an existing talking head (cheapest); `image` animates a still portrait (avatar-standard, then avatar-pro only on the final selected take).
2. **The `prompt` on the avatar flows is SCENE CONTEXT, not motion direction.** Ambience, lighting, micro-expression: `Soft rim light`, `warm office`, `cool blue evening light through a window`, `gentle confident smile between sentences`, `focused intent expression`.
3. **Clean the audio before uploading** — `noise-reduced`, `levelled`. Lip detection is sensitive, and a raw recording is the most common cause of a bad take.
4. **Iterate on the SOURCE or the AUDIO, never on a refinement prompt** — there is not one. If the output is wrong, change the input.
5. **Use avatar-standard for first-pass dialogue takes**, and switch to pro only once the line is locked. Facial fidelity is not visible until then.

**Examples**
- `Soft rim light, warm office, gentle confident smile between sentences.`
- `Cool blue evening light through a window, focused intent expression.` (Or `.` — an empty prompt is fine when you have nothing to add.)

**Hard constraint:** it is Kling-only and always 5 seconds. For a generated PERFORMANCE instead — head movement, gesture, delivery energy, with the dialogue as a native conditioning signal — that is a normal Seedance video generation with the clip attached as a video reference, not a mode of this tool. Real voice or a cloned voice for production; TTS is for scratch.
<!-- @card:end -->

<!-- @banned:start -->
<!-- slates-only -->
<!-- MACHINE-READ. Every `backticked` token between the @banned markers is
     extracted by src/prompts/banned-tokens.ts and returned on this model's cost
     estimate, and every submitted prompt is matched against it. Keep entries
     backticked and prose outside the backticks. -->
<!-- /slates-only -->
**Never use** — the avatar prompt is scene context and motion verbs are ignored:
- `turns her head`, `raises an eyebrow`, `hand gestures`, `nods`, `walks`
- `reader_en_m-v1` — listed in fal's docs, returns "Voice id not found" in production
<!-- @banned:end -->

**This tool is Kling-only.** It wraps Kling's dedicated lip-sync and avatar endpoints; every entry is a real endpoint and every output is 5 seconds.

| Flow | Source | Model | Cost | Use case |
|------|--------|-------|-----------|----------|
| Re-dub | video clip | kling-lip-sync-video | ~4 credits / 5s | Replace dialogue on an existing talking head |
| Avatar standard | still image | ai-avatar/v2/standard | ~14 credits / 5s | Animate a portrait into a talking avatar |
| Avatar pro | still image | ai-avatar/v2/pro | ~29 credits / 5s | Higher facial fidelity for hero shots |

Pick `sourceType` deliberately — it decides the pricing tier and the underlying endpoint.

## Want Seedance instead? That is a video generation, not a mode here

Seedance can generate the performance rather than bolting a mouth onto finished pixels — head movement, gesture, delivery energy, with the dialogue as a native conditioning signal, and a video source keeps its own voice. **It is not an engine switch on this tool.** Run a normal `slates_generate_video` on `seedance-2` with the clip (or portrait) attached as a video/ingredient reference and the dialogue written into the prompt yourself.

That is the same endpoint the old `engine=seedance-2` branch called — it just built the sentence for you, invisibly, and it presupposed a "video 1" that might not exist. Writing the prompt is the whole difference, and it is the part you want control of.

- Driving clips must be 2–15s; output duration is whatever you set (4–15s).
- Video references bill COMBINED input+output seconds (`seedance-2*-vref-*` keys) — pass the clip duration and quote before confirming.
- Faces go through the normal cascade: `seedanceFace` for a character, `[REAL_FACE_DETECTED]` → `seedanceRealFace` + `realFaceConsent` for a real person.

Everything below is about the Kling tool.

## Choosing video vs avatar

Use **video** (re-dub) when:
- A talking-head clip already exists (Slates-generated, recorded, or imported)
- The mouth/face is already moving and only the audio needs to change
- ~4 credits is hard to beat for short dialogue replacement

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
- You're already paying tens of credits for the surrounding video pipeline

Don't default to pro. The ~15-credit delta per take adds up across iteration.

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

- Video re-dub at ~4 credits is the cheapest dialogue iteration in the entire Slates stack — use it for voice A/B testing
- Avatar standard at ~14 credits is fine for medium use
- Avatar pro at ~29 credits trips the confirm gate — explicit user OK required every time
- All 5s. There is no shorter option.

## Workflow patterns

**Voice A/B test (cheap):**
1. Generate one base talking-head video clip with Veo or Seedance (~40 credits)
2. Run `slates_generate_lip_sync` with `sourceType: 'video'` against 3–5 different `ttsVoice` values
3. Total cost: ~40 + (5 × ~4) ≈ 60 credits to compare voices

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

- ✅ "Lip-syncing **IMG-A12 — Founder Portrait** to the new line. ~29 credits on avatar-pro. Confirm?"
- ❌ "Using the founder image..." (which? Three exist.)

Don't second-guess the source. If the output is wrong, iterate on source choice or audio, not on a refinement prompt (there isn't one).

## Sources

- [fal.ai — Kling LipSync API](https://fal.ai/models/fal-ai/kling-video/lipsync/text-to-video/api)
- [fal.ai — AI Avatar v2 Standard](https://fal.ai/models/fal-ai/kling-video/ai-avatar/v2/standard/api)
- [fal.ai — AI Avatar v2 Pro](https://fal.ai/models/fal-ai/kling-video/ai-avatar/v2/pro/api)
