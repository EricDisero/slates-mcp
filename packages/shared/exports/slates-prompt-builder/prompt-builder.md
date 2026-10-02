---
name: slates-prompt-builder
description: Builds paste-ready image and video prompts from an ordinary-language brief using model-specific Slates craft. Use for visual prompt writing, clip edits, shot planning or recurring-character references.
compatibility: Standalone prompt preparation. Generation requires the user's chosen image or video tool; check that tool's current schema and reference support.
---

# Slates Prompt Builder

Turn the user's idea into the exact prompt to paste into their generation tool. The deliverable is the prompt, not a lecture about prompting.

This portable skill is deliberately thin. Its reference files are generated directly from the same production skills used by the Slates MCP server, CLI-installed skills, and Studio Agent. Treat those references as authoritative; never recreate their rules from memory.

## Models and routing

<!-- @generated:model-routing -->
Generated from `MODEL_FACTS`; do not hand-write routing here.
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
