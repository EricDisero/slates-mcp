---
name: slates-storyboard-from-script
description: Put supplied script or treatment into an editable Slates document and bind requested passages to production shots. Preserve the words and structure; generate media only within the user's requested scope.
---

# Script into editable production

Read the existing document and its revision before writing. Preserve supplied words, speaker context, headings, non-spoken direction and any explicit shot list. A heading formats a document; creating a production scene is a separate choice. Paragraph count does not determine shot count.

## Save the words once

Use `slates_get_script_document` and `slates_update_script_document` for ordered, revision-checked text and structure edits. Scene strings own spoken words. Paragraph blocks hold offsets and marks; headings/directions own only their non-spoken text. Do not keep an independently editable master body beside the document.

Create a storyboard or scene only when needed for the requested destination. Use the current project unless the user asks for another. Writing a script needs no image, character record or generation.

## Bind production where wanted

Select an intended production passage and use the script-to-shot operation. It can make, attach, extend, split or merge according to the existing bindings. Read back the resulting shots and ranges. A silent shot is equally valid and needs no fabricated dialogue.

A new document-created recipe is script-driven: its spoken text compiles from the active passage. Keep action, delivery, framing and references in their own controls. Do not write the dialogue a second time in a custom prompt. When the creator explicitly chooses a custom prompt, preserve its bytes and review alignment after script changes.

Shots file through the existing filing service. Pass the scene or frame destination when known and use the returned shot codes. Keep recurring identities in existing Library references; a working speaker name does not require a placeholder character.

## Review without imposing a format

Read composed requests, actual reference roles and the current quote. Explain only consequential decisions not already visible in the document or shot. Variety counts are suggestions: intentional repeated frames, continuing sentences and recurring cast may be exactly right. `slates-script-craft` covers passages and alternatives; `slates-shot-variety` covers deliberate visual rhythm.

If generation is requested, follow `slates-cost-discipline` for the exact set. On an uncertain timeout inspect existing generation IDs before retrying. Preserve takes and inspect the landed results. Named Cuts keep independent edits separate; writing alone does not require a Cut, export or paid call.

<!-- @inject:decision-log -->
Record production choices in the editable shot fields. Explain only consequential judgments the user did not specify and no field already records: for example, why a particular light or performance register supports the brief. Do not repeat the shot list in prose or turn this explanation into an approval gate. Follow the separate generation authorization policy before spending.
<!-- @end:decision-log -->
