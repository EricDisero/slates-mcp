---
name: slates-ad-variants
description: "One ad into many: hook, body and end-card slots, the grid of combinations, one export."
---

# Ad variants: one body, many hooks, every format

<!-- @operative:start -->
**Operative summary.**
- Vary the hook on one proven body: each hook a whole opening of its own (picture, words, idea), cloned from a winning hook, never a word-swap; a test across ideas needs different references, not more hooks. (§ Which variants to make)
- Build the slots from clips already on the cut with `slates_edit_variant_slots`: the body once, then each hook and the end card; check the order with `slates_get_variants`. (§ Set up the slots)
- Read the grid before exporting and tell the user the count, variants times formats; quote any missing takes and never fill one from the grid. (§ Read the grid)
- Export every file in one `slates_export_cuts` request (`version: 2`, a new `batchId`, the same pick the grid read) and poll `slates_get_export_batch`. (§ Export every file in one request)
- Every variant is an ordinary cut afterwards; a hand edit holds until a rebuild, and seams are set per variant. (§ After the export)
- Each hook keeps the truth rules: no invented claim, and no price of theirs or a competitor's until the user gives it. (§ The truth rules) <!-- src: brain craft eval, a variants hook invented a coffee-shop price to compare against, 2026-10-25 -->
<!-- @operative:end -->

An ad variant is one alternative per slot laid end to end over the cut's bed (its own music and sound). The body exists once, so a fix to it shows in every variant. Nothing here generates or spends: a take the grid says is missing is shown with its price, and made only on its Shot, with the user's yes, like any other generation.

## Which variants to make

- **Hooks on one body.** Most viewers see only the opening, so the hook is what a variant tests. Keep the body that works and vary the opening, and tell the user what each hook tests (its opening picture, its claim, its emotion), so the result reads as an answer. <!-- src: brain craft eval, five hooks planned with nothing said about what each tests, 2026-10-25 -->
- **Each hook is a whole composition** (`slates-direct-response-ad` § 3. Write the script); one that only changes the text tests nothing. Clone each one from a hook that is winning now, the way the body was cloned (`slates-direct-response-ad` § 1. Find the winner). <!-- src: brain lint, one home per lesson, 2026-10-25 -->
- **Each hook works alone and flows into the body.** Read every join aloud.
- **Different ideas need different ads.** Hooks on one body test openings within one idea; testing ideas against each other takes different reference ads, each its own cut.
- **Formats cost nothing to add.** Every aspect comes from the same takes at export.

## The truth rules

<!-- @inject:ad-truth-rules -->
- Every claim is literally true of the user's product: no invented guarantee, statistic, result or offer term, and no claim read off a reference picture.
- Never suggest a price, discount or offer, theirs or a competitor's, even as an example ("say, about four dollars a can"): ask for theirs and leave a bracket in the line until they give it, because an example figure ends up in the ad. <!-- src: brain craft eval, dr-copy offered example prices while asking for the real one, 2026-10-25; a variants hook invented a coffee-shop price, 2026-10-25 -->
- No fabricated testimonials or reviews. An AI person may present the product and say what it is; it never says or implies that it bought or used the product or got a result from it. Fake and AI-generated testimonials are banned outright in the United States (the FTC's rule on fake reviews, 16 CFR Part 465). Keep the reference's beat and give the line to someone who can say it truthfully, or turn it into a fact about the product.
- A real person's likeness, a brand or a logo follows `slates-content-policy`.
<!-- @end:ad-truth-rules -->

## Set up the slots

1. Read the cut with `slates_get_timeline` for its clip ids.
2. Make each slot from the clips already on the cut with `slates_edit_variant_slots`, `action: "add-alternative"`:
   - the body: `slotName: "Body"`, `name`, `clipIds` (its linked sound comes with it; what stays on the cut is the bed, anchored where the body sat);
   - the first hook and the end card the same way, with their own `slotName`;
   - each further hook: `slotId` of the hook slot, and `clipIds` of clips on the cut, or `sequenceId` of a timeline that already holds it, or neither, then fill the empty sequence with `slates_add_clip_to_timeline`.
3. Read `slates_get_variants` and check the slot order (hook, body, end card). Move one with `action: "update"` and `orderIndex`. Slot names are names, never types: any slots work, and a cut can have only two.

## Read the grid

`slates_get_variants` with `grid` crosses the picked alternatives of each slot with the picked delivery formats:

- `grid: {}` takes every alternative, in the cut's own formats.
- `grid.picks`: slot id to the alternative ids to use; a slot left out takes all of them.
- `grid.aspects`: format ids from the grid's `formats` (each with its size).

It returns `combinations` (each with its `name`, and `variantId` and `cutId`, null until a row exists), `files` (combinations × formats) and `missingTakes`. Tell the user the count before exporting: "10 variants × 4 formats = 40 files". When `missingTakes.shotIds` is not empty, quote `credits`, what making them bills in all (`costs` is the same in dollars per take request; null means unpriceable), and say which takes they are; never fill one from the grid.

## Export every file in one request

`slates_export_cuts` with `version: 2`, a new `batchId`, `items: []` and `variants: { timelineId, picks, aspects }` (the same pick the grid read). It adds a variant row for each combination that lacks one, then exports every variant in every format, each file named for the ad. Poll `slates_get_export_batch` with the `batchId`. The same `batchId` and pick reattaches or retries; finished files are never overwritten.

An output whose picture is cut at a seam carries `segments`: the picture is joined from parts rendered once per format, so a shared body renders once, and the same pick exported again renders nothing new. `fallback` says why a file rendered whole. The sound is always mixed whole, seams included, so it matches a single export.

## After the export

Every variant is an ordinary timeline (`cutId`): open it with `slates_get_timeline` and change it like any cut. A variant edited by hand stays as edited until `slates_edit_variants` `action: "rebuild"`. Seams (J-cut, L-cut, crossfade) are set per variant with `slates_edit_variants` `action: "update"` and `seams`; a seam change moves only sound, so the cached picture parts still apply.
