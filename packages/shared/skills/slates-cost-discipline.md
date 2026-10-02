---
name: slates-cost-discipline
description: "Estimate and announce generation spend, aggregate batches, follow existing consent and inspect uncertain jobs before retrying. Use when planning or submitting paid media generation."
---

# Slates cost discipline — read before every generation

Generation costs real money. Every call is on the user's credits. The user can't see what you're about to spend until you tell them. **Tell them first, generate second.**

## The 4 rules

### 1. Pre-flight estimate — never call generate without one

Before ANY `slates_generate_*` call, run `slates_estimate_generation_cost` first. Inputs you must lock before estimating:

- **Model** — the id you are about to pass, whatever it is. `slates_estimate_generation_cost` takes the same base ids the generate ops take and resolves the billing key itself; do not build one by hand.
- **Resolution** — use the selected model default unless the user or delivery requires another size. Estimate and generate with the same settings.
- **Aspect ratio** — never let the op default to 1:1. Pick from the use case (cinematic → 16:9, mobile vertical → 9:16, square feed → 1:1).
- **Count** — explicit. Don't generate 4 when 1 will tell you if the prompt works.

If the aspect ratio cannot be inferred from the intended delivery, ask. A missing resolution uses the model default; it does not require another question.

### 2. Announce in credits, plainly, before spending

Slates bills abstract **credits** (they never expire). Announce the credit total the estimate returns — never dollars.

Format: `About to spend N credits on M image(s) at [resolution] [aspect ratio]. Proceed?`

Examples:
- `About to spend 4 credits on 1 image at 1k 16:9. Proceed?`
- `About to spend 24 credits on 4 images at 2k 9:16 (variants). Proceed?`

Follow the user's and host's generation approval policy before spending. A cost estimate or a small charge does not override a required prompt approval. An approved enumerated batch covers its calls; added calls or changed inputs need the confirmation described below. The code's separate confirm threshold is:

<!-- @inject:thresholds -->
<!-- GENERATED from @slatesvideo/shared — do not edit between the markers.
     Source: CONFIRM_CREDITS, DEVIATION_FACTOR and the audio bounds in
     packages/shared/src/operations/index.ts. Every number here is REFUSED by an
     op when a prompt gets it wrong, which is why none of them is typed by hand
     any more: this block replaced four claims that contradicted the code. -->

**The thresholds, from the code that enforces them:**

- **Confirm gate:** above **17 credits** an op returns `requires_confirm` and will not
  proceed until you re-call with `confirm: true`. This is a code gate, not permission to spend: every generation still needs the user-approved plan or quote.
- **Deviation pause:** the desktop Studio Agent stops and re-asks when projected generation spend
  exceeds the approved plan by more than **20%**. You do not trigger this; the app does.
- **Seed Audio duration:** **3–120 seconds.** There is no duration
  parameter on the model — the number you pass is written into the prompt AND is what the user is
  billed. Outside that range the op refuses rather than clamping.
- **Sound Effects duration:** **1–22 seconds**, billed per second, never left for the
  model to pick.

Never quote a credit figure from memory: `slates_estimate_generation_cost` returns the real one.
<!-- @end:thresholds -->

### 3. Aggregate batches into ONE upfront announcement

If you're planning a multi-call workflow (5 storyboard frames, 3 character variants, a grid of options), **announce the total before the first call**, not five small announcements after the fact.

Format: `Plan: N generations totaling C credits. [Brief description of the sequence.] Proceed with the batch?`

Example: `Plan: 6 frame generations at 1k 16:9 totaling 24 credits — establishing wide, push-in, two-shot, reverse, OTS, insert. Proceed?`

### 3b. Batch authorization — one approval covers the enumerated batch

When the user approves a batch plan with one aggregated cost total up front ("8 scenes, ~$X total — go"), that single approval authorizes `confirm=true` on **each enumerated call in that batch** — and nothing beyond it. You do not need to re-ask per call; that's the point of the upfront announcement. Hands-off multi-scene runs depend on this.

Boundaries that re-trigger confirmation:

- Any call's actual estimate exceeds what the announced plan implied → stop, surface the delta, get a fresh OK. The app enforces its own ceiling on top of this (see the thresholds above); do not wait for it to catch you.
- New calls are added that weren't in the enumerated plan (extra variants, retries beyond the plan, a new scene) → those are NOT covered. Announce and confirm separately.
- The batch scope changes (different model, resolution, or duration than announced) → re-announce, re-confirm.

One approval = that plan, as enumerated, at those prices. Nothing else.

### 4. Track the running total

After each generation completes, the response includes `cost_credits` (when available). Keep a running tally in your context. Surface it every 3 generations or whenever the user asks "how much have we spent?"

## Resolution decision rules

Use the model defaults below for ordinary work. For cheap exploration, choose a supported lower setting and compare the quote. For final delivery, use the size the output needs. When comparing prompts, hold model, quality, size and references constant.

<!-- @inject:image-defaults -->
**Image default:** gpt-image-2-5-sunburst, quality `high`, 3k. User overrides take priority. Without a project, generation uses the headless Nano Banana 2 seat.

| Model | Default resolution |
|---|---|
| nano-banana-2 | 2k |
| nano-banana-2-lite | 1k |
| nano-banana-pro | 2k |
| gpt-image-2-5-flare | 2k |
| gpt-image-2-5-sunburst | 3k |
| flux-2-max | 1k |
| seedream-5-lite | 2k |
<!-- @end:image-defaults -->

**4K VIDEO is Pro-only (2026-07-07).** The ladder above is for IMAGES (open at every tier). For VIDEO, where the selected model supports 4K, it requires a Slates Pro account; a base-tier 4K video gen is rejected server-side with `PRO_REQUIRED`. Default video to 1080p or lower and only reach for 4K when the user is on Pro and explicitly asks. 4K *images* are never gated.

## Aspect ratio decision rules

Ask the user when ambiguous. Otherwise:

| Context cue | Aspect ratio |
|---|---|
| "cinematic", "film", "movie", "wide" | 16:9 |
| "TikTok", "Reels", "Story", "mobile vertical", "phone" | 9:16 |
| "square", "Instagram feed", "thumbnail" | 1:1 |
| "ultra-wide", "anamorphic", "cinemascope" | 21:9 if supported; otherwise 16:9 |
| "portrait", "magazine cover", "vertical" | 3:4 |
| "landscape photo", "horizontal" | 4:3 |

Pick a ratio the chosen model accepts; check its `aspectRatio` options before submitting.

If the user prompt mixes signals (e.g. "cinematic Instagram post"), ask. Don't guess.

## When the gate fires

The server returns `requires_clarification` when required composition inputs are missing, and `requires_confirm` when total spend crosses the gate above. In both cases:

1. Surface the gate response to the user
2. Get a clean answer
3. Re-call with the explicit values + `confirm: true` if applicable

Don't bypass the gate by silently filling in defaults. The gates exist because defaults waste money.

## Video is slow + async — a timeout is NOT a failure

Video gens take minutes (Seedance 4K can run far longer). A client/CLI timeout or a slow, empty-looking response is **not** a failed generation — the job is still running on the provider.

- **Never re-submit a video gen because it "timed out."** That double-charges the user for one video. Re-rolling a slow gen is the single most expensive mistake here.
- **Poll, don't re-roll.** Use `background: true` on `slates_generate_video`, then poll `slates_get_generation_status` (free, read-only) until it reports `completed` or `failed`. In-flight jobs survive app restarts and are recovered.
- A gen has only failed when the status comes back `failed` — and a provider *rejection* **refunds** the credits, so failed isolation tests are ~free. Until you see a terminal status, the job is in flight. Wait.

## 🔴 The still-gate — the most expensive mistake in the pipeline

<!-- @inject:still-gate -->
**Inspect a start frame before animating it.** Repair a visible defect that would make the intended crop or performance unusable before spending on motion. A clean frame can be animated whenever the brief calls for movement; this check does not require an image stage for text-to-video.

This is a cost rule as well as craft: a premium video call can cost many times an image correction. Broken geometry can turn to mush, oily textures can crawl and malformed objects can fall apart in motion. Fix a known source defect at the source instead of buying a more expensive copy. Judge intentional stylisation against the brief, not a universal photoreal standard. Additional image or video requests still follow the existing generation authorization.
<!-- @end:still-gate -->

The check itself lives in `slates-vision-feedback-loop` (the five slop tells and the per-model accents). The **stop** is a cost rule and belongs here: before every image→video call, confirm the source frame passed the still scan. If it didn't, spending video credits on it is not iteration; it is buying a more expensive copy of a defect you already found.

<!-- @inject:iteration-diagnosis -->
## Diagnose repeated failures

After three failed attempts at the same requirement, pause unchanged re-rolls and diagnose the source reference, prompt structure, model fit and tool result. Three is a review checkpoint, not a universal limit or proof that the seed cannot matter. Preserve the attempts and name what each test changed.

Continue autonomously when the brief is clear, a specific correction is supported and the next request is already authorized. Hand control back when taste or intent cannot be inferred, the next request needs fresh consent, or the available tool cannot meet the requirement. A failed roll never authorizes an additional charge. Follow the existing batch and per-request cost policy.
<!-- @end:iteration-diagnosis -->
