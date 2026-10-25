---
name: slates-ad-variants
description: "One ad into many: hook, body and end-card slots, the grid of combinations, one export."
---

# Ad variants: one body, many hooks, every format

An ad variant is one alternative per slot laid end to end over the cut's bed (its own music and sound). The body exists once, so a fix to it shows in every variant. Nothing here generates or spends: a take the grid says is missing is shown with its price, and made only on its Shot, with the user's yes, like any other generation.

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

It returns `combinations` (each with its `name`, and `variantId` and `cutId`, null until a row exists), `files` (combinations × formats) and `missingTakes`. Tell the user the count before exporting: "10 variants × 4 formats = 40 files". When `missingTakes.shotIds` is not empty, quote `costs` (credits per take request; null means unpriceable) and say which takes they are; never fill one from the grid.

## Export every file in one request

`slates_export_cuts` with `version: 2`, a new `batchId`, `items: []` and `variants: { timelineId, picks, aspects }` (the same pick the grid read). It adds a variant row for each combination that lacks one, then exports every variant in every format, each file named for the ad. Poll `slates_get_export_batch` with the `batchId`. The same `batchId` and pick reattaches or retries; finished files are never overwritten.

Each output carries `segments`: the picture is joined from parts rendered once per format, so a shared body renders once, and the same pick exported again renders nothing new. `fallback` says why a file rendered whole. The sound is always mixed whole, seams included, so it matches a single export.

## After the export

Every variant is an ordinary timeline (`cutId`): open it with `slates_get_timeline` and change it like any cut. A variant edited by hand stays as edited until `slates_edit_variants` `action: "rebuild"`. Seams (J-cut, L-cut, crossfade) are set per variant with `slates_edit_variants` `action: "update"` and `seams`; a seam change moves only sound, so the cached picture parts still apply.
