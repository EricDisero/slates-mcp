---
name: slates-chatgpt-images
description: Generate images using a connected ChatGPT account or the desktop host's built-in image tool, preserving Slates project context, exact prompts and reference lineage. Use when the user requests ChatGPT generation rather than Slates credits.
---

# ChatGPT images in Slates

Resolve the project with `slates_list_projects` and references with
`slates_get_selection` or `slates_list_assets`. Badge codes are project-specific.
Inspect the selected images before generating. Keep the ordered reference IDs
alongside the exact prompt submitted for every output.

Retrieve relevant craft with `slates_get_prompting_guide`: use `cinematic-look`
or `style-prompting` for those requests, with section/query retrieval when useful.
Do not apply another API model's settings or capabilities to the host generator.

## Connected desktop path

This add-on is off by default. The user enables Settings → ChatGPT Images in
Slates before connecting. It requires an installed Codex host and an eligible
ChatGPT account; a subscription alone does not install or connect the host.
Settings offers installation instructions, Connect ChatGPT and Check again in
place, and reports the same connection state as the image picker.
Never install software or enable the add-on silently. Ordinary Slates use needs
neither this add-on nor Codex.

Call `slates_get_chatgpt_status`. If connected, use
`slates_generate_chatgpt_image` with projectId, a fresh UUID requestId, the prompt
and ordered referenceAssetIds. This is also the path used by Slates' prompt bar
and Studio Agent. Use background mode for long calls and inspect
`slates_get_generation_status` with the returned generationId.
The desktop bridge removes only its own temporary thread's original image after
saving and byte-verifying the project copy. Failed cleanup keeps the original.
This does not authorize deletion of files from ordinary host conversations or
files supplied to `slates_save_external_image`.

On timeout or an uncertain response, reuse the SAME requestId. Do not create
a new request to check the old one. Failed or unavailable connections preserve
the user's prompt and refs. Start sign-in with `slates_connect_chatgpt` only when
the user requests connecting; give the returned URL to the user to complete it.

## Host-tool path

If this conversation exposes a built-in image generator and the user chooses
that host workflow, retrieve originals through `slates_get_asset_image` with
fullRes, or use the returned local paths when the host can read them. Inspect
local images using the host's image viewer before editing. Supply every selected
reference in its intended order using the generator's actual schema.

Use the built-in generator. No API key, paid API, browser automation, invented
model identifier, hidden quality setting or silent fallback. If unavailable,
report that limitation and retain the prepared prompt and references.

Save EACH returned image through `slates_save_external_image`, using its actual
filePath or image dataUrl, exact submitted prompt, observed generator label and
the IDs of the references actually sent. Omit model unless the host reports it.
Requested settings are requests, not output facts. Text-only images have no
references. Never substitute a screenshot of the result for the original bytes.

For an uncertain save, inspect the project's new assets and compare prompt,
lineage and output bytes before retrying. The external save operation is not
idempotent for new imports. Reuse assetId to annotate a confirmed existing
upload; do not import the same file again. If identification is ambiguous, stop
and report the uncertainty. A missing output or host failure saves nothing and
does not authorize another generation.

## Framing and quality requests

The connected operation accepts optional `aspectRatio`, with presets supplied
by its schema. Slates appends that request in words through the same composer
used by the UI's What gets sent preview. Do not also append a second ratio
instruction yourself. Saved metadata preserves the original text, requested
ratio and exact submitted prompt; actual dimensions remain measured separately.

For a new prompt, choose only an aspect-ratio preset supported by the current
flagship GPT image model in Slates' capability SSOT. Resolve the current model
through `slates_list_available_models` and `slates_get_prompting_guide` for
model-selection; read the generated `slates_generate_image` aspectRatio schema
for its allowed presets. Do not call that paid operation. Do not maintain a
second hard-coded ratio list here. If the current presets cannot be retrieved,
retain the prepared prompt and resolve them before adding a framing request.
An explicit user request takes precedence; never silently rewrite their prompt.

State the chosen ratio and orientation in the submitted text. This is a prompt
request, not a host size parameter or an assertion of the host's limits. Measure
the returned file and report requested versus actual framing; never silently
crop or stretch it to make the numbers match.

Describe desired detail, legibility, materials and lighting concretely. Words
such as “higher quality” do not establish a quality enum or select a backend.
Only record an actual model or quality tier if the host reports it. The built-in
tool and App Server receipt inspected for this workflow do not expose those
fields. Preserve revisedPrompt separately when supplied.

OpenAI's [image prompting guide](https://developers.openai.com/api/docs/guides/image-prompting)
separates API parameters from prompt language. Its quality and pixel controls
are not automatically controls of the built-in tool. Product launch names and
the `chatgpt-image-latest` API alias are not per-result model receipts.

## Verify the saved result

Read back the returned asset(s) and inspect the images. Report project, badge
code, generator, reference codes and measured dimensions. Distinguish submitted
prompt from any host-reported revised prompt. Do not claim a model/quality tier
from appearance. Reuse Prompt restores text and references; check the displayed
generation destination before another generation. No plugin publication or
directory listing is required for this workflow.
