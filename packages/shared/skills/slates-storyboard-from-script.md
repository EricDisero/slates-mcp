---
name: slates-storyboard-from-script
description: "Save a supplied script or treatment as an editable Slates document and bind production passages to shots. Use when preparing a storyboard while preserving the words, structure and requested scope."
---

# Script into editable production

Read the existing document and its revision before writing. Preserve supplied words, speaker context, headings, non-spoken direction and any explicit shot list. A heading formats a document; creating a production scene is a separate choice. Paragraph count does not determine shot count.

## Save the words once

Use `slates_get_script_document` and `slates_update_script_document` for ordered, revision-checked text and structure edits. Scene strings own spoken words. Paragraph blocks hold offsets and marks; headings/directions own only their non-spoken text. Do not keep an independently editable master body beside the document. `slates_paste_script` saves a whole script as text with no Shots, and opens a scene at every `SCENE`, `INT.`, `EXT.`, `I/E.` or `# Name` line; use it when the user wants those scenes, and write through `slates_update_script_document` when they want headings only.

Create a board or scene only when the requested destination needs it: `slates_create_storyboard` comes with a first scene, and `slates_split_scene` opens a scene at a heading line, taking the text and Shots below it. Use the current project unless the user asks for another. Writing a script needs no image, character record or generation.

## Bind production where wanted

Read the scene's text, offsets and shot codes with `slates_get_script`, then pass the selected passage to `slates_make_shot_from_script`, which makes, attaches, extends, splits or merges according to the existing bindings. `slates_break_script_into_shots` cuts every unshot paragraph at once, for when one Shot per paragraph is wanted. Read back the resulting Shots and ranges. A silent shot is equally valid and needs no fabricated dialogue.

A new document-created recipe is script-driven: its prompt compiles from the active passage. Text with no speaker and no delivery goes to the model as written (most script text is action); a speaker, VO included, or a delivery note makes it quoted speech. Keep action, delivery, framing and references in their own controls. Do not write the dialogue a second time in a custom prompt. When the creator explicitly chooses a custom prompt (`recipeMode: custom`), preserve its bytes and, after a script edit, compare the Shot's current line with `promptScriptLine`, the line the prompt was written against.

A new Shot files itself into the open scene, else the board's last scene; pass `sceneId` or `frameId` to `slates_create_shot` to place it, and read codes from the result, since a deleted Shot's code can be reused. Keep recurring identities in existing Library references; a working speaker name does not require a placeholder character.

## Review without imposing a format

Read composed requests, actual reference roles and the current quote. Variety counts are suggestions: intentional repeated frames, continuing sentences and recurring cast may be exactly right. To run one sentence across a cut, split the Shot mid-sentence with `slates_split_shot` (it marks the run-on); the new Shot inherits the duration rather than halving it, so set each length. `slates-script-craft` covers passages and versions; `slates-shot-variety` covers deliberate visual rhythm.

If generation is requested, follow `slates-cost-discipline` for the exact set. On an uncertain timeout inspect existing generation IDs before retrying. Preserve takes and inspect the landed results. Named cuts keep independent edits separate; writing alone does not require a cut, export or paid call.

<!-- @inject:decision-log -->
Record production choices in the editable shot fields. Explain only consequential judgments the user did not specify and no field already records: for example, why a particular light or performance register supports the brief. Do not repeat the shot list in prose or turn this explanation into an approval gate. Follow the separate generation authorization policy before spending.
<!-- @end:decision-log -->
