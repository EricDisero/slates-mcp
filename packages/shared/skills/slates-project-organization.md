---
name: slates-project-organization
description: How a Slates project's assets are organized AND named — the asset short-code system (IMG-A12 / VID-V3 / AUD-S1 badges on every gallery card), folders for film STRUCTURE, the typed tabs for reusable references. Read when the user refers to an asset by code, asks what a code like IMG-A36 means, or when organizing/navigating a project.
---

# Organizing a Slates project

Slates already gives each REUSABLE reference type its own home — the **Characters**, **Environments**, and **Styles** tabs, each with its own generation + `@mention`/`#ref` behavior. Do NOT recreate those as folders. Folders are for **structure**, never type.

**Folders = where an asset sits in the FILM**, and they mirror to real subfolders on disk (`projects/<id>/…`), so a human can open the project in Resolve/Finder and navigate it like an edit. Use them for work product, not references.

Create with `slates_create_folder`; file assets with `slates_move_assets_to_folder`. Generations land in the project's active folder, so set it before a batch.

Conventions by project type:
- **Short film / narrative:** `Shots` (scene stills) · `Clips` (generated video) · `Final` (the export). Use one folder per scene (`Scene 1`, `Scene 2`, …) instead when the piece has distinct locations/beats.
- **Ad / UGC:** `Hooks` · `B-roll` · `Talking-head` · `Final`.

Rules of thumb:
- Reusable cast / sets / look → leave in the Characters/Environments/Styles tabs. Don't fold them.
- Scene stills, clips, and the final cut → file into the structural folder they belong to, as you make them.
- One folder per asset (folders are structure). Cross-cutting status (hero take, reject, variant) is a tag concern, not a folder.
- Keep the gallery legible: work product lives in folders; the reference scaffolding (sheets, plates, style images) stays in its tabs.

## Asset codes — the shared vocabulary (IMG-A12 / VID-V3 / AUD-S1)

Every asset gets a short, stable code the moment it lands in a project, and the user sees it as the badge in the **top-left corner of every image and video card** in the gallery. This is the shared vocabulary between you and the user — it exists so neither of you ever has to quote a UUID.

**The scheme:**
- `IMG-A{n}` = images · `VID-V{n}` = videos · `AUD-S{n}` = audio.
- Numbering is **per project, per type**, counts up from 1, and **numbers are never reused** — deleting IMG-A12 doesn't renumber anything, so a code always means the same asset forever.
- Each asset also carries a **label**: the first ~4 meaningful words of its prompt, title-cased. Chat format is code + label: `IMG-A12 — Beach Sunset`.

**How to use it:**
- **User names a code** ("use IMG-A36 as the reference", "animate VID-V3's last frame") → resolve it via `slates_list_assets` (match the `code` field) to get the assetId, confirm back in the same vocabulary: "Got it — IMG-A36 — Marcus Rooftop Close-Up as the first frame."
- **You name assets** → ALWAYS code + label, never UUID, never "the beach one" (which of three?). The user matches your words to the badge by eye.
- **User seems confused** about what a code is or how to point you at an image → explain it in one line: "Every image and video in your gallery has a code badge in its top-left corner — like IMG-A36. Just say that code and I'll know exactly which one you mean."
- **Ambiguity** ("the sunset image" when several exist) → pull candidates with `slates_get_assets_batch` and offer the codes: "I see IMG-A12, IMG-A19, and IMG-A24 with sunsets — which one?"
