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
- For each frame: write a *visual-only* prompt (image, not action), the shot label, and any director notes. **Don't generate yet.**

Surface the planned structure back to the user as a tight summary:
> Storyboard "X" • 4 scenes • 12 frames total
>   Scene 1: Forest opening (3 frames)
>   Scene 2: Confrontation (4 frames)
>   ...

**Surface a decision log alongside that summary.**

<!-- @inject:decision-log -->
When you surface the plan, include a short **decision log** — one line per decision *you* made that the user did not specify:

```
source phrase or declared default → what you wrote → what it resolves
"in a diner"        → chrome-and-vinyl booth, 3/4 on the counter   → fixes the anchor so blocking is repeatable
(no time of day)    → late afternoon, low warm key                 → default; say the word and it changes
(no camera)         → slow push-in, single move                    → one move per shot; stacking increases instability
```

**Hard rule: never silently add weather, props, style, or camera movement.** If it wasn't in the brief and you added it, it goes in the log. This is the "why did you add that?" affordance — for an agent that writes prompts on the user's behalf and spends their credits, it is what keeps the model in assembly and the user in the director's chair.

> ❌ **Do NOT turn this into a question gate.** Clarifying questions before optimizing directly fight the locked fast-path rule: *if intent is clear, generate immediately with sane defaults, don't ask questions; only ask for production intent, and batch every question into one message.* Log the decisions, then go. The log is an **output**, not an interrogation — surfaced alongside the plan, never as a separate ceremony, and never as a reason to wait.
<!-- @end:decision-log -->

Turning a script into *visual* frame prompts means resolving things the script left open — what the room looks like, where the light comes from, how the shot is framed. Those are your decisions, not the writer's; name them.

Ask: **"Generate frame images now? (y/N)"**

### 3. Generate frames if requested
For each frame:
- Estimate cost (`slates_estimate_generation_cost`, `count = total frames`). Confirm with user if total > ~17 credits.
- Generate sequentially, with character/environment/style references attached when present in the project (`slates_list_characters`, `slates_list_environments`).
- Each result returns inline. Evaluate. If wrong, refine prompt + regenerate (charge once, not multiple).
- Bind to the frame via `slates_add_frame`.

### 4. Hand back
- Total frames generated, total credits spent, storyboard id.
- Suggest next steps: review via `slates_get_storyboard_with_frames`, or take the frames to motion — `slates_generate_video` per frame (`firstFrameAssetId`, `background: true`, poll `slates_get_generation_status`), then `slates_add_clip_to_timeline` in story order and `slates_export_video`. The full frames-to-film pipeline (batch cost authorization, model mixing) is `slates-one-prompt-film`.

## Anti-patterns

- **Don't** auto-generate without asking. Generation is the expensive step. Always confirm first.
- **Don't** invent shot details the script doesn't mention. If the script says "they argue," ask what the shot looks like, don't fabricate "she clenches her fists in a wide shot."
- **Don't** mix scene structure and frame generation in one pass — building the skeleton first lets the user catch errors before spending credits.
