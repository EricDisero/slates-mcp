---
name: slates-project-organization
description: How to keep a Slates project's assets organized — folders for film STRUCTURE, the typed tabs for reusable references — so the user and the agent can both navigate it and a human can take over the project manually.
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
