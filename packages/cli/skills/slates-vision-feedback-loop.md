---
name: slates-vision-feedback-loop
description: Lower-level utility skill for any Slates workflow that needs to "generate, look at the result, refine, regenerate." Defines the standard inline-vision pattern. Other Slates skills compose this. Use when generating images and you need to confirm they match the brief before moving on, or when the user asks to "iterate" on an image.
---

# Vision feedback loop — Slates utility skill

Slates returns generated images inline as base64. You see the actual pixels. Use that — don't trust prompt-following blindly.

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
- **Use `slates_edit_image`** (when available) for surgical tweaks instead of full regeneration when 90% of the image is right.

## Cost discipline

- Track total credits spent across the loop. Surface to the user every 3 iterations.
- Stop after 3 failed iterations on the same prompt — escalate to the user with what you tried and what's not working. The slot machine never converges.
- For high-cost generations (`> $0.50`), confirm before *every* attempt, not just the first.

## When to break the loop

- The user said "good enough" or "ship it." Stop iterating.
- You've burned >5 generations on one frame. Hand back and ask.
- The user changes brief mid-loop. Treat it as a new brief, not a continuation.

## Voice when narrating to the user

Tight, observational, no editorializing.
- ✅ "Frame 2 has the wrong lighting direction — back-lit instead of side. Regenerating with side light."
- ❌ "I notice that the lighting in frame 2 isn't quite what we were going for. I'll go ahead and try again with a different approach."
