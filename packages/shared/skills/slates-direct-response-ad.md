---
name: slates-direct-response-ad
description: Build a 30-second hyper-motion direct-response ad in Slates from a product image and brief. Composes upload → storyboard → frame gen → motion gen → timeline → export. Use when the user drops a product image and asks for "an ad", "a promo video", "a TikTok ad", "an Instagram ad", a launch video, or any short-form direct-response video built around a product.
---

# Direct-response ad — Slates workflow

You are building a 30-second hyper-motion direct-response ad. The user has handed you a product image (or product URL) and a short brief. Slates desktop is open on the second monitor; the user watches it populate as you work.

**Hard rules**

- Always estimate cost before generating. Use `slates_estimate_generation_cost` and surface the total.
- All MCP/CLI generation routes through Slates Credits, period. BYOK is desktop-UI only by design — don't suggest "use your own keys" workarounds.
- Default model: `nano-banana-2-2k`. For close-up product hero frames step up to `4k` only if the user asks.
- Hyper-motion = punchy cuts, 4 frames in 30 seconds, ~7s each. Don't over-storyboard.

## Workflow

### 1. Set up the project
- Create a project named for the product (`slates_create_project`).
- If the user gave a product image as a file path, upload it (`slates_upload_reference_image`).
- If they pasted base64 / a data URL, use the same op with `dataUrl`.

### 2. Generate the storyboard frames
Build exactly 4 frames in this order:

| # | Beat | Visual goal |
|---|------|-------------|
| 1 | Hook | Hyper-close-up of the product, dramatic light, motion blur edge |
| 2 | Lifestyle | Real person using/wearing/holding the product, eye contact |
| 3 | Problem→solution | The before/after moment that justifies the buy |
| 4 | CTA | Clean product hero with mental room for an overlaid CTA in editing |

For each frame:
1. Draft a tight 1-2 sentence prompt (visual only — no copy text in the image).
2. Reference the product upload's URL or asset ID for visual fidelity.
3. Call `slates_generate_image` with that prompt + reference. **You see the result inline — evaluate it.**
4. If it's wrong: refine prompt, regenerate. If it's right: bind it as a frame in the storyboard (`slates_add_frame`).

### 3. Build the storyboard
- `slates_create_storyboard` named "30s ad — v1".
- Default scene already exists. Add 3 more scenes ("Hook", "Lifestyle", "Problem-Solution", "CTA") via `slates_add_scene`, or just add all 4 frames to the default scene.
- For each generated image, add a frame referencing the asset id (`slates_add_frame`).

### 4. Hand back to the user
- Surface estimated total credits spent.
- Tell the user the storyboard is ready and they can either:
  - **In Slates desktop:** click each frame to generate motion (the existing UI handles motion generation).
  - **Continue here:** ask you to keep going.

### 5. If they say keep going — motion, assembly, export
- Generate motion per frame with `slates_generate_video` (`firstFrameAssetId` = the frame's asset, `background: true`), using the highest-confidence model the budget allows (Veo 3.1 Fast 8s by default). Submit all four, then poll `slates_get_generation_status` until each completes (1-5 min).
- Assemble: `slates_add_clip_to_timeline` for each completed clip in beat order (Hook → Lifestyle → Problem-Solution → CTA). Verify with `slates_get_timeline`; fix order with `slates_reorder_clips`.
- Export: `slates_export_video` to an absolute `.mp4` path (default `<slates_get_project_directory>/exports/<product>-ad.mp4`), then `slates_reveal_file` so the user sees the file.
- Full pipeline doctrine (batch cost authorization, model mixing, multi-take selection): `slates-one-prompt-film`.

## Anti-patterns

- **Don't** generate text overlays in the image. Slates renders captions/CTAs at the editor stage.
- **Don't** burn credits on slot-machine prompting. If the first generation is off, refine the prompt; don't just regenerate.
- **Don't** skip the cost estimate. Confirm with the user above $0.50.
- **Don't** invent visual specifics about the product (colors, textures, angles) that aren't in the reference image. Reference-anchored prompts only.

## Voice

The ad lives or dies on the hook frame. Tight, sensory, no fluff. Match the user's brand. Default tone is "scroll-stopping" not "informative."
