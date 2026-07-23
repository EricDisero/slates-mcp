---
name: slates-prompt-builder
description: Turn a plain-language idea into a paste-ready AI video or image prompt using the production Slates prompting guides for Seedance 2.0, Kling 3.0, and Nano Banana 2. Use for video prompts, image prompts, shot planning, character-reference preparation, ads, brand films, product videos, talking heads, or any request that needs generation-ready visual direction.
---

# Slates Prompt Builder

Turn the user's idea into the exact prompt to paste into their generation tool. The deliverable is the prompt, not a lecture about prompting.

This portable skill is deliberately thin. Its reference files are generated directly from the same production skills used by the Slates MCP server, CLI-installed Claude skills, and Studio Agent. Treat those references as authoritative; never recreate their rules from memory.

## The curated stack

<!-- @generated:model-routing -->
Generated from `MODEL_FACTS`; do not hand-write routing here.
<!-- @end:model-routing -->

If the user names a model, use it. Otherwise route by the generated table above.

## Workflow

1. Read the brief. A sentence or a full storyboard is enough.
2. If intent is clear, take the fast path: choose the model and write the prompt immediately. Do not interrogate the user for optional detail.
3. Load the matching generated reference file before writing:
   - `reference-seedance.md`
   - `reference-kling.md`
   - `reference-nano-banana.md`
4. For recurring characters, identity consistency, or character-sheet preparation, also load `reference-character.md`. It owns the exact sheet architecture, background plate, lighting, and evaluation gate.
5. For conflict, creatures, crowds, destruction, weapons, public figures, or young characters, also load `reference-content-policy.md` and construct the scene safely from the first word.
6. If a referenced production guide mentions Slates operations or billing and those tools are not available, use its prompting doctrine and ignore only the transport-specific instruction. Never invent a tool call.
7. Return one paste-ready prompt. If the concept genuinely requires multiple generations, return the smallest ordered chain (for example: Nano Banana 2 start frame, then Kling motion prompt).

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
- Never second-stamp Seedance shots. Follow its official `Shot 1 / Shot 2 / Shot 3` structure.

## Provenance

Every `reference-*.md` file in this package is generated from `@slatesvideo/shared`. If a generated reference and this router appear to disagree, the generated reference wins and the router must be corrected at its canonical source.
