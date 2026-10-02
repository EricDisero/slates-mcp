---
name: slates-prompt-builder
description: Builds paste-ready image and video prompts from an ordinary-language brief using model-specific Slates craft. Use for visual prompt writing, clip edits, shot planning or recurring-character references.
compatibility: Standalone prompt preparation. Generation requires the user's chosen image or video tool; check that tool's current schema and reference support.
---

<!-- Generated from the Slates production prompting guides. Do not edit — this file is rebuilt from source. -->

# Slates Prompt Builder

Turn the user's idea into the exact prompt to paste into their generation tool. The deliverable is the prompt, not a lecture about prompting.

This portable skill is deliberately thin. Its reference files are generated directly from the same production skills used by the Slates MCP server, CLI-installed skills, and Studio Agent. Treat those references as authoritative; never recreate their rules from memory.

## Models and routing

<!-- @generated:model-routing -->
| Model | Lane | Canonical route | Guide |
|---|---|---|---|
| **GPT Image 2.5 Sunburst** | image generate; default | THE QUALITY GPT IMAGE SEAT — OpenAI's most capable image model, higher quality than GPT Image 2, same price as Flare, deliberately SLOWER. Route here unless speed is the point: finals, hero frames, photoreal people, and multi-reference edits where every reference must survive into one frame — its widest lead. Explore on Flare, finish on Sunburst. | `reference-gpt-image-2-5.md` |
| **GPT Image 2.5 Flare** | image generate; specialist | THE FAST GPT IMAGE SEAT — OpenAI's small model, optimized for SPEED, quality COMPARABLE to GPT Image 2 (not better) at roughly half the latency. Route here when speed matters: drafts, exploration, volume. TEXT / DIAGRAM / PANEL work — character sheets, shot grids, text-bearing panels. When quality outranks speed, escalate to Sunburst. Own content filter, distinct from Gemini's. Killed by a head-to-head at the intended crop going the other way. | `reference-gpt-image-2-5.md` |
| **Nano Banana 2 (Gemini 3.1 Flash Image)** | image generate; specialist | The all-rounder and the only image seat with a headless path: holds many subjects coherently in one frame, and the start-frame for legible in-scene text. Knowledge cutoff Jan 2025: anything later needs reference images. | `reference-nano-banana.md` |
| **Seedance 2.5** | video generate; default | DEFAULT VIDEO MODEL — the strongest seat for physics, effects, scale and hero shots, and the only Seedance that takes long single takes, many references, audio-only references and integer-second timestamps. No 4K, and dearer than 2.0 at every shared resolution: go to 2.0 for 4K or the same resolution cheaper. LENGTH is the price dial — quote long takes first. VIDEO-ONLY. Timestamp grammar and the edit/extend words that make the provider reclassify and fail a generation are in reference-seedance-2-5.md. | `reference-seedance-2-5.md` |
| **Seedance 2.0** | video generate; specialist | THE 4K AND VALUE SEAT beside the 2.5 default — the only Seedance with native 4K (Pro required in Slates) and cheaper than 2.5 at every resolution they share, with the same physics, effects and scale strengths; shorter takes, fewer references, no timestamps. VIDEO-ONLY. | `reference-seedance.md` |
| **Kling 3.0** | video generate; specialist | THE COST-EFFECTIVE SEAT — strong start-frame adherence (identity, layout, text), acting, dialogue and lip-sync; pick it when the budget matters and the shot is a performance or a start-frame animation. Kling is also the ONLY engine behind the Motion Transfer and Lip Sync tools. | `reference-kling.md` |
| **Gemini Omni Flash** | video generate; specialist | 720p seat with native synced audio included. Route here for drafts with sound in one pass and reference-to-video character-consistency trials; LTX, H3 and H3 Max Turbo cost less per second. VIDEO-ONLY. Quality against Kling/Seedance is unproven — do not route hero shots here. | `reference-omni-flash.md` |
| **Omni Flash Edit** | video edit; default | VIDEO-TO-VIDEO EDIT, prompt-only — THE EDIT-FIDELITY WINNER (head-to-head vs Kling edit on real talking footage: lips held, audio near-identical, both action beats landed), priced level with Kling O3 Edit Standard. Footage-synced prop, effect, environment and lighting swaps. Takes NO reference images — identity swaps needing refs go to Kling edit. Fidelity is EARNED by prompt discipline; the exact form is in reference-omni-flash.md. | `reference-omni-flash.md` |
| **Kling O3 Video Edit** | video edit; specialist | VIDEO-TO-VIDEO EDIT, the REF-DRIVEN one: it is the only edit seat that takes element/style reference images to lock subject identity, and its keepAudio preserves the original audio verbatim. Route here when an edit NEEDS reference images or bit-exact audio; for prompt-only footage-synced VFX, omni-flash-edit won the fidelity head-to-head. One instruction beat per pass — multi-beat prompts get under-executed. | `reference-kling.md` |
| **Seedance 2.5 Edit** | video edit; specialist | VIDEO-TO-VIDEO EDIT, and the only edit engine that takes a clip longer than the other two reach — that length is the whole reason to route here. Inside their range, compare on fidelity instead: Omni Flash edit won the prompt-only head-to-head, and Kling edit is the one that takes reference images. Edits audio on the same row (re-voice, re-accent, translate with re-fitted lips, replace BGM). Costs about 1.2x a plain 2.5 generation of the same length: an edit bills at twice the reduced video-reference rate. | `reference-seedance-2-5.md` |
<!-- @end:model-routing -->

This export includes the current Slates image, video and video-edit defaults plus the specialists listed above. If the user names a model, use it when its guide is included. For another model, obtain its current prompting guide rather than adapting unrelated syntax. Otherwise choose from this table for the brief. A model choice does not authorize generation.

## Workflow

1. Read the brief. A sentence or a full storyboard is enough.
2. If intent is clear, take the fast path: choose the model and write the prompt immediately. Do not interrogate the user for optional detail.
3. Load the matching generated reference file before writing:
   - `reference-seedance-2-5.md` for Seedance 2.5; its grammar points directly to `reference-seedance.md`.
   - `reference-seedance.md` for Seedance 2.0 and shared Seedance grammar.
   - `reference-kling.md` for Kling generation or reference-driven editing.
   - `reference-gpt-image-2-5.md` for GPT Image 2.5.
   - `reference-nano-banana.md` for Nano Banana 2.
   - `reference-omni-flash.md` for Omni Flash generation or prompt-only editing.
   Load only the model and mode being used; the contents list identifies the relevant sections.
4. For recurring characters, identity consistency, or character-sheet preparation, also load `reference-character.md`. It owns the exact sheet architecture, background plate, lighting, and evaluation gate.
5. For conflict, creatures, crowds, destruction, weapons, public figures, or young characters, also load `reference-content-policy.md` and construct the scene safely from the first word.
6. Check how the target generator accepts prompts and ordered references. Slates-specific billing, default settings and historical measurements describe Slates' endpoints; they are not guarantees about another tool. Prepare the prompt without running a generation unless the user requests one.
7. Return one paste-ready prompt. If the concept requires separate generations, return the smallest useful chain of prompts. Preserve the user's visual choices and use model-specific craft to realize them.

## Output

```text
--- PROMPT (<Model>) ---
<paste-ready prompt>
--- END ---
```

Then give no more than three short notes covering only decisions the user needs to understand: the model route, a non-obvious constraint, or how references should be attached. Do not expose chain-of-thought, internal scoring, density maps, or a shot table unless the user explicitly asks for one.

## Hard boundaries

- Never restate a model's syntax from memory; load its generated reference.
- Never hand-invent a character-sheet prompt when `reference-character.md` already defines the canonical one.
- Never silently add weather, props, style, or camera movement the user did not request. If you apply a sane default, name it briefly in the notes.
- Never carry image-model lens, aperture, film-stock, or camera-body syntax into Seedance. Follow the model reference's translation rule.
- Use the chosen Seedance version's timing grammar: 2.0 uses `Shot 1 / Shot 2 / Shot 3`; 2.5 accepts integer-second timestamps. Do not transfer one version's restriction to the other.

## Provenance

Every reference is generated from the production Slates skills. The routing table comes from the model registry; character-sheet wording comes from the same builder Slates calls. A craft guide's measurement keeps its recorded scope and date. Routing comes from the table, while the matching guide owns the prompt grammar.
