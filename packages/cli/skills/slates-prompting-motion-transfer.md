---
name: slates-prompting-motion-transfer
description: How to set up Kling Motion Control (motion transfer). Read before calling slates_generate_motion_transfer. Reference image (character) + driving video (motion source) → new video of the character performing the motion. Asset selection rules, character_orientation choice, std vs pro tier, and prompt usage.
---

# Kling Motion Control — setup guide

Take a still **target image** (your character) and a **source video** (the motion you want), produce a new 5s video of your character performing the source video's motion.

| Tier | Cost (5s) | Use case |
|------|-----------|----------|
| std (`kling-mc-std-5s`) | $0.95 | General motion transfer |
| pro (`kling-mc-pro-5s`) | $1.26 | Cleaner anatomy, better identity preservation |

Both tiers trip the >$0.50 confirm gate. User OK required every time.

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

**std ($0.95)** for:
- Drafts, motion exploration, blocking
- Group scenes where the character isn't a hero shot
- When the budget is tight and the motion is the focus

**pro ($1.26)** for:
- Final hero takes
- Branded characters where identity drift = unacceptable
- Anatomically complex motion (limbs crossing, fast direction changes)
- Anime / cartoon target images — pro handles non-realistic styles better

Don't default to pro. The $0.31 delta compounds fast across iteration.

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
5. Total cost: $1.26 per 5s take

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
- Both tiers trip the >$0.50 confirm gate — every call needs explicit user OK
- Iteration is expensive: 4 takes at pro = $5.04. Lock framing + driving video before tier-up to pro.
- Always run a single std take first to validate the motion + framing combo before committing to pro

## Sources

- [fal.ai — Kling Motion Control v2.6 Standard](https://fal.ai/models/fal-ai/kling-video/v2.6/standard/motion-control/api)
- [fal.ai — Kling Motion Control v2.6 Pro](https://fal.ai/models/fal-ai/kling-video/v2.6/pro/motion-control/api)
