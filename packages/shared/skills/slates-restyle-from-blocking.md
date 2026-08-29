---
name: slates-restyle-from-blocking
description: Render one blocking pass as several different visual worlds — live action, 2.5D painted, 2D ink, toybox — matching cut for cut. Use when a client needs style options, when someone wants to see the same edit in another look, or when an approved edit needs a new treatment without re-blocking.
---

# Restyle — one edit, many worlds

The commercial payoff of the whole previs workflow, and the reason a blocking file is an asset rather than a step.

## The idea

Every prompt has two halves:

- **Structure** — cuts, camera, timing, who is where. Lives in the blocking clip. **Never changes.**
- **Style** — what any of it looks like. Lives in the references and the prompt text. **Changes freely.**

Hold the structure, swap the style, and the same edit comes back as live action, painted 2.5D, ink on paper or a toybox — **matching frame for frame across all of them.** Cuts land on the same frames, the car drifts at the same moment, the same head turns at the same beat.

For anyone pitching work: three visual worlds in a day, off one edit the client has already approved. The foundation is not up for renegotiation, so the conversation is only about look.

## Before you restyle

You need a blocking clip whose structure you are happy with, and a finished prompt for at least one style (per `slates-blocking-to-prompt`). The first style is the expensive one; every later style is an edit of its text.

## What stays fixed

Copy these across every style **verbatim**. Changing them is what desynchronises the outputs:

- The blocking reference's own contract — that it is the master for all movement, the placement-only clause, the tie-break clause, the disambiguation clause
- The shot count and every timestamp
- Every shot's camera position, angle, framing and cut point
- Screen direction and seating
- The `HOLD FOR THE FULL TIMELINE` block
- `videoReferenceAssetIds` and `videoReferenceSecondsEach`

Lead each style's prompt with a lock so the style layer cannot leak into the structure:

> VIDEO LOCK — the dominant rule of this prompt: the reference defines 100% of the motion, editing and object choreography. The text below defines only look, materials, locations and effects layered onto that motion. Wherever the text and the video could be read differently about motion, the video decides.

## What changes

| Layer | What you swap |
|---|---|
| Rendering style | photoreal · painted 2.5D · 2D ink · miniature/toybox |
| Characters | different sheets entirely — a couple, grandparents, a robot and a cat |
| Locations | the same four beats set in a different world |
| Time of day / weather | night after rain · golden hour · hard noon |
| Lighting and colour | per style |
| Audio | SFX-only, or scored, or lip-synced dialogue |

Characters can change species and still land, because the blocking only supplies where a body is and how it moves.

## Dummy mapping — the mechanism that makes it work

Each style needs its own explicit mapping from grey proxy to real object. The proxy is a slot; the style fills it:

> DUMMY MAPPING: the front-LEFT sphere-head dummy (with its grey arm at the shifter and grey leg at the pedals) is THE GRANDPA; the front-RIGHT sphere-head dummy is THE GRANDMA; a front-seat dummy together with its loose blocks is that ONE whole person. Blocks on the rear bench are the luggage. The low-poly flying model in SHOT 18 is THE HELICOPTER. The two vehicles behind the hero car in SHOT 19 are THE POLICE CARS.

Same clause per style, different right-hand side. And restate the placement-only rule in style terms:

> The source defines only placement and motion, never appearance: every placeholder becomes the real object its position implies — spheres are always people, cabin blocks are always cases and bags, fully drawn.

## Location continuity

If the piece travels, name the places and pin each shot to one. Reusing labels across styles keeps the four prompts diffable:

```
LOCATION CONTINUITY — one journey through four fixed places; each looks
identical in every shot where it appears:
  LOC-A <opening>   LOC-B <middle>   LOC-C <turn>   LOC-D <finale>
```

Then tag every beat: `SHOT 9 — 7.79-9.33s — LOCKED, LOC-B: <description>`.

## Style references

A style reference is **not a keyframe**, and saying so prevents the model reproducing its composition as a shot:

> STYLE MASTER — defines the painting and rendering style only: hand-painted look with visible brushstrokes, sculpted painterly volumes, textured matte surfaces, dramatic coloured rim light, deep moody shadows. NOT a keyframe, NOT a location to reproduce, NOT a frame that ever appears in the film. Its own subject, framing and composition are never seen in any shot.

A style can also be **text-only** — no reference image at all. Ink and toybox looks usually specify better in words than they match from a still.

## Keep performance inside the existing shots

Style changes tempt the model to earn new coverage. Refuse it:

> ACTING — inside the existing shots only: performance is visible only at the size and distance the reference already gives it, only where the source already shows a face; everywhere else it reads through posture and hands alone. The performance NEVER earns a new shot, a new angle or a closer framing.

## Text-free worlds

Stylised worlds are where invented signage and garbled lettering appear. One clause kills it:

> TEXT-FREE WORLD: every sign is a blank painted shape, every gauge face carries tick marks only, every licence plate is a blank plate.

## Running it

Generate each style as its own `slates_generate_video` call against the **same** `videoReferenceAssetIds`. Keep them in one project so they sit side by side; name assets by style so the comparison reads at a glance.

Quote the whole set before firing — `slates_estimate_generation_cost` per style — and confirm. Four styles is four generations, not one.

🚨 Never fire a batch of style variants without showing the user the prompts and the total cost first.

## Checklist per style

- [ ] Same blocking asset, same `videoReferenceSecondsEach`
- [ ] VIDEO LOCK leads the prompt
- [ ] Every timestamp and shot count identical to style 1
- [ ] Dummy mapping written for this style's cast
- [ ] Style reference declared as style-only, or none used
- [ ] Location labels reused
- [ ] Acting-inside-existing-shots clause present
- [ ] HOLD block copied verbatim
- [ ] Cost quoted and confirmed

## Related

`slates-previs-blocking` · `slates-blocking-to-prompt` · `slates-style-prompting` (style vocabulary per model) · `slates-cost-discipline` (batch quoting)
