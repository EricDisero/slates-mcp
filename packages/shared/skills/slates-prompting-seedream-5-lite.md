---
name: slates-prompting-seedream-5-lite
description: How to prompt Seedream 5 Lite (ByteDance image model — the cheap volume option in Slates). Read before calling slates_generate_image with model seedream-5-lite, or slates_edit_image with editModel seedream-5-lite. Seedream front-loads attention, likes 30-100 focused words, and takes quoted strings for in-image text.
---

# Seedream 5 Lite — prompting

ByteDance's Seedream image model, Lite tier, routed via fal.ai. In Slates: `slates_generate_image` with `model: seedream-5-lite` (REQUIRES projectId — no headless path). **Flat-priced regardless of resolution** — the cheapest image model in Slates, which makes it the right default for high-volume drafting, storyboard exploration, and variant grids. Call `slates_estimate_generation_cost` for the current number; never quote prices from memory. Less censored than Nano Banana 2.

**When to pick it:** lots of frames cheap (storyboard passes, 3-4 variant exploration), posters/layouts with text, quick look-dev. Step up to NB2 or FLUX.2 Max for the locked hero shot.

## Core structure — five components, most important first

```
Subject + Style + Composition + Lighting/Atmosphere + Technical parameters
```

Seedream weights concepts mentioned **earlier in the prompt** more heavily. Lead with the subject; close with camera/technical details.

**Length sweet spot: 30-100 words.** Unlike models that reward verbosity, Seedream gets confused by very long prompts. Focused beats exhaustive.

## Style, composition, lighting vocabulary it responds to

- **Style:** portrait photography, macro photography, cinematic, photorealistic, minimalist, oil painting, watercolor, digital art
- **Composition:** symmetrical composition, rule of thirds, foreground detail with blurred background, wide-angle view, overhead perspective, medium shot, close-up
- **Lighting:** golden hour lighting, dramatic side lighting, soft diffused light, moody low-key lighting, bright high-key lighting
- **Technical:** shot on 85mm lens, shallow depth of field, high resolution

## Worked examples

**Portrait:**
> "Professional headshot of a female CEO with short blonde hair, confident expression, wearing a navy blue suit, neutral office background, studio lighting, shallow depth of field, high-end corporate photography style"

**Product:**
> "Modern smartphone floating in space, dark background with subtle blue gradient, product photography, studio lighting highlighting the glossy screen, ultra-detailed, commercial quality, photorealistic rendering"

## In-image text: double-quote it

Put the exact string in double quotation marks — Seedream treats quoted text as render-this-verbatim:

```
A minimalist poster with the headline "SUMMER SALE" in bold sans-serif, centered
```

Seedream is one of the stronger models for layout-heavy work (posters, mockups, diagrams): call out the layout explicitly — "centered headline, subtitle beneath, clean margins."

## Edits: change one thing, lock the rest

Via `slates_edit_image` with `editModel: seedream-5-lite`. Seedream edits respond well to instructions that name the change AND the preserved elements:

```
Change the bag to brown leather. Keep the person's face, pose, and the room unchanged.
```

Note: Seedream edits in Slates ignore extra `referenceAssetIds` — that path is Nano Banana 2 only.

## Common failure modes + fixes

| Failure | Fix |
|---|---|
| Subject inconsistent / mutates | Put the subject description first; break complex subjects into clear components |
| Style drift | Reinforce the aesthetic with 2-3 related terms ("cinematic, photorealistic, shallow depth of field") |
| Compositional confusion | Use photography terms ("medium shot," "overhead view"); simplify the scene |
| Garbled text | Double-quote the exact string; keep it short; state placement |
| Mushy long-prompt output | Cut to under 100 words — Seedream rewards focus, not volume |

## Iterate cheap, lock expensive

Flat pricing makes Seedream the iterate-fast model: run the 3-strike loop here (draft → evaluate inline → one specific delta → regenerate), and only re-render the winning composition on a pricier model if the project's hero shot demands it. Cost rules live in `slates-cost-discipline` — the batch-authorization pattern applies when generating variant grids.

## Sources

- [fal.ai — Seedream Prompt Guide](https://fal.ai/learn/devs/seedream-v4-5-prompt-guide)
- [BytePlus ModelArk — Seedream Prompt Guide](https://docs.byteplus.com/en/docs/ModelArk/1829186)
