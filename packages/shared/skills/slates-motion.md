---
name: slates-motion
description: "Put HTML motion layers on a cut (lower thirds, end cards, animated captions, titles, plates) from the motion block library or your own composition, checked first."
---

# Motion layers on a cut

<!-- @operative:start -->
**Operative summary.**
- Add a layer only to show what the voiceover cannot say, keep layers few, and build them last. (§ Show what the words cannot)
- Search `slates_list_motion_blocks` first and place a match with `slates_add_html_clip` using `block` and `variables`; write your own composition only when no block fits. (§ Start from the registry)
- Put a transparent foreground and an opaque plate on separate overlay tracks, the plate below. (§ Foreground and plate on separate tracks)
- Run `slates_check_composition` while drafting, fix every error with `slates_update_html_clip`, and read every warning; redesign a layer when the same finding survives two fixes. (§ Check before a layer lands)
- Make every layer start and end fully transparent, animate every element in and out, fit all text, and avoid `backdrop-filter`. (§ What holds in every layer)
- Retrieve the motion engine's writing guides with `slates_get_prompting_guide`. (§ The motion engine's guides)
<!-- @operative:end -->

An HTML clip is a composition, an HTML document with a GSAP timeline registered on `window.__timelines`, drawn on an overlay track in preview and export. Slates places, checks and draws it, and the motion engine's own guides teach how to write one (the last section names them). Layers are free: nothing here spends credits.

## Show what the words cannot

The viewer already hears the voiceover. A layer earns its place by showing something they could not hear: the mechanism working, the product doing the thing, a number made visible, a before and after. The spoken line set in big type is punctuation, not storytelling. Keep it to a handful in a piece and build it last, after the layers that carry the story.

A layer that fills the frame during a run of quick cuts also hides them, which is what lets a single-camera talking head take many edits.

## Start from the registry

Captions, end cards and lower thirds come from the registry. `slates_list_motion_blocks` searches it ("lower third", "end card", "kinetic caption"); the list is the registry at the version Slates runs, so every item in it draws. `slates_add_html_clip` with `block` and its `variables` places one. Variables are text, numbers or true/false, and `slates_update_html_clip` changes them later (`null` clears them).

Write your own composition only when no block fits. Passing `html` with `block` replaces the block's document and keeps its files, which is how to restyle a block without rebuilding its assets.

Read `slates_get_timeline` first for the frame rate and where clips sit: `startFrame` and `endFrame` are timeline frames, or give `durationSec`; without either, the clip runs as long as the composition or block declares.

## Foreground and plate on separate tracks

A transparent foreground (a lower third, a caption layer, a callout) and an opaque background plate never share a composition or a track. Apart, each can be retimed, swapped or hidden on its own, and the plate can never cover the captions. Give each its own overlay track (`slates_add_timeline_track` with type overlay, then `trackId`), the plate below the foreground. A composition's page is transparent unless its own CSS paints a background, so a foreground composition paints none.

## Check before a layer lands

`slates_check_composition` runs Slates' composition check, plus what Slates' sandbox refuses, and writes nothing: run it while drafting. `slates_add_html_clip` and `slates_update_html_clip` run it again and return the findings. Fix every error with `slates_update_html_clip` before moving on, and read every warning. The sandbox loads GSAP from jsDelivr and fonts from Google Fonts and refuses any other remote URL, so a picture goes in a block's own files or inline.

When the same finding survives two fixes, revert and redesign the layer rather than piling on a third.

## What holds in every layer

- **In and out.** The first and last frames are fully transparent and every element animates in and out, so nothing pops on a cut. Ease into the landed state and accelerate away from it, in the same family both ways: a fade and scale in leaves with a fade and scale.
- **Nothing flashes on frame zero.** Hide elements with a synchronous set when the script loads, not with a step at zero inside the timeline, and register the timeline only once it is built.
- **Text fits.** Measure each text box against the canvas edge and against every other element, at every frame. Fit variable text after the fonts load, since the fallback font measures differently. Let lines wrap by width, never with `<br>`. Heavy gradient text needs a little right padding, or its last letter clips.
- **Short.** A callout runs a few seconds and a hero layer under about fifteen. A long beat splits into two or three layers styled alike; a spoken list becomes one short card per item, every card identical but for its content.
- **No glass.** `backdrop-filter` and faux blur draw nothing over a transparent layer. Build depth from gradients, shadows and transforms, and try any uncertain CSS in a ten-second test layer before a real one.
- **Transforms.** A GSAP scale or move replaces a CSS `translate` used for centering, so the element jumps; centre animated elements through GSAP's percentage offsets instead.
- **Loops end.** A repeating animation stops before the composition does.

Captions on speech come from `slates_add_captions` (`slates-captions`); its `component` draws them with a caption component as one HTML clip, the only captions that draw emphasis tiers.

## The motion engine's guides

Retrieve each with `slates_get_prompting_guide` and its name below as the topic. They were written for the motion engine's own CLI and Studio: topic `motion/SLATES-MAPPING.md` says what each of their commands and Studio surfaces is in Slates, and the CLI is never run.

- `motion-core`: the composition contract, its timing attributes, variables and render rules.
- `motion-animation`: motion rules, scene blueprints and transitions.
- `motion-registry`: blocks and components, and wiring them in.
- `motion-graphics`: kinetic type, stat count-ups, logo stings, lower thirds and callouts.
- `talking-head-recut`: overlay cards timed to a transcript on interview footage.
- `embedded-captions`: caption looks from its style catalog; its captions set behind the subject need matting, which Slates lacks (the mapping lists it).
- `motion-creative`: palettes, typography and composition patterns.
- `product-launch-video` and `faceless-explainer`: whole pieces built from layers.
