---
name: slates-cost-discipline
description: Mandatory pre-flight discipline before ANY generation call (image or video) — estimate cost, announce in credits, get confirmation, aggregate batches. Read this every time before calling slates_generate_image or any future slates_generate_* op. Skipping this risks burning the user's credits on guesses.
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

### 2. Announce in credits, plainly, before spending

Slates bills abstract **credits** (they never expire). Announce the credit total the estimate returns — never dollars.

Format: `About to spend N credits on M image(s) at [resolution] [aspect ratio]. Proceed?`

Examples:
- `About to spend 4 credits on 1 image at 1k 16:9. Proceed?`
- `About to spend 24 credits on 4 images at 2k 9:16 (variants). Proceed?`

Below ~7 credits you can proceed silently after announcing once. Above ~7 credits wait for explicit confirmation. Above ~17 credits the server itself will gate with `requires_confirm` — pass `confirm: true` only after the user explicitly OKs.

### 3. Aggregate batches into ONE upfront announcement

If you're planning a multi-call workflow (5 storyboard frames, 3 character variants, a grid of options), **announce the total before the first call**, not five small announcements after the fact.

Format: `Plan: N generations totaling C credits. [Brief description of the sequence.] Proceed with the batch?`

Example: `Plan: 6 frame generations at 1k 16:9 totaling 24 credits — establishing wide, push-in, two-shot, reverse, OTS, insert. Proceed?`

### 3b. Batch authorization — one approval covers the enumerated batch

When the user approves a batch plan with one aggregated cost total up front ("8 scenes, ~$X total — go"), that single approval authorizes `confirm=true` on **each enumerated call in that batch** — and nothing beyond it. You do not need to re-ask per call; that's the point of the upfront announcement. Hands-off multi-scene runs depend on this.

Boundaries that re-trigger confirmation:

- Any call's actual estimate exceeds what the announced plan implied for it by **>25%** → stop, surface the delta, get a fresh OK.
- New calls are added that weren't in the enumerated plan (extra variants, retries beyond the plan, a new scene) → those are NOT covered. Announce and confirm separately.
- The batch scope changes (different model, resolution, or duration than announced) → re-announce, re-confirm.

One approval = that plan, as enumerated, at those prices. Nothing else.

### 4. Track the running total

After each generation completes, the response includes `cost_credits` (when available). Keep a running tally in your context. Surface it every 3 generations or whenever the user asks "how much have we spent?"

## Resolution decision rules

| Use case | Resolution |
|---|---|
| First draft of a new prompt | 1k |
| Storyboard frame (will likely regenerate) | 1k |
| Hero shot, locked composition | 2k |
| Print, marketing asset, final delivery | 4k |
| Iterating to refine | match the previous resolution |

Resolution is a price lever, not a free choice: on Nano Banana 2 and FLUX.2 Max, 4k costs roughly 2x 1k (Seedream 5 Lite is flat-priced regardless of resolution). Prices change — call `slates_estimate_generation_cost` or `slates_list_available_models` for current numbers instead of assuming. Pick the cheapest resolution that serves the use case.

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

The server returns `requires_clarification` when aspect ratio or resolution is missing. The server returns `requires_confirm` when total spend exceeds ~17 credits. In both cases:

1. Surface the gate response to the user
2. Get a clean answer
3. Re-call with the explicit values + `confirm: true` if applicable

Don't bypass the gate by silently filling in defaults. The gates exist because defaults waste money.

## Video is slow + async — a timeout is NOT a failure

Video gens take minutes (Seedance 4K can run far longer). A client/CLI timeout or a slow, empty-looking response is **not** a failed generation — the job is still running on the provider.

- **Never re-submit a video gen because it "timed out."** That double-charges the user for one video. Re-rolling a slow gen is the single most expensive mistake here.
- **Poll, don't re-roll.** Use `background: true` on `slates_generate_video`, then poll `slates_get_generation_status` (free, read-only) until it reports `completed` or `failed`. In-flight jobs survive app restarts and are recovered.
- A gen has only failed when the status comes back `failed` — and a provider *rejection* **refunds** the credits, so failed isolation tests are ~free. Until you see a terminal status, the job is in flight. Wait.

## The 3-strike rule

Stop after 3 iterations on the same prompt. Hand back to the user with what you tried and what's not working. The slot machine doesn't converge — if it's not landing, the prompt structure is wrong, not the seed.
