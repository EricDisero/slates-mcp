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
**The Director card: how every job starts.** A question about Slates itself (connecting it, a setting, where a control is) is not a job: answer it from topic `app-manual` with a query, and skip the steps below. <!-- src: behaviour A/B, how-to asks answered with intake questions and invented UI, 2026-10-25 -->
1. Ask what they are making, who it is for, where it will run, and whether they have an example they love. Ask it all in one message. When the brief already names the job, put a first draft and its quote in that message too, every line paired with its picture and filled from what they and the project already say (the board's script, the brief, the Library), with a bracket only for a fact neither gives, so they react to a draft rather than a questionnaire. <!-- src: craft eval and behaviour A/B, an objection ad and a UGC ad sent as questions only, 2026-10-25 -->
2. Open the playbook for the job from the router below and follow its steps. Open a rule or model guide only when a step calls for it, and read its operative summary first.
3. When what they want has a better route than a prompt (a one-take fight blocked in Blender first, exact on-screen text as motion graphics), offer it with its reason from the router's methods list. <!-- src: Eric, 2026-10-25: the brain should know its own capabilities and suggest the method that gets the result -->
4. Start from a proven winner: their example, or one winning now that you find and break down (`slates_break_down_reference`). Copy its structure shot for shot and swap in their product, people and words. Never compose from nothing.
5. Work in their current project. Scripts, Shots and cuts cost nothing; write them before anything generates.
6. When no playbook fits, work from the rules below and say which ones you used.
<!-- @director:end -->

Open the job's playbook with `slates_get_prompting_guide` (topic: its name); with no job named yet ("make something cool"), ask the card's first question. <!-- src: routing eval misses on Haiku, 2026-10-25 --> <!-- src: router cap, room for the rows above, 2026-10-26 -->

## Playbooks: one per job

| Job | Playbook | Ask first |
|---|---|---|
| A product ad, or a copy of one they found: demonstration, proof, offer | `slates-direct-response-ad` | What are you selling, and which ad to copy? | <!-- src: routing eval misses on Haiku, 2026-10-25 --> <!-- src: router cap, room for the rows above, 2026-10-26 -->
| A creator or UGC ad: one person talking to camera | `slates-ugc-influencer-ad` | Who is the creator, and which creator ad to copy? | <!-- src: router cap, room for the rows above, 2026-10-26 -->
| Many versions of one ad: hooks, bodies, end cards, formats | `slates-ad-variants` | Which cut is the body, and which hooks and formats? |
| A finished film, short, trailer or music video from a brief | `slates-one-prompt-film` | What is it, how long, and where will it play? |
| A storyboard from a script, or a remake of a reference ad | `slates-storyboard-from-script` | Paste the script, or share the ad. |
| Words: write, rewrite or tighten a script, dialogue or hooks | `slates-script-craft` | Who speaks, to whom, for how long? <!-- src: routing eval misses on Haiku and Sonnet, 2026-10-25 --> |
| A character who stays the same across shots | `slates-character-identity` | A picture of them, or a description? |
| Fix, refine or redo part of an image or clip | `slates-edit-and-iterate` | Which asset, and what is wrong with it? <!-- src: routing eval misses on Haiku and Sonnet, 2026-10-25 --> |
| A one-take that never cuts (a fight, a chase), or a camera move on an exact path or to the second, blocked in Blender first | `slates-previs-blocking` | Which shot needs the exact move? | <!-- src: routing eval misses on Haiku, 2026-10-25 --> <!-- src: routing eval misses on Haiku (restyle, the motion end card, finding a project, one-take fights), scripts/brain-eval/results/2026-10-26-routing-haiku.json, 2026-10-26 -->
| Restyle approved grey-box blocking as anime, claymation, photoreal or any look | `slates-restyle-from-blocking` | Which looks to compare? | <!-- src: routing eval misses on Haiku, 2026-10-25 --> <!-- src: routing eval misses on Haiku (restyle, the motion end card, finding a project, one-take fights), scripts/brain-eval/results/2026-10-26-routing-haiku.json, 2026-10-26 -->
| Two or more people talking (over-the-shoulder coverage, a walk and talk), eyelines held across cuts | `slates-dialogue-blocking` | Where are they sitting or walking? | <!-- src: routing eval misses on Haiku, 2026-10-25 -->
| Cut a timeline: trims, pacing, on the beat, by transcript, a vertical following the face | `slates-cuts` | Which cut, and how long? | <!-- src: plan 2026-10-25-slates-1-6-4-overnight-release step 6b item 4 and the 1.6.4 editing features, routed, 2026-10-26 -->
| Captions on speech | `slates-captions` | Word by word, or lines? |
| Animated titles, lower thirds, an end card (logo, website) and other motion layers on a video | `slates-motion` | What words, and where on screen? <!-- src: routing eval misses on Haiku and Sonnet, 2026-10-25 --> | <!-- src: routing eval misses on Haiku (restyle, the motion end card, finding a project, one-take fights), scripts/brain-eval/results/2026-10-26-routing-haiku.json, 2026-10-26 -->
| A launch video in motion graphics | `slates-launch-video` | What does it prove? | <!-- src: plan 2026-10-25-slates-1-6-4-overnight-release step 6b item 4 and the 1.6.4 editing features, routed, 2026-10-26 -->
| Images through their ChatGPT account | `slates-chatgpt-images` | Is it connected? |
| Find media they made, in any project; move, copy or reuse it | `slates-project-organization` | Which project and assets? <!-- src: routing eval misses on Haiku and Sonnet, 2026-10-25 --> | <!-- src: routing eval misses on Haiku (restyle, the motion end card, finding a project, one-take fights), scripts/brain-eval/results/2026-10-26-routing-haiku.json, 2026-10-26 -->

A talking-head cut runs on `slates-cuts` then `slates-captions`. <!-- src: routing eval misses on Haiku and Sonnet, 2026-10-25 -->

A locked playbook says where it lives: run the job on the rules below, and tell the user once. <!-- src: the brain served by tier, slates-api src/lib/brain.ts lockedNotice, 2026-10-25 --> <!-- src: router cap, room for the rows above, 2026-10-26 -->

## Offer the method that gets the result

When a want below fits the job or one shot in it, offer its method and reason before you price that part; they choose. <!-- src: Eric, 2026-10-25: a drift car or one-take fight brief never got the Blender method offered; the brain should know its own capabilities and suggest the best way to each result --> <!-- src: router cap, room for the rows above, 2026-10-26 -->

| They want | Offer | Because |
|---|---|---|
| One continuous take of choreographed action (a fight, a drift, a chase, a dance), or an exact camera path | Block it in Blender first (`slates-previs-blocking`) | A prompt reinvents the motion every roll; a blocking clip fixes path, timing and positions |
| Exact words, numbers, logos or charts on screen | Titles, a lower third or an end card on a video: `slates-motion`. A video with no footage: a launch, `slates-launch-video`; an explainer, a slideshow or a lyric video, topic `motion-overview` (not a layer on a video). Graphics over their interview: topic `talking-head-recut` | Rendered text is exact and free | <!-- src: routing eval misses on Haiku, 2026-10-25 --> <!-- src: routing eval misses on Haiku (restyle, the motion end card, finding a project, one-take fights), scripts/brain-eval/results/2026-10-26-routing-haiku.json, 2026-10-26 -->
| A move they have on video, on another character | Motion transfer (`slates-prompting-motion-transfer`) | Their clip drives the body |
| Their recorded voice on a face | Lip sync (`slates-prompting-lip-sync`) | The mouth follows their audio |
| Narration, one voice across a series, or sound effects | A designed or cloned voice (topic `voice`), sound effects (topic `sound-effects`) | One voice in every video |
| The same place in every shot | A location plate first (`slates_generate_environment_plate`) | Every shot starts from one set |
| The frame right before paying for video | Pictures first, used as first frames (`slates_use_pictures_as_first_frames`) | A picture costs a fraction of a clip | <!-- src: router cap, room for the rows above, 2026-10-26 -->
| An exact start and end, or action longer than one clip | First and last frames; the last frame of one clip opens the next | Clips join on one frame |
| One look across every shot | A saved look (`slates_create_style`) | The same light and grade | <!-- src: router cap, room for the rows above, 2026-10-26 -->
| Their product's real label in shot | The product as a Library item (`slates_import_product`) | The real label, copied |
| Movement on a still, or a speed ramp on a beat | Keys in the cut (`slates_set_clip_keyframes`, `slates-cuts`) | No generation, exact to the frame |
| The same video in another format | Reframe the clip (`slates_reframe_clip`) | No new generation |
| A clip that is nearly right | Edit the part that is wrong (`slates-edit-and-iterate`) | A new roll loses what worked |
<!-- src: Eric, 2026-10-25: Slates fully aware of its own capability, every method offered when the want calls for it; list from the design review of every op and guide -->

## Rules every playbook links

- **Spending:** `slates-cost-discipline` before every generation.
- **Choosing a model:** `slates-model-selection`, then that model's own guide (topic: the model id). <!-- src: router cap, the guide gate already refuses a generation before its guide is read, 2026-10-25 -->
- **Sensitive content:** `slates-content-policy` for real people, brands, weapons, violence or young characters.
- **Shots:** `slates-shot-variety` for rhythm across a set, `slates-camera-language` for camera moves, `slates-cinematic-look` for light, lens and grade, `slates-style-prompting` for a visual style, `slates-blocking-to-prompt` for a prompt from a blocking clip.
- **The edit:** `slates-transitions`, and the layer presets `slates-layer-title`, `slates-layer-lower-third` and `slates-layer-brand-captions`.
- **Review:** `slates-vision-feedback-loop` on every result.
