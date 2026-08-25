---
name: slates-model-selection
description: Which model to pick for a given job — the routing doctrine. Read BEFORE choosing any video or image model, before quoting a plan, and before defaulting anywhere. Kling 3.0 is the general-purpose video default; Seedance 2.0 is the premium tier for anything where physics, effects, or scale remotely matter; Seedance 2.5 is a SECOND SEAT beside 2.0 (30s takes, 30 references and timestamp control, but no 4K and dearer at every shared resolution — never an upgrade); Veo 3.1 is a narrow niche (native synced audio in one gen, 16:9 or 9:16, 4/6/8s) and never the default.
---

# Model selection — the routing doctrine

Pick the model FIRST, deliberately, before writing a prompt or quoting a plan. Model routing is a core part of the intelligence users are paying for: the agent knows what each model is good at and which ones underperform for a job — defaulting to the wrong model burns the user's credits on a weaker result.

## 🔑 The meta-rule — above the table

The tables below are a snapshot. This roster churns constantly (NB2 Lite, Omni Flash, Seedream 5 Lite, GPT Image 2 all landed recently) — **a table rots; a rule doesn't.** When the tables and this rule disagree, or when a model appears that the tables don't cover, run the rule:

> **Name ONE must-preserve requirement for the shot.** Not a vibe — the single thing that, if it breaks, makes the shot unusable: this face stays this face · the fluid behaves like fluid · the text stays legible · the take stays one unbroken move.
>
> **Inspect the output at its intended crop.** A frame that holds up as a thumbnail can fall apart at the size it will actually be watched. For a location, look at atmosphere, material texture, and anchor objects; for a character, identity, skin, pose, and gradients.
>
> **Choose the model that PROVES that requirement** and leaves only failures you can afford to rerun or mask.
>
> **When the roster changes, repeat the evidence test.** Do not carry today's ranking forward on reputation.

## Video routing

| Job | Model | Why |
|---|---|---|
| **General-purpose — the default for most shots** | **Kling 3.0 std** | Cost-effective workhorse. Strong image-to-video: preserves identity, layout, and text from the start frame. 16:9 / 9:16 / 1:1, 3–15s. |
| Higher visual polish, no physics demands | Kling 3.0 pro | Mid-price fidelity bump on the same strengths. |
| Multi-character dialogue / audio co-generation | Kling 3.0 omni | Dialogue syntax, voice direction, language codes, `@element` refs. |
| **Anything with remotely important physics** — effects, destruction, water/fire/smoke/cloth, creature motion, scale, complex simultaneous action | **Seedance 2.0** | The premium tier. Physics and effects are its whole edge; up to 9 ingredient refs, first+last frame, native 4K (4K video is Pro-only). |
| The premium hero shot a piece hangs on | Seedance 2.0 | Spend where it shows. |
| **One take longer than 15 seconds**, or a shot needing more than 9 image references, or an AUDIO-ONLY reference, or **beats that have to land at a named second** | **Seedance 2.5** | A SECOND SEAT beside 2.0, never an upgrade: 4–30s in one take, 30 image + 10 video + 10 audio references, audio-only refs, and the only Seedance seat that **acts on timestamps** (rules in `slates-prompting-seedance-2-5` § Timestamps) — 480p / 720p / 1080p, **no 4K**, and **dearer than 2.0 at every shared resolution** (720p $0.231/s vs $0.15/s, +54%). If you want 4K, or the same resolution cheaper, stay on 2.0. 🚨 Two live hazards: (a) with references attached, the words *add / remove / replace / change / extend / continue* make it reclassify the request as a video EDIT and fail AFTER the job queues — describe the finished frame, or use `seedance-2.5-edit`; (b) LENGTH is the price dial, not resolution — a 30s 720p face gen is 489 credits and a 30s 1080p faceless gen is 614, against a 1,000-credit welcome grant. Quote before any take over ~10s. |

### Named Seedance escalation triggers

"Physics matter" is an abstract category and it under-fires. These are the beats Seedance is **observably** good at — if the shot contains one, escalate without deliberating:

- **Real-time → slow-motion contrast.** The signature beat; nearly every strong clip rides it.
- **The camera moving while debris, meteors, sparks or particles crash around the subject.** Distinctly a feature of this model, not just a thing it survives.
- **Massive scale that has to read as genuinely huge** — not "a big thing", a thing whose size is the point of the shot.
- **One continuous unbroken take.**

Concrete beats route better than an abstract category. Cost stays a tiebreaker, never the router (see below).
| Native synchronized audio (dialogue + SFX generated WITH the video in one gen), 16:9, ≤8s | Veo 3.1 | The only job Veo wins. |

## Video EDIT routing (changing an existing clip)

| Job | Tool | Why |
|---|---|---|
| **Footage-synced VFX on real footage** — add/remove an effect, prop, or lighting change while the take stays the take (incl. talking heads) | **Omni Flash Edit** (`slates_edit_video`, `omni-flash-edit`) | **The edit-fidelity winner** (head-to-head receipt 2026-07-09, WITH a short prompt): lip movement held perfectly, audio near-identical, effect landed and released on cue — where Kling missed an action beat and drifted lips. Prompt-only, 3–10s clips, 720p out, ~6.4 cr/s (cheapest). Quirk: occasional tail jitter / doubled final speech beat — trim the tail on the timeline. Fidelity is EARNED by prompt discipline: one short line + "Keep everything else the same"; long prompts destroy it (see below). |
| **Identity swap needing reference images** — put @marcus into the clip, lock a style from refs | **Kling O3 Edit** (`slates_edit_video`) | The only edit engine that takes element/style reference images (frontal + angles lock identity). ~19¢/s. |
| **Spoken words must be bit-exact** (VO, legal copy, music) | **Kling O3 Edit** with `keepAudio` (default true) — or segment-splice | Kling keeps the ORIGINAL audio track verbatim — but re-synthesizes the video, so lips can drift slightly against it (7/09 receipt). Omni Flash regenerates audio (voice editing unsupported): on the 7/09 receipt it came back near-identical with perfect lips, but "near-identical" is not a guarantee. Zero-risk path for critical audio: segment-splice — edit only the non-talking seconds and keep the original track under the cut. |
| Style-transfer-heavy re-imagining, full relocate of the scene, or edit quality worth a premium at 1080p+ | Seedance edit/relocate (`videoReferenceAssetId` on `slates_generate_video`) | Seedance's strength is transfer intensity; it re-generates rather than surgically edits. Head-to-head receipt 2026-07-09 (photoreal-insert job, same clip): at 720p it LOST to Omni Flash edit on result while costing ~3× (vref bills input+output seconds; face-lane rates when people are in frame). Route here for its strengths or at 1080p/4K where its ceiling is higher — never as the cheap default. (2.5's relocate lane reaches 1080p too as of 2026-08-24, at $0.2457/s of combined input+output.) Takes long descriptive prompts fine (no Omni-style hard-fail on timing phrasing). |
| **A clip LONGER THAN 15 SECONDS** | **Seedance 2.5 Edit** (`slates_edit_video`, `seedance-2.5-edit`) | The only edit engine that takes a 4–30s clip — length is the whole reason to route here. 480p/720p/1080p out, native audio, prompt + clip only (no reference images). Output length AND aspect ratio follow the source, so the billed key is the ceiled source length; an edit bills roughly DOUBLE a plain 2.5 generation of the same length because every provider charges an edit on input + output seconds. Set `seedanceFace: true` when a face is visible — the faceless provider blocks faces outright. No consented-real-face route for editing. Inside 15s, choose on fidelity instead. |
| AI-edit the user's OWN footage | Omni Flash Edit (3–10s), Kling O3 Edit (3–15s, 720–3840px) or Seedance 2.5 Edit (4–30s) | Both take any MP4/MOV — not just Slates gens. Phone footage MUST be rotation-normalized first (players honor the rotation flag; models don't — raw portrait phone clips come back SIDEWAYS). |

- **Edit before re-roll.** A re-roll gambles away the parts the user already likes; an edit changes only what the prompt names. Quote the edit first when a clip is mostly right.
- **Ship via segment-splice.** Every edit model re-synthesizes the whole clip, so fidelity risk scales with clip length. For real deliverables: trim out ONLY the seconds where the change happens, edit that segment, splice it back over the original on the timeline with the ORIGINAL audio underneath. Most of the final video stays the untouched original — that's how the polished split-screen demos going around actually work, plus gesture-only beats with voiceover laid over in post.
- **One change per pass, short prompts.** On Omni Flash this is documented law ("overly descriptive prompts can lead to unintended changes" — long identity-lock preambles make drift WORSE, receipt 7/09); on Kling multi-beat instructions get dropped. Chain passes instead.
- Edited clips are themselves editable clips — chain passes; lineage links each output to its parent.

## Motion Transfer & Lip Sync routing (Kling-only tools)

Both tools are **Kling-only**. Every entry in them is a real Kling endpoint that bolts motion or lip movement onto a finished source as a dedicated post-process.

| Job | Tool | Why |
|---|---|---|
| Motion retarget onto a still character | Kling MC std/pro (`slates_generate_motion_transfer`) | Structured skeleton/depth retarget, ~32–42 credits / 5s, takes up to 30s driving clips. |
| Re-voice a clip, or animate a still portrait | Kling lip-sync / avatar (`slates_generate_lip_sync`) | ~4–29 credits / 5s blocks. |

**Want the Seedance version of either?** It is not a switch on these tools — it is a normal `slates_generate_video` on `seedance-2` with the clip attached as a **video reference** and the motion or dialogue written into the prompt ("the character from image 1 performs the exact motion from video 1"). That routes to the same endpoint the tool would have called, with the prompt visible and editable instead of ghost-written. Single-pass conditioning genuinely beats post-hoc retargeting on fast choreography, contact, cloth and hair — and it carries native audio — so escalate there whenever fidelity matters.

- Seedance video-reference gens bill COMBINED input+output seconds (`seedance-2*-vref-*` keys) — pass the clip duration and quote before confirming. Driving clips must be 2–15s on Seedance 2.0 and up to 30s on 2.5; past that it is Kling MC's lane.
- Faces on that route go through the normal cascade: `seedanceFace` for a character, `[REAL_FACE_DETECTED]` → `seedanceRealFace` + `realFaceConsent` for a real person (premium realface pricing).

**Rules:**

- **Default video = Kling 3.0 std.** Escalate to Seedance the moment the shot has physics/effects weight or is the hero moment — and say why in the plan ("physics-heavy, routing to Seedance").
- **Veo is never the default.** 16:9 or 9:16 only, 4/6/8s only (and 8s only at 1080p/4K, or with reference images), and it is not the quality pick — treat it as a single-purpose tool for native-synced-audio shots. If audio can be added after (Kling lip-sync, edit stage), prefer Kling or Seedance + audio in post.
- **9:16 vertical → Kling or Seedance by preference**, not by necessity: Veo does take 9:16 on the route Slates uses. Route away from it because it is the niche seat, not because it can't.
- **Ratios and durations are enforced before submit.** `slates_generate_video` validates the aspect ratio, resolution and duration against the model you picked and refuses out-of-set values with the legal list — it will not silently ignore or downgrade them. The authoritative per-model sets are in the op's own param descriptions, which are generated from the capability SSOT; prefer those over any list written in prose here.
- **Image-to-video from an NB2 start frame** (the standard pipeline) → Kling by default, Seedance when the motion is physics-heavy. Not Veo.
- **User names a model explicitly → use it.** But if it's a mismatch for the job (crazy physics on Kling std, a 30s take on anything but Seedance 2.5, 4K on Seedance 2.5 which has none), say so in one line and offer the right route before generating.

## Image routing

**Video models (Kling, Seedance, Veo) cannot generate standalone images — ever.** A "premium hero reference image" is still an image job: it routes to an image model below, never to Seedance.

- **Default: Nano Banana 2** — best reference handling (14 refs), best legible text, the standard start-frame generator.
- **NB2 Lite** — the fast/draft seat: ~half NB2's price, ~2.7× faster, 1K only. Route iteration volume and drafts here; finals go back to NB2 full (2K/4K).
- **Nano Banana Pro** — the hero-frame/typography ceiling (~2× NB2). NB2 ≈ 95% of Pro; escalate only when spatial composition, cinematic lighting/skin, fine typography-in-scene, or deep multi-element frames must be perfect. Up to 14 refs — feed it a full subject library.
- **GPT Image 2** — readable text / panels / UI king: character sheets, shot grids, diagrams, text-bearing panels. **Also the photoreal front-runner (Eric, 2026-08-24)** — at `quality: high` it beat both Nano Banana rails head-to-head on skin realism, which is why the AI-influencer ad lane generates every plate here. Medium is the value seat (half NB2's price at 1080p); **high is the seat for photoreal skin and for text precision**. 4K at both tiers is API-only — even paid ChatGPT can't render it.
- **FLUX.2 Max** — photoreal texture, hex-color binding, typography, less censored.
- **Seedream 5 Lite** — uncensored + any-resolution flat price; volume exploration when the Gemini filter is in the way.

**Split rule of thumb:** readable text / panels / UI **and photoreal people** → GPT Image 2 (`high` for photoreal); edit-heavy work, or anything needing the 14-reference ceiling → the Banana line; drafts → NB2 Lite; uncensored or odd resolutions → Seedream/FLUX.

⚠️ **This line said the opposite until 2026-08-24** — it sent photoreal *away* from GPT Image 2 on reputation, which is the exact failure § The meta-rule above warns about. Re-run the evidence test when the roster moves.

## Audio routing

**Image and video models cannot generate standalone audio, and neither audio model can generate images or video.** A shot that needs synced audio generated WITH the picture is still a video job (Kling omni / Veo / Omni Flash / Seedance all carry native audio); the models below produce audio *as its own asset*, to lay on the timeline.

| Job | Model | Why |
|---|---|---|
| **Default — a whole audio scene in one pass**: room tone, ambience beds, crowds, nature, layered dialogue + effects, spoken lines | **Seed Audio 1.0** (`seed-audio`) | One plain sentence in, a complete scene out. 1–120s. The continuity-bed workhorse and the only speech surface. |
| **One effect that lands on a known frame**, or a seamless loop | **Sound Effects v2** (`eleven-sfx`) | The only surface with an exact duration control (0.5–22s) and a real loop mode. |

**There is no music model and no cast-voiceover model.** A song is imported (Slates reads audio files and puts them on the timeline), not generated. A line that has to be spoken is generated on Seed Audio and lip-synced against.

### Named audio escalation triggers

- **"It needs to sound like a place"** → Seed Audio. Three separate SFX generations layered on the timeline is the wrong shape and costs more.
- **"Read this line"** → Seed Audio, with the line in quotes inside the scene sentence. Re-roll until the take is right, then lip-sync against it.
- **"That needs a thump right there"** → Sound Effects, with the duration set to roughly the length of the event.
- **"Give it a track"** → there is no music generation. Say so and offer to lay an imported track on an audio track.

**Rules:**

- **🚨 Seed Audio has NO duration parameter.** Length comes from the prompt text, so Slates writes the requested duration into the prompt and **bills what you asked for**. Choose the duration deliberately and never write a second, different length into the sentence. Full doctrine: `slates-prompting-seed-audio`.
- **Kling's audio syntax does not transfer.** `SFX:` / `Ambient noise:` / `Background music:` prefixes are Kling 3.0 *video* prompt syntax. Seed Audio reads them as literal words and the result degrades.
- **Beds outlast the cut.** Always ask for more seconds than the clip needs so the edit has fade handles — and remember those extra seconds are billed on both surfaces.
- **Audio inside the video vs audio as an asset.** If the sound must be locked to what happens on screen, generate it with the video (Kling omni / Seedance / Omni Flash / Veo). If it needs to be moved, trimmed, re-used, or layered, generate it here and drop it on an audio track.
- Per-model prompting: `slates-prompting-seed-audio`, `slates-prompting-elevenlabs`.

## Cost is a tiebreaker, not the router

Route by capability first, then pick the cheapest tier that serves the job (per `slates-cost-discipline`). Never pick a model because its per-second price looked lowest — a cheap clip that has to be regenerated on the right model costs more than routing correctly once.
