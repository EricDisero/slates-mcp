---
name: slates-ugc-influencer-ad
description: "Make a UGC or influencer ad with a camera-facing creator: clone a creator ad winning now, one person and voice across clips (performance, phone camera, speech, lip sync, sound). Not a product-led ad (slates-direct-response-ad)."
---

# The creator ad playbook

<!-- @operative:start -->
**Operative summary.**
- Start from one creator ad that is winning now, the user's or one you find and break down; clone its hook, beats, delivery and camera, and swap in the creator, product and words. (§ 1. Find the winner and break it down)
- The creator is one Library character with one voice, the same in every clip; decide how the words are voiced before anything generates. (§ 2. Cast the creator; § 4. Voice and sound)
- Direct a person doing something in a real place, in the reference's register, and write the hook to name the viewer and the payoff in its first line. (§ 3. Script and direct)
- An AI creator presents the product; it never says it bought it, used it or got a result from it. Never refuse or lecture over it: write the ad with lines the creator can truthfully say (what it is, how it tastes, how it is made), name the change in one sentence, and deliver the plan and its quote. (§ The truth rules) <!-- src: behaviour A/B, a selfie rave ad refused as a fake review with no plan or price, 2026-10-25 -->
- Quote the set and wait for yes; review lip sync and sound by playback or report them unreviewed; export every hook as a variant. (§ 5. Quote, generate, review; § 6. Cut and export)
<!-- @operative:end -->

A creator ad works because a person the viewer believes talks to them about a problem they have. The format is proven at scale, so copy a winning one faithfully: its hook, its order, its pace, the way the creator holds the phone, and where the product appears. Ask first, in one message: what is the product, who is the creator (a real person with consent, or one made in Slates), where will it run, and which creator ad do they want to copy?

## 1. Find the winner and break it down

- Take the user's example, or find a creator ad running now for a product like theirs and show it with why it works. One reference per ad.
- Break it down for free and look at every keyframe: <!-- src: design review of the brain, 2026-10-25: the steps ride every ad playbook from one partial -->

<!-- @inject:reference-breakdown -->
1. `slates_get_reference_breakdown` reads the cuts and any stored words and writes nothing.
2. `slates_break_down_reference` with `build: false` saves each cut's keyframe and a first-and-last composite and returns their codes. Look at every one with `slates_get_asset_image` before writing.
3. Call it again without `build: false` (the frames are reused) with `cuts` (a `description` per cut written for the user's product becomes its prompt; `onScreenText` stays a direction line), `sections` (the beats as headings) and `roles` (who or what recurs; `itemId` points a role at the user's Library item from `slates_list_library`). On a long reference, build first and write the rest a page at a time with `slates_update_shot`.
<!-- @end:reference-breakdown -->

- List every piece before changing one: the opening line and picture, each beat, where the product enters, the cut lengths, the captions, the call to action, and the register (phone selfie, desk talk, walk and talk, a demo in hand).
- Swap the creator, the brand and the logo; keep the rest. <!-- src: brain lint, one home per lesson, 2026-10-25 -->

## 2. Cast the creator

- Keep the creator one Library character so the face holds across clips: `slates-character-identity` makes and binds the identity sheet.
- Attach the creator's voice to the character, so an `@mention` carries it wherever the video model reads a voice.
- A real person needs their consent and follows `slates-content-policy`.
- The product comes from its Library item (`slates_import_product`), identical in every shot.

## 3. Script and direct

`slates-script-craft` covers words and versions; the ad rules are the product playbook's (`slates-direct-response-ad` § 3. Write the script): one message, every hook naming its viewer and payoff and working alone, several hooks on one body.

- **Match the reference's words and delivery.** Its transcript is the vocabulary; copy the sentence shapes, the pauses and the register.
- **Direct an action and an intention.** The creator shows a worn handle, answers a friend, demonstrates a catch, interrupts a task. Small actions make a close shot readable: a weight shift, a glance, a hand taking an object's weight.
- **Describe the place concretely:** a window to one side, a lamp, a room with ordinary things in it. Avoid generic praise words.
- **Describe the camera physically when it matters:** a hand braces the phone on the table edge; the frame sags and is corrected once. A still frame is just as valid. Match the reference instead of forcing shake.
- **Speech can point at the picture.** A line demonstrating a claim should show it; a reaction needs what it reacts to. A sentence may run across a cut.

## 4. Voice and sound

Decide before generating how the words are voiced, and read that guide (`slates_get_prompting_guide`, queries: voice, lip sync, dialogue):

- spoken natively by the video model in the clip;
- a separate voice take (a preset, a described voice, or a recording the user may use), laid on the cut;
- a finished clip re-synced to a voice with lip sync.

A recording attached as a voice sets the voice, accent and timing; give the exact words beside it, because the model transcribes the take again. Say what the sound is: dialogue, room tone, effects, music or silence.

## 5. Quote, generate, review

Inspect each composed request, price the set, show the prompts and the total, and wait for the user's yes (`slates-cost-discipline`). A refusal or timeout never authorizes another charge. Check each clip's picture from sampled frames (`slates-vision-feedback-loop`); lip sync, voice and sound need real playback through a host that plays audio, otherwise say they are unreviewed. Keep earlier takes, and trim or reorder when that fixes it without a new generation.

## 6. Cut and export

Cut in the reference's order and pace (`slates-cuts`): the hook's first frame already moving, no air between lines. Caption the speech (`slates-captions`). Save each hook as a version; the export of the set is `slates-ad-variants`. <!-- src: brain lint, one home per lesson, 2026-10-25 -->

## The truth rules

<!-- @inject:ad-truth-rules -->
- Every claim is literally true of the user's product: no invented guarantee, statistic, result or offer term, and no claim read off a reference picture.
- Never suggest a price, discount or offer, even as an example ("say, about four dollars a can"): ask for theirs and leave a bracket in the line until they give it, because an example figure ends up in the ad. <!-- src: brain craft eval, dr-copy offered example prices while asking for the real one, 2026-10-25 -->
- No fabricated testimonials or reviews. An AI person may present the product and say what it is; it never says or implies that it bought or used the product or got a result from it. Fake and AI-generated testimonials are banned outright in the United States (the FTC's rule on fake reviews, 16 CFR Part 465). Keep the reference's beat and give the line to someone who can say it truthfully, or turn it into a fact about the product.
- A real person's likeness, a brand or a logo follows `slates-content-policy`.
<!-- @end:ad-truth-rules -->

What a creator ad adds: <!-- src: design review of the brain, 2026-10-25: the truth rules ride every ad playbook from one partial -->

- An AI creator may say it is AI and show what the product does; it never shows a before-and-after as if it lived one. <!-- src: design review of the brain, 2026-10-25: only what the shared truth rules do not already say -->
- When the reference's creator speaks as a customer, keep the beat and its timing and change the line: a fact about the product, something the character heard, or the real owner speaking.

