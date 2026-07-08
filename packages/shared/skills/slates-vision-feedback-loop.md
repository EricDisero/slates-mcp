---
name: slates-vision-feedback-loop
description: Lower-level utility skill for any Slates workflow that needs to "generate, look at the result, refine, regenerate." Defines the standard inline-vision pattern. Other Slates skills compose this. Use when generating images and you need to confirm they match the brief before moving on, or when the user asks to "iterate" on an image.
---

# Vision feedback loop — Slates utility skill

Slates returns generated images inline as base64. You see the actual pixels. Use that — don't trust prompt-following blindly.

## Asset codes are your shared vocabulary with the user

Every asset in Slates has a short stable code (e.g. `IMG-A12`, `VID-V3`, `AUD-S1`) and a label derived from its prompt (e.g. `Beach Sunset`). These are visible in the gallery as a corner badge on each thumbnail. **Always refer to assets by their code in chat** so the user can match what you're saying to a specific card in their gallery.

- ✅ "I'm using **IMG-A12 — Beach Sunset** as the first frame. The second-frame candidate **IMG-A15** has the right composition but warmer light — want me to use that one instead?"
- ❌ "I'm using the beach sunset image..." (user has four beach sunset variants — which one?)
- ❌ "I'm using asset `7a3f9e4b-...`" (UUIDs aren't readable; user can't match to a badge)

The code is the FORMAL reference. The label is human texture. Use both: `IMG-A12 — Beach Sunset`.

## Vision tools at your disposal

- `slates_get_asset_image` — pull one image into context. Returns its code+label.
- `slates_get_assets_batch` — pull up to 8 images in one call. Use when picking from a candidate set; cheaper than N individual fetches.
- `slates_get_asset_video_frames` — extract N keyframes (default 3) from a video and inline them as JPEGs. You can't see video natively; this is how you "look at" a clip before refining its motion prompt.

## Pre-flight is automatic on the gen tools

`slates_generate_video`, `slates_generate_motion_transfer`, and `slates_generate_lip_sync` now show you their reference assets **inline** on the confirm response. You don't need to fetch them yourself — but you DO need to look at what comes back, revise the prompt if the references suggest a different motion/framing, and only then re-call with `confirm=true`.

## The pattern

1. **Generate.** Call `slates_generate_image` with a prompt. The result is in your context as an image content block.
2. **Evaluate against the brief.** What did the user actually want? Are the elements right? Composition? Lighting? Subject identity?
3. **One of three outcomes:**
   - **Right** → save it (bind to a frame, character slot, etc.) and move on.
   - **Close, but adjustable** → refine the prompt with a specific delta ("wider shot", "warmer light", "remove the second figure"), regenerate **once**.
   - **Wrong direction** → ask the user before regenerating. Don't burn credits on prompt-thrashing.

## Refinement rules

- **One specific delta per regeneration.** Don't change five things at once — you won't know what helped.
- **Anchor with references.** If the result drifted from the user's intent, attach the *previous best* generation as a reference image alongside the original brief.
- **Use `slates_get_asset_image`** to pull a previously-generated image back into context if you need to compare against a fresh generation.
- **Use `slates_edit_image`** for surgical tweaks instead of full regeneration when ~90% of the image is right — `sourceAssetId` = the asset, `prompt` = the change only. Edits preserve composition and identity; full regen rolls the dice. Recipe: `slates-edit-and-iterate`.

## Cost discipline

- Track total credits spent across the loop. Surface to the user every 3 iterations.
- Stop after 3 failed iterations on the same prompt — escalate to the user with what you tried and what's not working. The slot machine never converges.
- For high-cost generations (above ~17 credits), confirm before *every* attempt, not just the first.

## When to break the loop

- The user said "good enough" or "ship it." Stop iterating.
- You've burned >5 generations on one frame. Hand back and ask.
- The user changes brief mid-loop. Treat it as a new brief, not a continuation.

## Voice when narrating to the user

Tight, observational, no editorializing.
- ✅ "Frame 2 has the wrong lighting direction — back-lit instead of side. Regenerating with side light."
- ❌ "I notice that the lighting in frame 2 isn't quite what we were going for. I'll go ahead and try again with a different approach."
