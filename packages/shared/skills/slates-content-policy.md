---
name: slates-content-policy
description: Content-policy-safe construction — build any scene safe from the first word so it hits full cinematic impact without depicting prohibited content (and without getting silently rejected or degraded by the model's filter). Read this before writing any prompt that involves conflict, creatures, crowds, destruction, weapons, or young characters. Mirror of @slatesvideo/shared/prompts content-policy fragment — SSOT: second-brain business/projects/slates/product/prompting-ssot.md.
---

# Content-policy-safe construction — read before any risk-surface prompt

Don't depict the harm — depict the energy, the aftermath, the threat, or the scale. Build the scene safe from the first word.

Write scenes that hit full cinematic impact without ever *needing* to depict prohibited content. This is a craft move, not a compromise — the substitutions below usually read as more cinematic, not less, and they keep your generation from getting silently rejected or degraded by the model's filter. A standoff is more tense than a massacre; an evacuated city is eerier than a crowd in panic; a roar lands harder than a kill. Load this whenever a prompt involves conflict, creatures, crowds, destruction, weapons, or young characters.

## Substitution table

| Avoid | Use instead |
|---|---|
| Civilians in panic, crowds fleeing under debris | An evacuated / empty city; abandoned streets; a lone figure for scale |
| Weapons firing into buildings or at people | Energy-discharge standoffs, searchlights sweeping, charged auras, shockwaves with no muzzle fire |
| Creatures tearing into each other, gore | A grapple / standoff — roars, near-misses, circling, an energy clash; combat that stays contained (in/on the water, never lifting into the air) |
| Destruction with people in harm's way | Destruction in uninhabited terrain — glaciers, deserts, ruins, open sea, evacuated zones |
| Realistic guns as the focus | Stylized / fantasy implements, weapons slung-not-fired, the weapon as silhouette or prop only |
| Blood, wounds, death | Impact light, dust, debris, buckling and collapse, a silhouette dropping out of frame |
| Real, named public figures | Original / anonymous characters |
| Real brand logos | Original or generalized branding — except the user's own product, which is the whole point of a brand film |

## The safe benchmark

When a scene starts drifting risky, pull it back toward this shape: **one original creature, in a generalized monument or amphitheatre, in daylight, no weapons present, performing expressive action** (rising, roaring, spreading wings). Original design, generalized location, daylight, expressive rather than violent. That's the confirmed-safe envelope — most epic ideas re-stage into it without losing the punch.

## Containment rule — it doubles as a physics win

Give any creature or combat scene a **containment rule** that grounds the physics at the same time:
- "the fight STAYS at the sea surface — they breach, dive, grapple, submerge, but never fly or get carried into the air"
- "boss scale locked ~2.5 human-heights, NOT kaiju-giant"
- "destruction stays in the evacuated valley"

This improves coherence (the model isn't inventing absurd escalation) AND keeps the scene inside policy — same clause buys both.

## Scale and stakes without harm

Epic stakes come from environmental danger and reaction, not depicted victims: tiny figures diving clear of *collapsing* terrain (not being crushed), a war-horn over an *empty* field, an army *scrambling* across a frozen valley as a titan tears free of a glacier. The danger is the environment; the figures are reacting, not dying. Snow plumes, glowing runes, splintering ice, shockwaves, and dust carry the chaos.

## Minors — hard rule

Never write romantic, sexual, or suggestive content involving or directed at minors, and never anything that sexualizes a young-presenting character. Any scene with children stays wholesome and age-appropriate. Non-negotiable — it overrides every stylistic goal.

## Pre-flight (run before delivering any risk-surface prompt)

- [ ] No civilians depicted in panic/harm; crowds are evacuated or absent.
- [ ] No weapons firing at people/buildings; threat is energy / searchlight / silhouette.
- [ ] No creature-on-creature or creature-on-person gore; combat is grapple / standoff / roar, contained.
- [ ] Destruction is in uninhabited / evacuated terrain.
- [ ] Creatures are original ("not based on any franchise"); no real public figures; no real brand logos except the user's own product.
- [ ] Anything with children is wholesome and age-appropriate.

If a box fails, apply the substitution table before writing the prompt.

## Editing real footage (Kling O3 edit / Omni Flash edit) — real people in the SOURCE

Video edit takes the user's own footage, which often contains real people. Rules:

- The user must hold rights/consent for any real person's likeness in footage they edit — ask once when it's clearly someone other than the user, then proceed.
- Kling's video-to-video filter behavior on real faces is **not yet verified** (unlike Seedance, where the consent-gated real-face route is confirmed). If an edit of real-person footage is rejected by the provider, do NOT retry-spam variations — tell the user the filter blocked it and offer a no-face crop/segment or an AI-character swap instead.
- **Omni Flash: own-footage editing of the uploader's own face PASSED live 2026-07-09** (real talking-head clip, edited on our fal route) despite Google's documented "recognizable people" restriction — treat that restriction as aimed at third-party/public figures, but expect probabilistic refusals and never promise passage.
- Never use edit to put a real, named public figure into a scene, or to make someone appear to say/do something they didn't. Faceless b-roll (hands, products, landscapes, crowds-from-behind) edits freely.

## Gemini / Omni Flash filter regime (video gen + edit) — receipts 2026-07-09

Google's filter is its own regime (stricter than fal-hosted Kling about harm-to-a-person, looser than BytePlus about faces). Live receipts:

| Blocked (`content_policy_violation`) | Passed |
|---|---|
| "his fingertips **ignite** with a small real flame" (fire ON a body part = harm) | "small **magical** flames appear on his fingertips … vanish when he blows on them" |

- **Harm-to-person framing is the tripwire**, not the effect itself. Reframe body-contact effects as magical / supernatural / harmless VFX: "magical flames", "a glowing aura", "sparks of light dance on". Avoid ignite / burn / on fire / catch fire applied to a person.
- **Never use a real object as a metaphor** — "candle-like flame" rendered a literal candle in the subject's hand. Describe the effect, not an object that resembles it.
- The block is a 422 refund (no credits lost) and arrives mid-generation — one reframe per the substitution mindset above, don't retry-spam.
