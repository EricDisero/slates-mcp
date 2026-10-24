---
name: slates-prompting-wan-3
description: "Prompt Wan 3.0 video (wan-3.0). Covers reference numbering (Image N, Video N, Audio N), timestamped shots, dialogue and voice cloning, sound and music control, negatives and the frames-or-references split."
---

# Wan 3.0 — prompting

<!-- @card:start -->
<!-- slates-only -->
<!-- MACHINE-READ. Everything between the @card markers is extracted by
     src/prompts/craft-cards.ts and returned on every cost estimate for this
     model, so it is the ONE piece of positive craft guidance the agent cannot
     skip. Measured 2026-08-30: a fact inlined where it cannot be skipped moved
     compliance 0/8 to 30/32; the same guidance behind a fetch moved nothing.
     Keep it under 2,400 characters (the build fails above that) and keep the
     rationale, the receipts and the worked examples in the body below. -->
<!-- /slates-only -->
**Card — Wan 3.0.** Alibaba's all-in-one video model: text, a start frame with an optional last frame, or references (images, videos and audio together). Slates sends your prompt exactly as written; the provider's prompt rewriter is off, so nothing pads a thin prompt.

**The five levers**
1. **Cite references by type and upload order, counted separately:** `Image 1`, `Image 2`, `Video 1`, `Audio 1`. Image 1 and Video 1 exist side by side. With one file of a type, `reference image` is enough.
2. **Say what each reference lends:** `The child in Image 1 stands in the apartment in Image 2`; `Reference the camera movement of Video 1`; `Style references Image 2`.
3. **Write shots as number + timestamp + content**, 2–5s each, end to end: `Shot 1 [0-3s] ...`. For one shot, open with `One continuous shot`.
4. **Dialogue is speaker + verb + colon + quote:** `She whispers: "Not here."`. Clone a voice with `Voice timbre references Audio 1`. Write `No dialogue` when you want none, or it decides for itself.
5. **Name sound and music outright:** describe actions and materials and it fills the sound; `No background music` removes music. End with a short negative list of what must not appear, never padded.

**Examples**
- `One continuous shot. The courier in Image 1 rides through the night market in Image 2, camera handheld following at shoulder height. Sizzling woks, a scooter horn. She calls out: "Order for table six!" No background music.`
- `Shot 1 [0-3s] wide: rain over the harbour. Shot 2 [3-6s] close-up: the man in Image 1 lights a cigarette, hard cut. Voice timbre references Audio 1. He says: "We sail at dawn."`

**Hard constraint:** frames and references never mix (Alibaba: the modes are mutually exclusive), so move a start frame into the references when you need both. Reference video totals 15s across up to 5 clips, and its seconds bill on top of the output; trim references to the part you need.
<!-- @card:end -->

<!-- @banned:start -->
<!-- slates-only -->
<!-- MACHINE-READ. Every `backticked` token between the @banned markers is
     extracted by src/prompts/banned-tokens.ts and returned on this model's cost
     estimate, and every submitted prompt is matched against it. Keep entries
     backticked and prose outside the backticks. -->
<!-- /slates-only -->
**Never use:**
- a reference number that does not match the upload order: `Image 3` when only two images were sent cites the wrong file or nothing
- high-frequency actions the model cannot control, which Alibaba names itself: `shaking head 3 times per second`
- a padded negative list that repeats the positive prompt
<!-- @banned:end -->

Wan 3.0, Alibaba's video model, generates picture and sound together, 2–30 seconds, at 480p, 720p or 1080p, in 16:9, 4:3, 1:1, 3:4 or 9:16. Sound is on by default and can be switched off. Added to Slates 2026-10-17. Sources: Alibaba's API guide and prompt guide, and the schemas of the three endpoints Slates calls.

## Where it routes

- **Cheap long takes with sound, and reference-heavy shots.** It reads up to 10 reference images, 5 reference videos and 5 reference audio clips in one request, audio-only included. The full routing lives in slates-model-selection; never restate it here.
- **Not the default video seat.** Its quality on our own shots and on real faces is not yet measured in Slates.

## Inputs: three shapes

| Shape | What goes in | Notes |
|---|---|---|
| Text to video | prompt | Single shot or a multi-shot narrative from the prompt alone |
| Frames | start frame, optional last frame | The last frame needs a start frame. It interpolates between them |
| References | up to 10 images, 5 videos (15s total), 5 audio clips (15s total), 20 files at most | Any mix of the three, audio-only allowed |

Alibaba: *"`reference_xx`/`file`/`link` types and `first_frame`/`last_frame` types are mutually exclusive and cannot be used in the same request."* So frames with references are refused rather than one side silently dropped. To hold a look from a frame while using references, pass the frame as a reference image and say what it lends.

**Reference video bills on top of the output.** Input video duration is billed in addition to output duration. A 10s take with a 6s reference clip bills 16 seconds. Each reference clip must be at least 16 fps.

## Reference citation (Alibaba's grammar)

Files are numbered by upload order, with images, videos and audio counted separately: the first image is Image 1, the first video is Video 1, and both exist at once. Slates numbers images in the order of the reference list (ingredients, then characters, environments and styles), and videos and audio in the order you pass them.

| To get | Write |
|---|---|
| Appearance only | `The child in Image 1 stands in the entryway of the apartment in Image 2` |
| Several files at once | `The figure in Image 1 holds Image 2 in hand and walks into the scene of Video 1` |
| A voice | `Voice timbre references Audio 1`, or `Speak in the timbre of Audio 1: "..."` |
| Camera movement only | `Reference the camera movement of the video, change the scene to a rooftop cafe` |
| An action only | `Replace the skateboarding man in Video 1 with the woman in Image 1, keeping the action, trajectory and scene unchanged` |
| A style only | `Only reference the color tone and lighting of Image 2, not the characters` |

The same file can be cited several times, once per job (appearance, motion, voice).

## Shots and timestamps

Prompt = one overall sentence (theme, perspective, mood) + numbered shots with timestamps + shot content. Shots run end to end with no gaps, 2–5 seconds each. `[0-3s]` and `(00:00-00:03)` both work; pick one and keep it. `Shot 1: wide shot ...; Shot 2: close-up ...` without times also works.

- One shot, no cuts: open with `One continuous shot` or `Generate single shot`.
- Camera still: `Fixed shot, camera static, position unchanged`.
- Camera moves in plain words: `push in`, `pull out`, `orbit`, `handheld follow`.
- Transitions: end a segment with `hard cut` or `dissolve`, or start the next with `seamlessly continue from the last frame of the previous segment`.
- Lens: `85mm telephoto, shallow depth of field`; `24mm wide-angle, deep focus`. Slow motion: `High-speed photography (1000fps slow motion)`.

## Nobody holds still

<!-- @inject:living-performance -->
**Nobody holds still. Write every person a performance that changes on every beat.** A video model
animates what the prompt describes and nothing more. Describe one expression ("she screams, mouth
open") and the person freezes in it for the whole take, which reads as dead and fake however good the
camera is.

- **Every person, every beat:** what their hands do, where their head and body go, what they say or
  shout and to whom, and how the expression shifts, then shifts again. "Yelling at him with both hands
  up, then grabs the dash as the car snaps sideways" moves; "terrified" is a still.
- **Escalate and turn.** A scene's emotion travels: fear into fury into a stunned laugh. Each beat
  gives the next state, never a repeat of the last.
- **One calm character may stay still in the face, never in the body.** The stoic one still blinks,
  breathes, glances, and works their hands, and reacts once the scene earns it (a smirk, a look across).
  A held beat before a spoken line is the same: the face settles, the body keeps small movement.
- **Keep it physical.** Write the visible action, not the feeling: a jabbed finger, a slap on the
  shoulder, a hand clawing hair out of a mouth. Name the lines or shouts when the audio matters.
- **A blocking or previs reference makes stillness worse.** Its stand-in figures are frozen
  mannequins, and the model copies their stillness unless the prompt says so. Say it in the prompt:
  "its figures are frozen stand-ins and their stillness is not the acting; take only the camera and
  the timing from video 1, and the people perform as written below, moving in every second."
- **On a model that reads timestamps (Seedance 2.5), write the acting inside every interval,** beside
  the camera and the action, so no range leaves a person without something to do. On a model that
  reads shots instead, give every shot its own acting the same way.
<!-- @end:living-performance -->

## Dialogue, sound and music

- Dialogue: `xx says: "content"`, one line per speaker, the speaker named by reference where it helps (`Image 1 says: "..."`).
- Voice cloning: `Voice timbre reference Audio N`, written once per character. Lip sync: append `Lip sync`.
- Voiceover: `Voiceover: "..."`.
- **No dialogue: say `No dialogue`**, or the model decides on its own.
- Sound fills itself from described actions, materials and weather (`splashing through puddles`). Name a specific effect in its own sentence, with a timestamp if it must land on a beat.
- Music has three settings: write nothing and it chooses; name it (`cello enters very softly`); or remove it (`No background music`).

## Style and mood

Art style + color tone + mood, at the start or the end: `35mm cinematic film`, `high-saturation warm yellow`, `oppressive and tense`. Keywords are enough.

## Negatives

There is no negative-prompt field; write them as sentences at the end. Only what must not appear, and nothing already covered by the positive prompt: `No subtitles`, `No watermark`, `No face distortion`, `No frequent shot cuts`, `No costume changes`.

## Duration and the sound switch

- Duration is 2–30 seconds. Slates always sends a number; the provider's "smart duration" is never used, so the quote equals the bill.
- `sound: false` makes a silent take. Sound on or off costs the same at each resolution; a metered bill has not yet confirmed it.

## Content notes

- The model is licensed for commercial use. Alibaba's pages state no face policy; real-face behaviour has not been tested in Slates.
- The safety checker stays on.
