---
name: slates-prompting-motion-transfer
description: How to set up motion transfer — Kling Motion Control only (std and pro tiers, 5-second outputs). Read before calling slates_generate_motion_transfer. Reference image (character) + driving video (motion source) → new video of the character performing the motion. Asset selection rules, character_orientation, tiers, and prompt usage. Also covers the Seedance alternative, which is a normal video generation rather than a mode of this tool.
---

# Motion transfer — setup guide

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
**Card — Motion transfer (Kling Motion Control only).** A target IMAGE (your character) plus a source VIDEO (the motion) produces your character performing that motion. Always 5 seconds.

**The five levers**
1. **The target image must show body proportions clearly** and the character must occupy more than about 5% of the frame. A tiny figure in a wide shot has nothing to drive.
2. **Single character in the target.** A group image breaks the identity anchor.
3. **Choose `characterOrientation` on purpose** — `video` takes the source clip's framing, `image` preserves the portrait's. It is the most-missed choice here.

4. **The prompt is atmosphere only** — `Soft afternoon sunlight, dust motes in the air, vintage warm color grade.` Motion verbs are ignored; the motion is already in the driving video.
5. **Pick the best 5 seconds of the source up front**, and write only atmosphere: `soft afternoon sunlight`, `vintage warm color grade`, `clean studio backdrop`. The output is 5s regardless, so a long driving clip just wastes the choice.

**Examples**
- `Soft afternoon sunlight, dust motes in the air, vintage warm color grade.`
- `Clean studio backdrop, sharp focus on the character.` (Or leave it empty.)

**Hard constraint:** cartoon driving videos fail, and a cropped or partial target character drifts. std is fine while the motion-and-framing combination is still moving; switch to pro once it is locked. For a REGENERATED shot instead — physical contact, cloth and hair, camera motion, native audio — that is a normal Seedance video generation with the driving clip as a video reference, not a mode of this tool.
<!-- @card:end -->

<!-- @banned:start -->
<!-- slates-only -->
<!-- MACHINE-READ. Every `backticked` token between the @banned markers is
     extracted by src/prompts/banned-tokens.ts and returned on this model's cost
     estimate, and every submitted prompt is matched against it. Keep entries
     backticked and prose outside the backticks. -->
<!-- /slates-only -->
**Never use** — the motion is already in the driving video, so motion verbs are ignored:
- `spins faster`, `jumps higher`, `add more energy`, `moves quicker`
<!-- @banned:end -->

Take a still **target image** (your character) and a **source video** (the motion you want), produce a new video of your character performing the source video's motion. **This tool is Kling-only** — it wraps Kling Motion Control and nothing else.

| Tier | Cost | Use case |
|------|-----------|----------|
| Kling std (`kling-mc-std-5s`) | ~32 credits / 5s | General motion transfer, budget lane |
| Kling pro (`kling-mc-pro-5s`) | ~42 credits / 5s | Cleaner anatomy, better identity preservation |

Both tiers trip the confirm gate. User OK required every time. (Prices are approximate — `slates_estimate_generation_cost` returns the exact credit total.)

## Want Seedance instead? That is a video generation, not a mode here

Kling MC retargets a skeleton onto a finished image; Seedance *generates* the shot with the motion as a conditioning input — the difference shows on fast choreography, physical contact, cloth/hair, and camera motion, and the output carries native audio. **It is not an engine switch on this tool.** Run a normal `slates_generate_video` on `seedance-2` with the driving clip attached as a video reference and the character image as an ingredient, then write the prompt yourself:

```
The character from image 1 performs the exact motion, choreography, and camera
movement from video 1. Preserve the character's identity, appearance, and outfit.
```

That is the same endpoint the old `motionModel=seedance-2` branch called — it just wrote that sentence for you, invisibly. Add style/setting/camera direction freely; Seedance re-generates the whole shot.

- **Driving clip must be 2–15s** (all providers cap reference video at 15s). Longer clips: trim first, or use Kling MC (`characterOrientation: 'video'` takes up to 30s).
- **Billing = combined input+output seconds** (the vref keys). The server probes the clip and corrects an understated key — quote via the confirm gate before spending.
- **Faces route through the face cascade**: `seedanceFace` for a character, `[REAL_FACE_DETECTED]` → confirm consent → `seedanceRealFace=true, realFaceConsent=true` (premium realface vref pricing).
- `characterOrientation` has no Seedance equivalent; framing follows the prompt + `aspectRatio`.

Everything below is about the Kling tool.

## Inputs

- `sourceVideoAssetId` — driving video. **Must be a realistic human** with clear proportions. Anime/cartoon/CG driving videos fail.
- `targetImageAssetId` — character to be animated. Can be any style (cartoon, anime, realistic, painted).
- Both must already exist as assets in the project. Use `slates_list_assets` to find them or upload first.

## Source video constraints

- Realistic human (not animated, not CG)
- Entire body OR upper body visible — head must not be obstructed
- Subject occupies a clear share of the frame
- Single primary subject. Multi-person driving videos confuse the motion anchor.
- Clean motion — choppy / cut-edited driving videos produce jittery output

Good driving video sources:
- Reference dance footage with one subject
- Walking / gesture / posing clips
- Talking-head footage when paired with character_orientation: 'video'

Bad driving video sources:
- Music videos with multi-shot edits
- Anime / animation clips
- Heavily stylized footage with smoke / particles obscuring the body
- Footage where the subject's head leaves frame mid-clip

## Target image constraints

- Character body proportions clearly visible
- Character occupies >5% of image area (not a tiny figure in a wide shot)
- Single character. Group images break the identity anchor.
- Any artistic style works — cartoon, anime, painted, realistic, 3D render

Avoid:
- Extreme close-up of just the face (no body to drive)
- Character partially cropped at the waist when the driving video is full-body
- Multiple characters

## character_orientation — the most-missed choice

This single parameter changes the output dramatically. Pick deliberately.

| Value | Output framing | Max source duration | Best for |
|-------|----------------|---------------------|----------|
| `video` | Matches driving video framing | Up to 30s source | Complex full-body motion (dance, action, athletics) |
| `image` | Matches target image framing | Up to 10s source | Camera moves, simpler motion, preserving original composition |

**Default `video`** when the driving video has the look you want (most cases).

Switch to `image` when the target image's composition is the brand asset and the motion is secondary (e.g., a hero shot of a character that needs subtle gesture, not a full performance).

## Tier choice — std vs pro

**std (~32 credits)** for:
- Drafts, motion exploration, blocking
- Group scenes where the character isn't a hero shot
- When the budget is tight and the motion is the focus

**pro (~42 credits)** for:
- Final hero takes
- Branded characters where identity drift = unacceptable
- Anatomically complex motion (limbs crossing, fast direction changes)
- Anime / cartoon target images — pro handles non-realistic styles better

Don't default to pro. The ~10-credit delta compounds fast across iteration.

## Prompt usage (optional)

The `prompt` field is **scene/style refinement**, not motion direction. The motion comes from the driving video — the prompt sets ambiance, lighting, additional detail.

Good:
- `Soft afternoon sunlight, dust motes in the air, vintage warm color grade.`
- `Clean studio backdrop, sharp focus on the character.`

Bad (model ignores motion verbs — they're already in the driving video):
- ❌ `She spins faster and jumps higher.`
- ❌ `Add more energy to the dance.`

Leave it empty if you don't have a specific atmospheric note.

## Common failure modes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Limbs distort / extra fingers | std tier, complex motion | Switch to pro |
| Character identity drifts | Target image cropped too tight | Use a fuller-body target |
| Output looks "stuck" / minimal motion | Driving video subject too small in frame | Pick a driving video where the subject fills more of the frame |
| Cartoon target turns realistic | std tier on stylized art | Switch to pro — handles non-realistic styles better |
| Garbled output entirely | Anime / CG driving video | Use realistic human driving footage |
| Wrong framing on output | character_orientation set wrong | Try the other value |
| Background bleeds through character | Target image had complex background | Use a target with cleaner background separation |

## Workflow patterns

**Reference dance to brand character:**
1. Generate or upload the brand character as a still image (clean background, full body, single subject)
2. Find driving footage — a clean reference video of the dance you want
3. Upload both as project assets
4. Run motion transfer with `motionModel: 'kling-mc-pro'`, `characterOrientation: 'video'`
5. Total cost: ~42 credits per 5s take

**Subtle motion on a hero portrait:**
1. Use the locked hero portrait as the target image
2. Pick a driving video with subtle gesture (head turn, slight posture shift)
3. `characterOrientation: 'image'` to preserve the portrait's framing
4. std tier is fine for this case — motion isn't dramatic

**Avoid:**
- Pro tier on first iteration — waste, switch to it once the motion + framing combo is locked
- Cartoon driving videos — guaranteed failure
- Cropped or partial target characters — identity will drift
- Long driving videos when output is 5s — pick the best 5s of the source upfront

## Cost discipline

- 5 seconds, no shorter option
- Both tiers trip the confirm gate — every call needs explicit user OK
- Iteration is expensive: 4 takes at pro ≈ 168 credits. Lock framing + driving video before tier-up to pro.
- Always run a single std take first to validate the motion + framing combo before committing to pro

## Confirm gate: cost + codes, no inline preview

Motion transfer is mechanical — the model deterministically applies source motion to target image. Both tiers trip the confirm gate; the response includes the asset codes for source and target so you can announce them in chat.

- ✅ "Transferring motion from **VID-V3** onto **IMG-A12 — Detective Closeup**. ~42 credits, confirm?"
- ❌ "Using the walk video and the detective image..." (multiple of each in the project.)

Don't second-guess the assets the user picked — the model executes the transfer. If the output is wrong, iterate on motion source or target choice, not on a refinement prompt.

## Sources

- [fal.ai — Kling Motion Control V3 Standard](https://fal.ai/models/fal-ai/kling-video/v3/standard/motion-control)
- [fal.ai — Kling Motion Control V3 Pro](https://fal.ai/models/fal-ai/kling-video/v3/pro/motion-control)
