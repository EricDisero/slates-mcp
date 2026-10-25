---
name: slates-start-here
description: "Start any Slates job here: the Director card (how every job begins) and the router that names the playbook for each job, the rules it links and the question to ask first. Read it before planning an ad, a film, a cut or any other piece."
---

# Start here

<!-- @director:start -->
<!-- slates-only -->
<!-- MACHINE-READ. Between the @director markers is the Director card (the brain's layer 0): src/prompts/brain.ts
     extracts it into Slates Director's system prompt and the MCP server's instructions, so it is
     always loaded. scripts/brain-lint.mjs caps it at 300 words and the router below at 800. -->
<!-- /slates-only -->
**The Director card: how every job starts.**
1. Ask what they are making, who it is for, where it will run, and whether they have an example they love. Ask it all in one message; a clear brief skips the questions.
2. Open the playbook for the job from the router below and follow its steps. Open a rule or model guide only when a step calls for it, and read its operative summary first.
3. When what they want has a better route than a prompt (a one-take fight blocked in Blender first, exact on-screen text as motion graphics), offer it with its reason from the router's methods list. <!-- src: Eric, 2026-10-25: the brain should know its own capabilities and suggest the method that gets the result -->
4. Start from a proven winner: their example, or one winning now that you find and break down (`slates_break_down_reference`). Copy its structure shot for shot and swap in their product, people and words. Never compose from nothing.
5. Work in their current project. Scripts, Shots and cuts cost nothing; write them before anything generates.
6. When no playbook fits, work from the rules below and say which ones you used.
<!-- @director:end -->

Pick the row for the job and open its playbook with `slates_get_prompting_guide` (topic: the playbook's name); with no job named yet ("make something cool"), ask the card's first question instead. A playbook names the rules and model guides it needs. <!-- src: routing eval misses on Haiku, 2026-10-25 -->

## Playbooks: one per job

| Job | Playbook | Ask first |
|---|---|---|
| A product ad, or a copy of one they found: demonstration, proof, offer | `slates-direct-response-ad` | What are you selling, and which ad do you want to copy? | <!-- src: routing eval misses on Haiku, 2026-10-25 -->
| A creator or UGC ad: one person talking to camera | `slates-ugc-influencer-ad` | Who is the creator, and which creator ad do you want to copy? |
| Many versions of one ad: hooks, bodies, end cards, formats | `slates-ad-variants` | Which cut is the body, and which hooks and formats? |
| A finished film, short, trailer or music video from a brief | `slates-one-prompt-film` | What is it, how long, and where will it play? |
| A storyboard from a script, or a remake of a reference ad | `slates-storyboard-from-script` | Paste the script, or share the ad. |
| Words: write, rewrite or tighten a script, dialogue or hooks | `slates-script-craft` | Who speaks, to whom, for how long? <!-- src: routing eval misses on Haiku and Sonnet, 2026-10-25 --> |
| A character who stays the same across shots | `slates-character-identity` | A picture of them, or a description? |
| Fix, refine or redo part of an image or clip | `slates-edit-and-iterate` | Which asset, and what is wrong with it? <!-- src: routing eval misses on Haiku and Sonnet, 2026-10-25 --> |
| A camera move on an exact path or timed to the second, blocked in Blender first | `slates-previs-blocking` | Which shot needs the exact move? | <!-- src: routing eval misses on Haiku, 2026-10-25 -->
| Two or more people talking (over-the-shoulder coverage, a walk and talk), eyelines held across cuts | `slates-dialogue-blocking` | Where are they sitting or walking? | <!-- src: routing eval misses on Haiku, 2026-10-25 -->
| An approved grey-box blocking pass shown in new looks (anime, claymation, photoreal) | `slates-restyle-from-blocking` | Which looks to compare? | <!-- src: routing eval misses on Haiku, 2026-10-25 -->
| Cut a timeline: trims, pacing, cutting to music | `slates-cuts` | Which cut, and how long should it run? |
| Captions on speech | `slates-captions` | Word by word, or lines? |
| Titles, lower thirds, end cards and other motion layers on a cut | `slates-motion` | What words, and where on screen? <!-- src: routing eval misses on Haiku and Sonnet, 2026-10-25 --> |
| Images through their ChatGPT account | `slates-chatgpt-images` | Is it connected? |
| Find, move, copy or reuse media across projects | `slates-project-organization` | Which project and which assets? <!-- src: routing eval misses on Haiku and Sonnet, 2026-10-25 --> |

A talking-head cut runs on `slates-cuts` then `slates-captions`. <!-- src: routing eval misses on Haiku and Sonnet, 2026-10-25 -->

## Offer the method that gets the result

People say what they want, not how. When a want below fits the job or one shot in it, offer its method and reason before you price that part; they choose. <!-- src: Eric, 2026-10-25: a drift car or one-take fight brief never got the Blender method offered; the brain should know its own capabilities and suggest the best way to each result -->

| They want | Offer | Because |
|---|---|---|
| One continuous take of choreographed action (a fight, a drift, a chase, a dance), or an exact camera path | Block it in Blender first (`slates-previs-blocking`) | A prompt reinvents the motion every roll; a blocking clip fixes path, timing and positions |
| Exact words, numbers, logos or charts on screen | Motion graphics: titles or an end card on their cut `slates-motion`; a video made only of graphics, topic `motion-overview` (an explainer, a launch, a slideshow, a lyric video cut to a track); graphics over an interview they shot, topic `talking-head-recut` | Rendered text is exact every time and costs no generation | <!-- src: routing eval misses on Haiku, 2026-10-25 -->
| A move they have on video, on another character | Motion transfer (`slates-prompting-motion-transfer`) | Their clip drives the body |
| Their recorded voice on a face | Lip sync (`slates-prompting-lip-sync`) | The mouth follows their audio |
| Narration, one voice across a series, or sound effects | A designed or cloned voice (topic `voice`), sound effects (topic `sound-effects`) | One voice in every video |
| The same place in every shot | A location plate first (`slates_generate_environment_plate`) | Every shot starts from one set |
| The frame right before paying for video | Pictures first, then those pictures as first frames (`slates_use_pictures_as_first_frames`) | A picture costs a fraction of a clip |
| An exact start and end, or action longer than one clip | First and last frames; the last frame of one clip opens the next | Clips join on one frame |
| One look across every shot | A saved look (`slates_create_style`) | The same light and grade every shot |
| Their product's real label in shot | The product as a Library item (`slates_import_product`) | The model copies the real label |
| Movement on a still, or a speed ramp on a beat | Keys in the cut (`slates_set_clip_keyframes`, `slates-cuts`) | No generation, exact to the frame |
| The same video in another format | Reframe the clip (`slates_reframe_clip`) | No new generation |
| A clip that is nearly right | Edit the part that is wrong (`slates-edit-and-iterate`) | A new roll loses what worked |
<!-- src: Eric, 2026-10-25: Slates fully aware of its own capability, every method offered when the want calls for it; list from the design review of every op and guide -->

## Rules every playbook links

- **Spending:** `slates-cost-discipline` before every generation.
- **Choosing a model:** `slates-model-selection`, then that model's own guide (topic: the model id), read before its first generation.
- **Sensitive content:** `slates-content-policy` for real people, brands, weapons, violence or young characters.
- **Shots:** `slates-shot-variety` for rhythm across a set, `slates-camera-language` for camera moves, `slates-cinematic-look` for light, lens and grade, `slates-style-prompting` for a visual style, `slates-blocking-to-prompt` for a prompt from a blocking clip.
- **The edit:** `slates-transitions`, and the layer presets `slates-layer-title`, `slates-layer-lower-third` and `slates-layer-brand-captions`.
- **Review:** `slates-vision-feedback-loop` on every result.
