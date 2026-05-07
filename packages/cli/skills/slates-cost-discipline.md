---
name: slates-cost-discipline
description: Mandatory pre-flight discipline before ANY generation call (image or video) — estimate cost, announce in dollars, get confirmation, aggregate batches. Read this every time before calling slates_generate_image or any future slates_generate_* op. Skipping this risks burning the user's credits on guesses.
---

# Slates cost discipline — read before every generation

Generation costs real money. Every call is on the user's credits. The user can't see what you're about to spend until you tell them. **Tell them first, generate second.**

## The 4 rules

### 1. Pre-flight estimate — never call generate without one

Before ANY `slates_generate_*` call, run `slates_estimate_generation_cost` first. Inputs you must lock before estimating:

- **Model** — derived from the op (`slates_generate_image` → `nano-banana-2-{resolution}`)
- **Resolution** — never let the op default. Pick deliberately. Drafts → 1k. Hero → 2k. Print → 4k.
- **Aspect ratio** — never let the op default to 1:1. Pick from the use case (cinematic → 16:9, mobile vertical → 9:16, square feed → 1:1).
- **Count** — explicit. Don't generate 4 when 1 will tell you if the prompt works.

If aspect ratio or resolution isn't obvious from the user's request, **ask before estimating**. Don't guess.

### 2. Announce in dollars, plainly, before spending

Format: `About to spend $X.XX on N image(s) at [resolution] [aspect ratio]. Proceed?`

Examples:
- `About to spend $0.10 on 1 image at 1k 16:9. Proceed?`
- `About to spend $0.40 on 4 images at 2k 9:16 (variants). Proceed?`

Below ~$0.20 you can proceed silently after announcing once. Above $0.20 wait for explicit confirmation. Above $0.50 the server itself will gate with `requires_confirm` — pass `confirm: true` only after the user explicitly OKs.

### 3. Aggregate batches into ONE upfront announcement

If you're planning a multi-call workflow (5 storyboard frames, 3 character variants, a grid of options), **announce the total before the first call**, not five $0.10 announcements after the fact.

Format: `Plan: N generations totaling $X.XX. [Brief description of the sequence.] Proceed with the batch?`

Example: `Plan: 6 frame generations at 1k 16:9 totaling $0.60 — establishing wide, push-in, two-shot, reverse, OTS, insert. Proceed?`

### 4. Track the running total

After each generation completes, the response includes `cost_cents` (when available). Keep a running tally in your context. Surface it every 3 generations or whenever the user asks "how much have we spent?"

## Resolution decision rules

| Use case | Resolution |
|---|---|
| First draft of a new prompt | 1k |
| Storyboard frame (will likely regenerate) | 1k |
| Hero shot, locked composition | 2k |
| Print, marketing asset, final delivery | 4k |
| Iterating to refine | match the previous resolution |

For Nano Banana 2 specifically, all three ship at the same price band on fal.ai — pick by need, not cost.

## Aspect ratio decision rules

Ask the user when ambiguous. Otherwise:

| Context cue | Aspect ratio |
|---|---|
| "cinematic", "film", "movie", "wide" | 16:9 |
| "TikTok", "Reels", "Story", "mobile vertical", "phone" | 9:16 |
| "square", "Instagram feed", "thumbnail" | 1:1 |
| "ultra-wide", "anamorphic", "cinemascope" | 21:9 |
| "portrait", "magazine cover", "vertical" | 4:5 or 2:3 |
| "landscape photo", "horizontal" | 3:2 or 4:3 |

If the user prompt mixes signals (e.g. "cinematic Instagram post"), ask. Don't guess.

## When the gate fires

The server returns `requires_clarification` when aspect ratio or resolution is missing. The server returns `requires_confirm` when total spend exceeds $0.50. In both cases:

1. Surface the gate response to the user
2. Get a clean answer
3. Re-call with the explicit values + `confirm: true` if applicable

Don't bypass the gate by silently filling in defaults. The gates exist because defaults waste money.

## The 3-strike rule

Stop after 3 iterations on the same prompt. Hand back to the user with what you tried and what's not working. The slot machine doesn't converge — if it's not landing, the prompt structure is wrong, not the seed.
