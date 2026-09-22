---
name: slates-script-craft
description: Write or revise script passages, develop distinct openings and bridges, and compare section variations while preserving the user's format, voice and fixed material. This is writing craft, not a request to generate media.
---

# Script craft and variations

Work in the user's document. Read its revision, requested passage and neighboring context. Keep supplied facts, deliberate cadence and fixed sections intact. A script may be silent, a conversation, one continuous sentence, independent scenes, or any mixture. These are tools to choose from, not required stages.

<!-- @evidence: script-craft-20260922 sc-event sc-proof sc-exchange sc-callback sc-modular sc-bridge sc-offer sc-flow -->

## Opening, argument and payoff

| Technique | Evidence | What it does | Reach for · skip | Say |
|---|---|---|---|---|
| `sc-event` | Observed creative pattern; conversion unmeasured | Start with an event or consequence, including sound or silence. | Useful when the product can participate; skip spectacle unrelated to its promise. | `Keys slide toward the table edge; the tray catches them.` |
| `sc-proof` | Observed demonstration pattern | Show the specific claim being tested. Speech may direct attention to the visible evidence. | Useful for observable behavior; skip claims the demonstration cannot establish. | `Watch the rim.` |
| `sc-exchange` | Observed multi-speaker pattern | Let another speaker question, react or misunderstand. Preserve the answering context. | Useful for objections and comedy; do not isolate a dependent answer. | `A: You bought a tray for that? B: Look where my keys used to land.` |
| `sc-callback` | Observed repeated-character comedy | Repeat deliberately, escalate, then resolve or change the meaning. | Useful for recognition and payoff; skip repetition without a purpose. | `The same searching hand finally reaches straight for the tray.` |
| `sc-modular` | Scoped house-format technique | Make selected passages self-contained so they can move independently. | Useful for reorderable demonstrations; do not flatten continuing dialogue. | `At the door, it catches the keys. On the desk, it holds the loose change.` |
| `sc-bridge` | Variation craft synthesis | Vary an opening together with any transition it requires. | Check pronouns, promise, reveal order and offer; preserve the chosen body. | `Where do your keys land? Mine used to land wherever my hand stopped. Now they land here.` |
| `sc-offer` | Claim-control synthesis | Make the next action understandable and supported by the brief. | Use supplied destinations and terms; never invent price, savings, scarcity or guarantees. | `See the available finishes.` |
| `sc-flow` | Spoken-writing synthesis | Clarify subject, action and causal connection before removing stylistic patterns. | Keep intentional rhythm and jokes; skip mechanical fragmenting. | `Put your keys here when you come in.` |

## Distinct openings and compatible bridges

Change the idea: an event, question, objection, proof, audience situation or reveal. Merely swapping adjectives is not a useful comparison. Name what stays fixed for this operation. A dependency belongs in the selected passage: if an opening changes what “that” means, include its bridge in the alternative.

Read each candidate as a complete piece with the same body. Check unanswered promises, introduced speakers, incompatible offers and repeated reveals. Suggestions remain editable; no required Hook/Body/CTA fields.

Use `slates_get_script_document`, `slates_get_script_sections` and revision-checked `slates_update_script_document` / `slates_update_script_section`. Capture alternatives before switching. Preview one requested combination before materializing it; never expand every possible combination automatically. Reference substitutions are explicit IDs, not name replacements in prose. Keep voice retention deliberate.

## Spoken flow and pacing

Prefer a concrete actor doing something over abstract benefit language. “Seamlessly elevate your daily carry” becomes “Put your keys here when you come in.” Connect causes where needed: “I put them down, then forget where” is clearer than mechanically shortening it to “Keys. Gone. Again.”

Preserve the user's or reference's cadence when it carries character, comedy or comprehension. A repeated sentence or triplet is not inherently an error. Personal voice preferences apply only to the person who supplied them. Never invent testimonials or measurable results.

Read the canonical fit analysis supplied with the shots. Its corpus estimate uses total ad runtime, including silence, and an opt-in register sample. It is not measured articulation speed; the observed maximum is not a universal human limit. Plan for pauses, reactions and sound. Once a voice/video take exists, its measured performance governs the cut. Model clip duration, estimated script duration and actual speech duration are separate facts.

## Apply the requested scope

For suggestions, propose each replacement with `slates_update_script_suggestions` (action `create`), quoting the exact words it replaces at the revision you read; the creator accepts or dismisses it in the document, and `slates_get_script_suggestions` reports what became of it. For an explicit edit request, apply the scoped edit and read it back; do not add an approval ceremony. On a stale revision, reread and preserve both authors' changes. Do not replace the whole script to change one opening.

Headings and directions are non-spoken metadata. Shots are optional production bindings. Script-driven recipes compile the active words; custom prompts retain their bytes and need a visible alignment review. Existing takes remain historical media. Writing, switching alternatives and importing templates do not generate anything. Load production and cost guidance only when production is requested.
