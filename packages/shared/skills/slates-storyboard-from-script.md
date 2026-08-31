---
name: slates-storyboard-from-script
description: Turn a script or treatment into a Slates storyboard with scenes and frames. Use when the user has a script, treatment, shot list, or scene-by-scene description and wants to materialize it as a Slates storyboard, optionally generating frame images per shot.
---

# Storyboard from script — Slates workflow

The user has a script, treatment, or shot list. You're turning it into a Slates storyboard with scene → frame structure, optionally generating images for each frame.

## Workflow

### 1. Parse the script
Read the user's script. Decide:

- **Scene count** — usually 1 scene per location/setting change. Don't fragment into one-frame scenes.
- **Frames per scene** — match the shot list. Default is 3-6 frames per scene unless the script specifies more.
- **Shot labels** — pull them from the script (e.g., "Wide", "Close-up", "Over-the-shoulder").

If the user hasn't named the storyboard, suggest one based on the project tone.

### 2. Materialize the structure first (no generation yet)
- `slates_create_storyboard` with the chosen name.
- For each scene: `slates_add_scene` with a descriptive name and order.
- For each shot: `slates_create_shot` with a *visual-only* prompt, the model, the params, and whatever character / environment / style references the project already holds. **Don't generate yet.**

🚨 **A Shot needs no image, and that is the point.** `slates_add_frame` requires an `assetId`, so before Shots existed there was nowhere to put a planned shot until it had been paid for — the plan lived in chat and the user had to trust your memory of it. A Shot is a row: named, listed, priced, forkable, and readable back COMPOSED with `slates_get_shot` before a single credit is spent. Write the plan as Shots, not as sentences you will have to re-type later.

Surface the planned structure back to the user as a tight summary — `slates_list_shots` gives you the count and the total in one call:
> Storyboard "X" • 4 scenes • 12 shots • 340 credits to fire them all
>   Scene 1: Forest opening (3 shots)
>   Scene 2: Confrontation (4 shots)
>   ...

**Surface a decision log alongside that summary.**

<!-- @inject:decision-log -->
When you surface the plan, include a short **decision log** — one line per decision *you* made that the user did not specify **and that no row already records**:

```
source phrase or declared default → what you wrote → what it resolves
"in a diner"        → chrome-and-vinyl booth, 3/4 on the counter   → fixes the anchor so blocking is repeatable
(no time of day)    → late afternoon, low warm key                 → default; say the word and it changes
(no model named)    → seedance-2 on shot 4 only                    → the one shot where physics matter
```

🚨 **Keep it to what is NOT already data.** A saved Shot records the references, their roles, the model and every param, and `slates_get_shot` reads them back composed — narrating those is retelling a row the user can open. This convention exists because the model's choices had nowhere structured to land; where they now do, write the Shot and let the log carry the judgement no field holds.

**Hard rule: never silently add weather, props, style, or camera movement.** If it wasn't in the brief and you added it, it goes in the log. This is the "why did you add that?" affordance — for an agent that writes prompts on the user's behalf and spends their credits, it is what keeps the model in assembly and the user in the director's chair.

> ❌ **Do NOT turn this into a question gate.** Clarifying questions before optimizing directly fight the locked fast-path rule: *if intent is clear, generate immediately with sane defaults, don't ask questions; only ask for production intent, and batch every question into one message.* Log the decisions, then go. The log is an **output**, not an interrogation — surfaced alongside the plan, never as a separate ceremony, and never as a reason to wait.
<!-- @end:decision-log -->

Turning a script into *visual* frame prompts means resolving things the script left open — what the room looks like, where the light comes from, how the shot is framed. Those are your decisions, not the writer's; name them.

Ask: **"Generate frame images now? (y/N)"**

### 3. Generate frames if requested
- `slates_generate_from_shots` with every image Shot's id and no `confirm` — it returns ONE itemised quote for the set plus the largest single item. Show that total, get an explicit OK, then re-call with `confirm: true`.
- It fires the Shots one after another and BLOCKS until the last one lands, so it can outlast the HTTP timeout on a long set. If that happens the run is still going: poll `slates_get_shot` for each Shot's `generationIds` rather than re-firing, which double-spends.
- Each result returns inline. Evaluate. If one is wrong, fix that Shot (`slates_update_shot`) and re-fire only it — never the set.
- Bind the keeper to a frame with `slates_add_frame`, then `slates_update_shot` with `attachFrameId` so the recipe and the picture stay together.

### 4. Hand back
- Total frames generated, total credits spent, storyboard id.
- Suggest next steps: review via `slates_get_storyboard_with_frames`, or take the frames to motion — fork each image Shot with `slates_duplicate_shot` (`model:` the video model), give the copy its frame with `slates_update_shot` (`firstFrameAssetId`), then fire the set with `slates_generate_from_shots`. Assemble with `slates_add_clip_to_timeline` in story order and `slates_export_video`. The full frames-to-film pipeline (batch cost authorization, model mixing) is `slates-one-prompt-film`.

## Anti-patterns

- **Don't** auto-generate without asking. Generation is the expensive step. Always confirm first.
- **Don't** invent shot details the script doesn't mention. If the script says "they argue," ask what the shot looks like, don't fabricate "she clenches her fists in a wide shot."
- **Don't** mix scene structure and frame generation in one pass — building the skeleton first lets the user catch errors before spending credits.
- **Don't** write the plan into `motionPrompt` or into chat when a Shot can hold it. A frame's motion prompt is one sentence and one picture; a Shot is the whole recipe, and it is the only form of the plan the user can open, price, fork and re-fire without you.
