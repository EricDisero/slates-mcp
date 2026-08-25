---
name: slates-ugc-influencer-ad
description: Build a UGC-style AI-influencer ad in Slates — one synthetic person, phone-grade footage, one shot per generation, cut to a vertical direct-response ad. Read before making any talking-to-camera creator video, AI spokesperson, faceless-brand UGC ad, TikTok/Reels/Shorts ad with a person in it, or a testimonial-style spot. NOT for polished cinematic spots — that is a different register with an inverted rulebook, and mixing the two ruins both.
---

# UGC influencer ad — the full production doctrine

One synthetic person, talking to a phone, selling one thing. This is the highest-converting short-form ad shape on paid social right now, and almost every rule below exists because the obvious approach fails.

**Read this file end to end before generating anything.** The phases are not independent: the plate rules decide whether the video rolls land, and the pacing arithmetic decides how long the script can be.

---

## 🚨 THE GOVERNING LAW: UGLY ON PURPOSE

**Handheld, blown highlights, flat light, no colour grade, no music bed.** That is not a shortcut, it is the argument. The ad's implicit claim is *this is a real person filming herself*, and cinematic polish is exactly what makes AI legible as AI.

**If a clip looks like a commercial, it failed.** Every competitor reaches for cinematic. The winners reach for boring.

**Photoreal is a flaw budget, not a quality setting.** Everything that makes a frame read as real is something the model must be talked out of: even skin, symmetric light, a clean silhouette, a posed smile. Spend the prompt on imperfections. **Never spend it on quality words** — "hyperrealistic", "8k", "masterpiece" and "ultra-detailed" do nothing here and push toward the rendered look you are avoiding.

---

## The pipeline — nothing skips a stage

```
script  →  character sheet  →  beat sheet  →  plates (one per beat)  →  video (one per beat)  →  edit
         [ slates_generate_image ]            [ slates_generate_image ]  [ slates_generate_video ]
```

Every video roll starts from an approved plate. Every plate starts from a beat. Every beat starts from a finished script. **A video roll with no plate behind it is the most expensive mistake available in this pipeline** — images are cheap and video is not.

Estimate before every stage with `slates_estimate_generation_cost`, and read `slates-cost-discipline` before the first generation.

---

## PHASE 1 — THE SCRIPT

**Start from a proven ad, not a blank page.** Find an ad in this format that is currently running, transcribe it, and put its script beside yours. Diagnose why theirs works before writing a word. **Clone the structure; swap the product and the specifics.** A paraphrase of a working script performs worse than the script.

### Write the argument as one unbroken paragraph

No beats attached, no shot list, no timings. Get it to where **no sentence can be moved without breaking the one after it.** If two sentences can swap places, it is a list, and a list reads staccato on camera.

### The four tests

1. **Can any two sentences swap?** Then it is a list, not an argument.
2. **Does the voiceover describe what is on screen?** It must not. **The picture proves the realism; the words argue the business case.** Two channels, two jobs.
3. **Does one named person recognise themselves in the first sentence?** *"Freelancers who haven't offered video to clients yet"* works. *"You're scared of AI"* names nobody.
4. **Does the close force a binary?** A question where both answers belong to the viewer and one of them is unacceptable.

### Line-level rules, each earned by a failure

- **Clarity beats cleverness, every time.** Write it so a ten-year-old follows it. A line the viewer has to decode is not a hook.
- **Use the plain word.** "Subscription", not "renting access". "Buy it once", not "perpetual license".
- **Never sell a feature — sell the end state.** Nobody cares what the tool does. They care about money kept, clients won, competitors beaten.
- **Give the claim its context.** "No subscription" means nothing on its own — a subscription to *what*? Say what is for sale before saying why it is better.
- **Fear of missing out must name the loss.** "Your competitors are using this" is nothing. Name what it costs them: the customers being taken, the winning ad someone else found first.
- **No invented numbers.** A statistic you cannot source is a liability, and the model will happily produce one.
- **No contrastive negation** — *"this isn't X, it's Y"* / *"Not X. Y."* It is the single most recognisable AI-writing tell.

### Runtime is arithmetic

**Words ÷ 3.4 = seconds.** Budget the fast number. A 17-word line is a 5-second shot; a 24-word line is 7 seconds. Decide length by cutting words, never by asking for a slower read.

⚠️ **A generous window manufactures a slow delivery.** Give a 5-word line a 4-second shot and the model stretches the words to fill it. That is what "she talks too slowly" actually is, and no adjective in the prompt fixes it.

⚠️ **The model normalises non-standard grammar and you cannot argue with it.** "One less client" comes back as "one fewer client" every roll. Rewrite the line so the construction never appears rather than re-rolling against it.

---

## PHASE 2 — THE CHARACTER

**One person carries the entire ad.** Build her once, lock her, and every plate afterwards references her.

### Build order, and it is counter-intuitive

1. **Generate one ordinary plate first** — any location, described positively: bone structure, colouring, eye spacing, lip shape, hair texture, build.
2. **Crop the face out of that plate.** That crop is now the seed.
3. **Generate the identity sheet from the crop.** Sheets seeded from a rendered image come back rendered; sheets seeded from a photographic plate come back photographic. **Realism carries through the reference chain.**

### The sheet itself

Three panels on one plate, 16:9: a large chest-up portrait at three-quarter angle on the left, a full-body A-pose centre, a full-body back view right with hair visible. The portrait is the largest panel and carries the face at maximum detail. **No second rendering of the face anywhere on the sheet.** Identical wardrobe and hair across all three panels. Plain neutral-grey background.

⚠️ **Phrase a cropped panel as FRAMING, never as absence.** *"The head not shown"* is a content-policy refusal. *"Cropped at the collarbone"* states a camera fact and passes.

⚠️ **Light the sheet with flat phone light and a raking side source, never studio light.** The sheet drives lighting on every plate built from it, so a studio-lit sheet contaminates the whole ad with a studio look.

### Making skin read as photographic

**Name the photographic source. Do not inventory flaws.** A list — *"open pores, oily sheen, a blemish"* — gets treated as tokens and produces plastic. This works:

> These are photographs off someone's camera roll that were never opened in an editor. Daylight arrives from one side and rakes across her face, so the texture catches the light along the cheekbone and the bridge of the nose while the other side sits in soft shadow. Slight JPEG softness, visible sensor grain in the shadows, white balance left a little cool and uncorrected.

**Flat light hides texture. Raking side light is what makes pores visible at all.**

**Give her a name**, in the prompt and in the script. A name creates a person; "an AI influencer" creates nothing.

### 🚨 References decide things prompts cannot

| The REFERENCE decides | The PROMPT decides |
|---|---|
| face, body, build, skin tone, framing, crop | skin detail, light quality, expression, what the camera is, what else is in frame |

**Text cannot override the left column.** Asking for fair skin and an ordinary build against a tanned, model-built reference returns tanned and model-built. **Do not argue with a reference — replace it.**

⚠️ **Never drop the reference to win the left column.** Running the same beat text-only returns a stranger and breaks the one thing this format cannot lose.

---

## PHASE 3 — THE BEATS

Cut the finished script into scenes. **Cut mid-clause, never on a full stop.** A line that resolves lets the generator sit in one room; an unresolved clause forces the location change.

**Each shot gets one complete phrase — roughly 12 to 18 words.** Cut the script into phrases first, then assign a scene to each phrase. Never cut a phrase to fit a scene.

### 🚨 THE CAMERA IS THE VARIETY AXIS, NOT THE LOCATION

Eight plates in eight different rooms, all carrying *"shot on a phone at arm's length"*, produce eight shots that look identical. Rewrite the **camera position** per shot and the same eight locations become a real ad.

**Six generators — assign a different one to each consecutive beat:**

1. **Inside an object, looking out** — washing machine drum, fridge, microwave, locker, glovebox, mailbox, vending machine, oven. The object's mouth rings the frame out of focus.
2. **On the floor, looking up** — sidewalk at ankle height, base of a pillar, stairwell landing, under a bench.
3. **High, looking down** — wedged on a shop shelf, on top of a fuel pump, a ceiling corner, one level above.
4. **Set on a surface she walks into frame of** — car roof, folding table, bus bench, tailgate.
5. **Behind or through something** — a hot food counter, chain-link, a clothes rack, a rain-covered window.
6. **Reflections that are not a bathroom mirror** — polished elevator steel, a dark shop window at night, a wing mirror, a puddle, a dead ATM screen.

⚠️ **UGC does not mean selfie.** An arm's-length clause in a shared prompt tail produces one camera position N times *and* puts her extended arm through the corner of every frame. **The phone is propped, set down, wedged or left somewhere far more often than it is held.**

⚠️ **Rooms of a house are a cop-out.** A place with a job beats a place to live: laundromat, parking garage, corner store, gas station, car wash, storage corridor, elevator, stairwell, loading dock.

⚠️ **Changing location costs nothing.** Identity travels on **wardrobe + a fixed hair style + one accessory motif**, never on the room. Never let set continuity argue you into staying put.

⚠️ **Fast cutting is close-weighted.** A wide shot needs time for the eye to find the subject; a close-up lands instantly. At 1.5–2.5 seconds a beat, weight the set toward tight.

---

## PHASE 4 — THE PLATES. One per beat.

`slates_generate_image`, model `gpt-image-2`, `quality: high`, vertical `9:16`. **Fire concurrently — 8 slots run at once; serial calls waste the day.** Pass `projectId` so every plate lands in the gallery where you can see it.

**GPT Image 2 is the rail for photoreal people.** Head-to-head against the alternatives it is the one that returns photographic rather than plastic skin. Routing detail: `slates-model-selection`.

### 🚨 GPT Image 2 routes references through its EDIT endpoint

Two consequences, both of which waste a generation:

1. **A prompt that opens by describing the reference gets the reference edited.** Open with *"one reference image is a three-panel character identity sheet"* and it returns a brand-new character identity sheet. The head block below is written the way it is precisely to prevent this.
2. **One reference alone drags the scene into that reference's background.** A sheet-only roll puts her on the sheet's plain grey backdrop with no location at all. **Always pass two references:** the identity sheet, plus a second image supplying either the environment or the skin quality to match.

### 🚨 THE PLATE IS FRAME ZERO

The plate is the video roll's first frame, so **whatever is going to happen has not happened yet.** If the beat is something breaking, the thing is intact in the plate. A plate showing the aftermath gives the model nothing to do and opens the shot on a result instead of an event.

**Sole exception:** a background element that must be visible in frame one to stop the scroll.

### Build every plate from three blocks

**HEAD — identical every time. The anti-sheet clause is load-bearing.**

> Reference image 1 is a character identity sheet showing one woman across several panels — the face in the large portrait panel is the authority for her identity. Use that exact woman. Reference image 2 is [the second reference and its job]. Produce a single photograph, not a sheet and not multiple panels.

**MIDDLE — the only part that changes:** location, camera position, wardrobe, **expression, and hair state.**

**TAIL — identical every time.**

> Shot on a phone, slightly soft, mild wide-lens distortion, no colour grade. Camera-original skin with open pores across the nose and cheeks, an oily sheen on the forehead, faint creases under the eyes. These are photographs off someone's camera roll that were never opened in an editor. No retouching and no skin smoothing. Nobody is holding a camera and no phone, camera or device is visible anywhere in the picture. Clean unmarked frame with no text and no logo.

### 🚨 Expression and hair state go in the MIDDLE, never the tail

Putting *"caught mid-sentence, mouth slightly open, eyes on the lens"* in the shared tail produces the identical face in every location.

**Hair STYLE stays fixed** — that plus wardrobe is what carries identity. **Hair STATE varies:** tucked behind an ear, blown across her face, tangled from lying down, scraped back.

Expressions that worked: mid-sentence and locked on the lens · laughing with eyes half shut · concentrating on something, not the camera · squinting into daylight · flat and unimpressed, waiting · bored and blinking, about to speak and not.

### 🚨 The plate decides whether a physical feat is possible at all

**The model will mime an action it cannot resolve.** Three rolls failed the same way on 2026-08-24: a dumbbell whose bar stayed straight while her hands moved, a pan that floated free of her grip and folded against her chest, a steel pole that leaned instead of folding.

**All three were plate problems.** The pan plate had her holding it one-handed at arm's length with the phone in her other hand — no second hand existed to fold it with, so the model invented one and the object drifted.

- **If the act needs both hands, the plate must show both hands free.** That means the camera is propped, set down or wedged — never held at arm's length.
- **Direct the resistance, not the result.** Knuckles whitening, tendons standing, a beat where it holds, then the give.
- **State the finished shape.** *"Folded in half so the two ends touch"* is checkable. *"Bends it"* permits a lean.

### 🚨 NEVER composite a character onto a finished scene. Generate the whole frame at once.

**Receipt, 2026-08-24.** A spectacle plate was generated first (a street, correctly lit), then the character was added by passing that plate as a second reference. Every attempt came back looking green-screened: her face carried a soft frontal key that existed nowhere in the scene, she was sharper and cooler than the background, and no haze or flare crossed in front of her. **A finished scene handed in as a reference tells the model to paste, not to light.**

**The fix is to describe one scene from scratch with only the identity reference attached.** Same subject, same location, same everything — the difference is that the model renders one frame in one pass instead of merging two. The first from-scratch attempt landed.

Use a second reference for *design* (a creature's build, a style) — never for a whole composed frame the character has to be inserted into.

### 🚨 Write the light as ONE physical system, or the character reads as pasted in

The single most common tell is a key light on the subject's face that has no source in the picture. Name all four of these explicitly:

1. **One source, and where it is.** *"The sun is low and directly down the avenue behind everything."*
2. **What that does to HER specifically.** If she is backlit, say her face is in ambient bounce with no highlight and no catchlight, and put the hard rim on her hair, one shoulder and the collar.
3. **Forbid the key that does not exist.** *"There is no light in front of her: no frontal key, no fill, no soft source on her face."* Without this clause the model adds one every time.
4. **Atmosphere in FRONT of her, not only behind.** Haze, dust and veiling flare must cross the foreground, so her edges are no sharper than the parked cars beside her. **Every shadow in frame runs parallel**, hers included.

**Let the camera's exposure be part of the physics.** Backlit means the phone lifts for her face and the sky blows to white. Night means the fire blows out and the blacks lift. That single decision ties subject and background into one image better than any amount of description.

⚠️ **Do not stack grain adjectives.** *"Heavy luminance noise"* plus *"aggressive noise reduction"* plus *"milky lifted blacks"* in one prompt produced a clip so noisy it read as broken. Modern phones are clean at night — name the light, not the sensor damage.

### Other plate rules

- **Never describe the phone as an object.** *"She lifts the phone"* renders a phone in her hand. Describe what the camera does.
- **Write negatives as positives.** *Matte uneven skin*, not "not smooth". *Flat daylight*, not "no studio lighting". *Caught mid-step*, not "not posed". A "no X" list is either ignored or quietly summons X.
- **Text on props renders cleanly and is worth using.** A label reading `YOUR PRODUCT` comes back legible.
- **Content refusals are stochastic. Re-roll the identical prompt before rewriting it.** A plate can refuse once and pass on an unchanged second call. A refused job returns no image and costs nothing. Only redesign after two or three refusals.
- **Generate a pool and pick.** A mediocre plate wastes a metered video roll, and video is the only expensive stage.

---

## PHASE 5 — THE VIDEO. One generation per shot.

`slates_generate_video`, vertical `9:16`, the plate as the first frame. Model routing lives in `slates-model-selection` — read it rather than guessing, and check `slates_estimate_generation_cost` before firing.

### 🚨 ONE SHOT PER GENERATION. Never a multi-scene take.

Measured directly: a six-scene roll returned **nothing usable**, a three-scene roll returned about one usable second, and **the same beats shot as ten separate single-scene generations all landed on the first attempt.**

Cost is linear per second, so splitting is free. What it buys:

- **A bad shot costs one shot, not the whole ad.** In a long take one broken scene kills every good scene beside it and the retry re-buys all of them.
- **Every shot re-rolls independently**, so a note lands on one shot.
- **8 concurrent jobs means the whole ad shoots in one wave anyway.** A long take buys no wall-clock.
- **No transition can fail**, because there are no transitions inside a generation. Cuts happen in the edit, where they are free and reversible.

A short line padded into the minimum duration is trimmed in the edit for nothing. **That padding is a far cheaper problem than a dead long take.**

### The plate is the first frame, always

Passing the plate as the first frame locks the opening on a composition you already approved, so the model animates a frame you chose instead of inventing one. Pass the identity sheet alongside it as a reference.

**The one exception** is a shot whose first frame must not exist yet — a reveal, an assembly, anything resolving *into* the plate. There, pass the plate as a reference only.

⚠️ **Re-read the plate before writing its prompt.** A prompt describing a camera resting on a counter, against a plate that is plainly a held selfie, is a contradiction the model resolves badly.

### 🚨 Eyeline decides whether a beat lip-syncs or becomes voiceover

**A character not addressing the lens reads as B-roll, and the model lays the voice over silent footage.** This is not a frame-size problem — the identical shot lip-syncs correctly once the eyeline is locked.

**Write where her eyes ARE for the whole duration:** *"her eyes are locked on the lens for the entire shot and she talks straight into it."*

⚠️ **A brief exception becomes the whole shot.** *"Glances at her feet once and back up"* produces five seconds of staring at her feet. *"Never looks down at her hand"* produces her looking down at her hand. The model takes the vivid clause and runs the beat on it. State the eyeline as the dominant instruction and add exceptions only if you must.

Mixed voiceover and on-camera is a legitimate choice in this format. It has to be chosen, not discovered.

### 🚨 Name the rig, THEN the operator's body

**"Single continuous handheld shot" tells the model what the camera IS. The operator's body tells it what the camera DOES.** Ship one without the other and it renders its default: a smooth slow push with almost no shake.

**Write a person's body, never a camera path.** Not *"the camera drifts along the tailgate"* but *"the phone is lying flat on the tailgate metal, held loosely by a hand at the corner, so the frame sags to one side and gets nudged back level once."* Arrives, sags, overshoots, corrects, gets bumped, catches up. **And the world must register it** — a move nothing reacts to is a move nobody made.

**An unusual camera position is still handheld.** Inside a fridge, on a car roof, in the gutter — someone is holding the phone there. A locked-off version reads as a tripod and loses the whole register.

### Micro-movement is directed, never assumed

Every beat carries an explicit list of small involuntary actions. A beat that only says what she says produces a mannequin talking.

> Small things: she blinks twice, her weight shifts onto one hip, a strand of hair slips forward over her shoulder, and the framing drifts and corrects the way a held phone does.

Others that work: a container tipping as she takes its weight · her shoulder rising as she reaches · her hand sliding along a handrail · picking dry skin off a lip · blowing hair out of the corner of her mouth.

🚨 **Small involuntary business only — never a big physical action at the lens.** Directing her to climb onto something threw her whole body across a close frame and wrecked it. Re-rolled with nothing but a hair flip, a weight shift and two fingers tapping, it landed. **Small business reads as captured; a big action reads as staged, and at close framing it also destroys the composition.**

⚠️ **When a re-roll must hold the plate's pose, say so as a prohibition:** *"She does not climb onto the truck, she does not sit down, and she does not lean any further toward the camera than she already is."* Pair it with *"the camera never travels and nothing in the shot jolts it."*

**For a physical feat, direct the struggle, not the event.** Something that gives way on contact reads as a trick; something that **resists for a beat and holds** before it gives reads as real — knuckles whitening, tendons standing out, the forearm tensing, the grip shaking.

### Audio

**Always on.** "No music" means no score; it never meant no audio. Say what you want present — her lip-synced dialogue, the sound the action makes, footsteps, room tone — then close with **"No music. No score. No background track of any kind."**

Generating with audio disabled produces a mouth moving in silence and the roll is wasted.

---

## PHASE 6 — THE EDIT

Free, local, and where the ad is actually made. Trim dead air off a beat that ran slow. Drop a re-rolled beat over the original. Burn captions — all-caps, centred low, one or two words at a time, cut on the stressed syllable.

**A one-second overrun is an edit problem, not a re-roll.** Re-rolling a shot to fix a second of air is the expensive way round.

### Verify by WATCHING, never by exit code or by sampling stills

A job that exits cleanly can still be a refusal with no file, and a landed take can still have a beat that never cut. **Check the file has an audio stream and the right dimensions, then look at a frame from each beat.**

---

## Anti-patterns

- **Don't** write cinematic. Polish is the tell.
- **Don't** put quality words in a prompt. Spend it on imperfections.
- **Don't** combine scenes into one generation to save money. It costs more and returns less.
- **Don't** generate video without a plate behind it.
- **Don't** generate text overlays in an image. Captions happen in the edit.
- **Don't** rewrite a prompt after one content refusal. Re-roll it unchanged first.
- **Don't** describe the reference at the top of a prompt. Describe the photograph you want.
- **Don't** fire the next roll because the last one failed. Diagnose against this file first.
