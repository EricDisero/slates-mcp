---
name: slates-prompt-builder
description: Turn a plain-language idea into a paste-ready AI video or image prompt using the production Slates prompting guides for Seedance 2.0, Kling 3.0, and Nano Banana 2. Use for video prompts, image prompts, shot planning, character-reference preparation, ads, brand films, product videos, talking heads, or any request that needs generation-ready visual direction.
---

<!-- Generated from the Slates production prompting guides. Do not edit — this file is rebuilt from source. -->

# Slates Prompt Builder

Turn the user's idea into the exact prompt to paste into their generation tool. The deliverable is the prompt, not a lecture about prompting.

This portable skill is deliberately thin. Its reference files are generated directly from the same production skills used by the Slates MCP server, CLI-installed Claude skills, and Studio Agent. Treat those references as authoritative; never recreate their rules from memory.

## The curated stack

<!-- @generated:model-routing -->
| Model | Canonical route | Guide |
|---|---|---|
| **Kling 3.0** | DEFAULT general-purpose video model — cost-effective, strong start-frame adherence (identity/layout/text), acting, dialogue, lip-sync, any aspect ratio. Escalate to Seedance for physics. In the Motion Transfer / Lip Sync tools, Kling (MC / lip-sync / avatar) is the cheap utility lane; Seedance is the premium single-pass lane. | `reference-kling.md` |
| **Seedance 2.0** | PREMIUM video tier — route here the moment physics, effects, destruction, or scale matter, and for hero shots. VIDEO-ONLY: cannot generate standalone images (use NB2/FLUX.2/Seedream for those). Up to 9 ingredient images. Strong I2V / own-footage restyle. Native 4K, but 4K VIDEO is a Pro-only tier gate (base maxes at 1080p; server returns PRO_REQUIRED) — default 1080p unless the user is on Pro. Also the PREMIUM engine inside the Motion Transfer and Lip Sync tools (single-pass: driving video / dialogue are native conditioning signals — better motion fidelity, natural speech, voice cloned from a video source; video references bill input+output seconds). | `reference-seedance.md` |
| **Nano Banana 2 (Gemini 3.1 Flash Image)** | Default image model. 14 refs hard cap (10 object + 4 character). Brief it like a creative director, not tag soup. No negativePrompt field — use positive reframing. Best image start-frame for legible text. Knowledge cutoff Jan 2025. | `reference-nano-banana.md` |
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
