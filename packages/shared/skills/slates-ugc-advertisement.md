---
name: slates-ugc-advertisement
description: Write phone-shot UGC and AI-influencer ad footage that reads as captured rather than produced — one character talking to their own camera across many ordinary locations. Covers the one-shot-per-generation law, the camera-is-the-variety-axis method with six framing generators, plate discipline and the flaw budget, small-business micro-movement, the eyeline rule that decides lip-sync, and pacing arithmetic. Use when writing prompts for a UGC ad, an influencer or testimonial video, a talking-head spot, a day-in-the-life, or any short-form video that should look like someone filmed it on their phone. For scripted, world-hopping commercial film use slates-cinematic-advertisement instead.
---

# UGC advertisement — the craft layer

One person, their own phone, ordinary places, talking straight to the lens. Everything here exists to keep the footage looking **captured** rather than **produced**.

🚨 **The one law this register adds: ugly on purpose.** Handheld, blown highlights, no grade, no music bed. That is not laziness, it is the argument — polish is exactly what makes generated footage legible as generated. **If a clip looks like a commercial, it failed.**

---

## §1 — One shot per generation. Never a multi-scene take.

**Measured head-to-head on identical plates and prompts:** a 22-second six-scene generation returned nothing usable. A 10-second three-scene generation returned about one usable second. The *same beats* shot as ten separate 4-and-5-second generations, one scene each, fired concurrently, **all landed on the first attempt.**

Cost is linear per second, so splitting is free. What it buys:

- **A bad shot costs one shot, not the whole take.** In a long take one broken scene kills every good scene beside it and the retry re-buys all of them.
- **Every shot re-rolls independently**, so a note lands on one clip.
- **Concurrency means the whole ad still shoots in one wave.** Serial length buys no wall-clock.
- **No transition can fail**, because there are no transitions inside a generation. Cuts happen in the edit, where they are free.

⚠️ **The 4-second generation floor is a rounding cost, not a reason to combine shots.** A 1.5-second line padded into a 4-second window is trimmed in the edit for nothing. Padding is a far cheaper problem than a dead 22-second roll.

---

## §2 — One whole phrase per shot

A shot's line must be a **complete breath-unit, roughly 12–18 words.** Fragments — *"costs hundreds of dollars,"* alone — come apart in delivery.

**Cut the script into phrases first, then assign a location to each phrase.** Never cut a phrase to fit a location you like.

**Pacing is arithmetic: ~3.4 words per second.** A 5-word line gets 1.5 seconds. Give it 4 and the model stretches the delivery to fill the window — that is what "she talks too slow" actually is, and no adjective fixes it. Asking for a fast read does nothing if the window is generous.

⚠️ **A deliberately short line needs an explicit hold.** Direct it to land immediately and then hold the look in silence for the remainder. Otherwise the model stretches three words across four seconds and it drags.

---

## §3 — 🚨 The camera is the variety axis, not the location

**Measured on two batches an hour apart.** Batch one: eight plates, eight different rooms of one home, every one carrying *"shot on a phone front camera at arm's length."* Verdict: *"all of these look the same."* Batch two: the same character, camera position rewritten per shot, locations changed from rooms to places with a job. Verdict: *"way, way better."* **The only variable was where the camera sat.**

**Six generators. Assign a different one to each consecutive shot.**

1. **Inside an object, looking out** — a washing machine drum, a fridge, a microwave, a locker, a glovebox, a vending machine. The object's mouth rings the frame out of focus.
2. **On the floor, looking up** — pavement at ankle height, the base of a pillar, a stairwell landing, an elevator floor.
3. **High, looking down** — wedged on a shop shelf, on top of a fuel pump, a ceiling corner, a level above.
4. **Set on a surface she walks into frame of** — a car roof, a folding table, a bench, a shelf edge, a tailgate.
5. **Behind or through something** — a counter, chain-link, a clothes rack, a rain-covered window.
6. **Reflections that are not a bathroom mirror** — polished steel, a dark shop window at night, a wing mirror, a puddle shot downward.

⚠️ **UGC does not mean selfie.** An arm's-length clause in every prompt produces one camera position N times *and* puts the subject's extended arm through the corner of every frame. Both flaws have one cause. **The phone is propped, wedged, set down or left somewhere far more often than it is held.**

⚠️ **A found-object camera is still handheld.** Someone is holding it there. Name the rig and then the operator's body — *"lying on the pavement with the phone a few inches off the concrete, the frame jolting and twisting to keep her in it"* — because a locked-off version of the same angle reads as a tripod or a security camera and loses the register.

⚠️ **Rooms of a home are a cop-out.** A place with a job beats a place to live in: laundromat, parking garage, corner store, gas station, storage corridor, elevator, loading dock, hot food counter.

⚠️ **Rapid cutting is close-weighted.** A wide shot needs time for the eye to find the subject; a close-up lands instantly. At 1.5–2.5 seconds per shot, weight the set toward tight.

---

## §4 — Photoreal is a flaw budget, not a quality setting

Everything that makes a frame read as real is something the model has to be **talked out of**: open pores, an oily T-zone, a blemish, a dozen flyaway hairs breaking the silhouette, an asymmetric off-lens expression, flat uninteresting window light.

**Every default the model reaches for — even skin, symmetric light, clean silhouette, posed smile — is a tell. Spend the prompt on imperfections; never on quality words.**

- **Name the photographic source rather than inventorying flaws.** *"Camera-original unretouched skin, open pores, oily sheen, a blemish"* reads as a token list and renders plastic. *"These are photographs off someone's camera roll that were never opened in an editor"* changes what kind of image gets made.
- **Pair it with raking side light.** Flat shadowless light hides the exact texture that proves realism.
- **Negative direction goes in as positives.** *Matte uneven skin*, not "not smooth." *Flat daylight*, not "no studio lighting." *Caught mid-step*, not "not posed."

---

## §5 — Plates

**Shoot a still for every shot and use it as the opening frame of the generation.** It locks the composition you already approved, so the model animates a frame you chose instead of inventing one. Images cost a fraction of video; a video roll off a mediocre plate is a wasted video roll.

- **A plate per scene, always.** Never ask a generation to invent a location it has no reference for.
- **Expression and hair state are specified per shot**, or every frame comes back with the same face. Hair **style** stays fixed — that plus wardrobe is what carries identity — but hair **state** varies: tucked behind an ear, blown across the face, tangled from lying down, stuck to the forehead.
- **Never describe the phone as an object.** *"She lifts the phone"* renders a phone in her hand. Describe only what the camera does, and carry *"no phone, camera or device visible anywhere in the picture."*
- **Keep motion out of the plate.** Crowds, fire and weather are motion; a plate that already contains them locks the composition before the video prompt gets a say. Plate the ordinary frame and let the video bring the chaos.

**The one exception to plate-as-opening-frame:** a shot whose first frame must not exist yet — a reveal, a transformation, anything that resolves *into* the plate. There, pass the plate as a reference only and let the prompt dictate frame one.

---

## §6 — Identity travels on the person, not the place

Wardrobe, a fixed hair style and **one accessory motif** carry a character across a dozen locations far more reliably than face-locking alone. A pair of earrings present in every frame, through outfit changes and lighting changes, does identity work the model would otherwise charge reference slots for.

**So leaving a location costs nothing.** Never let set continuity argue you into shooting another room of the same house.

---

## §7 — Eyeline decides whether a shot lip-syncs

A character not addressing the lens reads as B-roll, and the model lays the voice over silent footage. **It is not a frame-size problem** — the identical shot lip-syncs correctly once the eyeline is locked.

**Write where the eyes ARE for the whole duration:** *"her eyes are locked on the lens for the entire shot and she talks straight into it."* Add an exception after that, if at all.

⚠️ **A brief exception becomes the whole shot.** *"Glances at her feet once and back up"* produces five seconds of staring at feet. *"Never looks down at her hand"* produces looking down at the hand. The model takes the vivid clause and runs the whole beat on it.

---

## §8 — Micro-movement is directed, never assumed

Every shot carries an explicit list of small involuntary actions. A shot that only says what the person says produces a mannequin talking.

> *Small things: she blinks twice, her weight shifts onto one hip, a strand of hair slips forward, and the framing drifts and corrects the way a held phone does.*

Others that work: hitching a waistband mid-step · picking dry skin off a lip · rolling a can between both hands · blowing hair out of the corner of the mouth · pulling sleeves down over the hands · nudging a basket along with a foot · shaking fingers off and wiping them on shorts.

🚨 **Small involuntary business only — never a big physical action at the lens.** Directing someone to climb, jump or haul themselves onto something throws their whole body across a close frame and wrecks it. Small business reads as captured; a big action reads as staged.

⚠️ **When a re-roll must hold the plate's pose, say so as a prohibition** — *"she does not climb onto it, she does not sit down, and she does not lean any further toward the camera than she already is"* — and pair it with *"the camera never travels and nothing in the shot jolts it."*

⚠️ **For a physical feat, direct the struggle rather than the event.** A glass that shatters on contact reads as a trick; one that resists for a beat and holds before it gives reads as strength.

---

## §9 — Two things the model will quietly overrule

- **It corrects your grammar.** Non-standard usage in spoken dialogue gets normalised to the textbook form, every roll. Do not fight it with re-rolls — rewrite the line so the construction never appears.
- **Content-filter refusals are stochastic.** An identical second call often passes. Re-roll twice before touching a word; only redesign after two or three refusals.

---

## §10 — Still gate

<!-- @inject:still-gate -->
**A visible defect in the still is already a STOP.** Do not animate it. Fix the frame first, then move to motion — and go to motion only when the crop passes the still scan and you genuinely need movement to confirm an uncertain edge, reflection, or object.

This is a **cost** rule as much as a craft rule: a 1080p/10s premium video generation costs many multiples of an image re-roll, and video is where a defect stops being fixable. Anything wrong in the still gets worse in motion — soft geometry mushes, broken-but-plausible objects fall apart, oily textures start crawling. **Animating a known-bad frame is the single most expensive mistake in the pipeline.** Re-rolling the image is the cheap move; re-rolling the video is not.
<!-- @end:still-gate -->
