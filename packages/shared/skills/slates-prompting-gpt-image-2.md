---
name: slates-prompting-gpt-image-2
description: Prompting GPT Image 2 — the readable-text / character-sheet / shot-grid engine. Read before calling slates_generate_image with model gpt-image-2. Covers the quality tiers (medium default, high for max text precision), resolution classes (1k/2k=1080p/3k=1440p/4k), text-accuracy prompting, panel/grid layout direction, and when to route to the Banana line instead.
---

# GPT Image 2 — sheets, grids, and text that actually reads

GPT Image 2's edge is **character-level text accuracy** (~99% on English), ordered panels, and exact element placement — the jobs where every other model garbles a word or shuffles a layout. It is NOT the photoreal or character-locked pick: route those to the Banana line (`slates-model-selection` has the split).

## Quality tiers — always set explicitly

- **medium** (default) — sharp text, fast, the value seat: half NB2's price at the 1080p class. Blind benchmarks put it within a hair of high at a quarter of the cost. Start here.
- **high** — ~4× the price; max text precision + reasoning. A deliberate premium pick when tiny type, dense diagrams, or many labeled elements ARE the job.

Never rely on the provider default (it's high — the priciest tier). The Slates ops send medium unless you say otherwise.

## Resolution classes

`1k` = 1024²-class · `2k` = 1920×1080-class · `3k` = 2560×1440-class · `4k` = 3840×2160-class. Pick 2k for most sheets/panels; 4k for print-density grids. 4K exists at BOTH tiers and is API-only — even paid ChatGPT can't render it.

## Prompting for text accuracy

- **Quote every string that must render verbatim**: `the sign reads "OPEN 24 HOURS"` — quoted strings render most reliably.
- Specify font *feel*, not font names: "clean geometric sans, high contrast", "hand-painted brush lettering".
- For dense text (posters, UI mocks), list the copy as ordered lines: `Line 1: "..." Line 2: "..."` — GPT Image 2 respects ordering.
- Keep total on-image text under ~30 words for perfect accuracy; beyond that, accuracy degrades gracefully but degrades.

## Panels, sheets, and grids

- State the grid explicitly and number the cells: "a 2×3 grid of panels, numbered 1–6, reading left-to-right, top-to-bottom".
- Give each cell ONE content clause: "Panel 3: the character mid-jump, side view".
- Character sheets: "character turnaround sheet: front, 3/4 left, profile, back — same character, same outfit, flat even lighting, plain background". GPT Image 2 holds the layout; the Banana line holds the *face* better — for identity-critical turnarounds prefer NB2/NB Pro and use GPT Image 2 when labels/annotations matter.

## References & editing

Reference images route through the edit endpoint (up to ~10). The composed "image N" naming applies as everywhere else. Mask-based inpainting exists at the API level but isn't surfaced — describe the change instead.

## Filter regime

OpenAI moderate — a third regime distinct from Gemini (NB family) and ByteDance (Seedream). Real-face references pass more readily than Gemini; violence/brand rules are similar. `slates-content-policy` applies unchanged.
