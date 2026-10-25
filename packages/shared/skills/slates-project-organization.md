---
name: slates-project-organization
description: "Organize a Slates project: asset codes (IMG-A12, VID-V3), folders, favorites, pins, Library references and templates. Use when locating media, moving or copying it between projects, reusing a production or keeping a project legible."
---

# Organizing a Slates project

<!-- @operative:start -->
**Operative summary.**
- Keep reusable references in the Library, not in folders, and file work product into folders as you make it. (§ Asset codes — the shared vocabulary (IMG-A12 / VID-V3 / AUD-S1))
- Name assets to the user by code plus label, never by UUID or description. (§ Asset codes — the shared vocabulary (IMG-A12 / VID-V3 / AUD-S1))
- Resolve a code the user names with `slates_list_assets` and confirm it back in the same vocabulary. (§ Asset codes — the shared vocabulary (IMG-A12 / VID-V3 / AUD-S1))
- Read codes again after moving or copying to another project, since new codes are issued there. (§ Asset codes — the shared vocabulary (IMG-A12 / VID-V3 / AUD-S1))
<!-- @operative:end -->

Slates already gives every reusable reference a home: the **Library**, in categories the user names (Characters, Locations, Products, Looks…; `slates_list_library`), each item used in a prompt as `@name`, or `#name` for a look. Keep references there rather than in folders, and add a category only when the user asks for one. Add an item with `slates_create_library_item` and read its `mention` from the result (a taken name comes back suffixed). `slates_update_library_item` renames or moves an item and rewrites every Shot that cites it.

**Folders hold work product by where it sits in the film.** Create with `slates_create_folder`; file assets with `slates_move_assets_to_folder` (`folderId: null` is the project root). Creating a folder does not open it: to file a batch as it is made, pass `folderId` on each generate or upload call; with none, results follow the folder open in the user's window. Folder, favorite and export tools take asset UUIDs, so resolve a code with `slates_list_assets` first. `slates_delete_folder` leaves its files in Media.

A favorite is a keeper, not a folder: `slates_set_asset_favorite` marks one asset (the heart on its card, `isFavorite` in `slates_list_assets`) without moving it. Use it to flag the takes worth a second look, and file them once the pick is made. Pins keep a picture one click from the prompt without moving it (`slates_pin_references`, `slates_list_pins`); a pin attaches nothing to a generation until you pass the picture as a reference.

To hand files out of Slates, `slates_export_assets` copies the originals of the assets you name into a directory (named by code, never overwriting): the way to deliver an image-only job that never needed a shot or a timeline.

To send media to another project, `slates_copy_assets_to_project` duplicates it and `slates_move_assets_to_project` re-homes it; either way it lands in no folder there with new codes. A move is refused while a Library item or a board shot still uses the picture: copy it instead, or bring the whole item with `slates_move_entity_to_project` (`slates_copy_library_item_to_project` copies one).

To reuse a whole piece rather than one reference, use a TEMPLATE: `slates_export_template` saves a board, a scene or one Shot (recipes, script words, references and the Library items they mention; never takes) as a file, `slates_get_template` reads what a file holds and its swap slots, and `slates_import_template` adds it to a project, optionally swapping a slot for one of that project's own assets. With no path, `slates_get_template` lists the saved templates. An import generates nothing: price the new Shots with `slates_get_board_quote` and fire them only after the user approves the price.

Conventions by project type:
- **Short film / narrative:** `Shots` (scene stills) · `Clips` (generated video) · `Final` (the export). Use one folder per scene (`Scene 1`, `Scene 2`, …) instead when the piece has distinct locations/beats.
- **Ad / UGC:** `Hooks` · `B-roll` · `Talking-head` · `Final`.

Rules of thumb:
- Scene stills, clips, and the final cut → file into the structural folder they belong to, as you make them.
- One folder per asset (folders are structure). Cross-cutting status (hero take, reject, variant) is a favorite or a label (`slates_update_asset`), not a folder.
- Keep the gallery legible: work product lives in folders; the reference scaffolding (sheets, plates, style images) stays in the Library.

## Asset codes — the shared vocabulary (IMG-A12 / VID-V3 / AUD-S1)

Every asset gets a short, stable code the moment it lands in a project, and the user sees it as the badge in the **top-left corner of every image and video card** in the gallery. This is the shared vocabulary between you and the user — it exists so neither of you ever has to quote a UUID.

**The scheme:**
- `IMG-A{n}` = images · `VID-V{n}` = videos · `AUD-S{n}` = audio.
- Numbering is **per project, per type** and counts up from 1; deleting IMG-A12 renumbers nothing. A move or copy to another project issues new codes there, so read codes again in the destination.
- Each asset also carries a **label**: the first ~4 meaningful words of its prompt, title-cased. Chat format is code + label: `IMG-A12 — Beach Sunset`.

**How to use it:**
- **User names a code** ("use IMG-A36 as the reference", "animate VID-V3's last frame") → resolve it via `slates_list_assets` (match the `code` field) to get the assetId, confirm back in the same vocabulary: "Got it — IMG-A36 — Marcus Rooftop Close-Up as the first frame."
- **You name assets** → code + label, never UUID, never "the beach one" (which of three?). The user matches your words to the badge by eye.
- **User seems confused** about what a code is or how to point you at an image → explain it in one line: "Every image and video in your gallery has a code badge in its top-left corner — like IMG-A36. Just say that code and I'll know exactly which one you mean."
- **Ambiguity** ("the sunset image" when several exist) → pull candidates with `slates_get_assets_batch` and offer the codes: "I see IMG-A12, IMG-A19, and IMG-A24 with sunsets — which one?"
