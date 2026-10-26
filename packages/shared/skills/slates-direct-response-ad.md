---
name: slates-direct-response-ad
description: "Make a product ad that sells: clone an ad winning now (hook, beats, pacing) for the user's product, then quote, generate, cut and export the variants. Not a camera-facing creator ad (slates-ugc-influencer-ad)."
---

# The product ad playbook

<!-- @operative:start -->
**Operative summary.**
- Start from one ad that is winning now: the user's example, or one you find and break down with `slates_break_down_reference`. Clone its hook, beats, pacing and format; swap in the product, people and words. Never compose an ad from nothing. (§ 1. Find the winner; § 2. Break it down)
- One ad sells one message on one emotion; every spoken line has a picture that proves it. (§ 3. Write the script)
- Every hook names its viewer, promises the payoff, says what the ad is about at once and works alone. Write several hooks on one body, each its own opening picture. (§ 3. Write the script)
- Only literally true claims; no invented results or reviews, and no AI person speaking as a customer. (§ The truth rules)
- Quote the whole set and wait for the user's yes before any generation; then cut, check and export every variant. (§ 5. Quote, then generate; § 6. Cut and export)
<!-- @operative:end -->

An ad is a test in the user's ad account, and the ads that already win in a feed are the cheapest research there is: someone paid to find the hook, the order and the words that work. So the job is to copy a winner faithfully and change only what makes it theirs. Ask the user before starting: what are you selling, who buys it, where will the ad run, and is there an ad you want to copy? Ask it all in one message. The Director card's first draft rides that message and stands in until the reference arrives. <!-- src: brain craft eval, dr-objection sent only questions, 2026-10-25 -->

## 1. Find the winner

- **The user has one:** take it. Their link, file or saved asset is the reference.
- **They have none:** find an ad running now for a product like theirs, the longer it has run the better, and show it to them with why it works before you build on it. A Meta Ad Library link works directly.
- **They have a board already:** it is their draft, and it may copy no winner. Ask which ad it copies, or find one, and write the hooks from it before you reprice a shot. <!-- src: brain craft eval, dr-plan built on the board with no reference and one hook, 2026-10-25 -->
- **One reference per ad.** A batch of ads is that many references, one each; contrast between ads comes free because each source differs.
- **Composing is the failure.** Taking one device from a winner and building your own ad around it, mixing devices from several ads, or improving on the winner are all composing. Copy it.

## 2. Break it down

It costs nothing and generates nothing; how to pass the reference is `slates-storyboard-from-script` § Start from a reference ad. <!-- src: design review of the brain, 2026-10-25: the steps ride every ad playbook from one partial -->

<!-- @inject:reference-breakdown -->
1. `slates_get_reference_breakdown` reads the cuts and any stored words and writes nothing.
2. `slates_break_down_reference` with `build: false` saves each cut's keyframe and a first-and-last composite and returns their codes. Look at every one with `slates_get_asset_image` before writing.
3. Call it again without `build: false` (the frames are reused) with `cuts` (a `description` per cut written for the user's product becomes its prompt; `onScreenText` stays a direction line), `sections` (the beats as headings) and `roles` (who or what recurs; `itemId` points a role at the user's Library item from `slates_list_library`). On a long reference, build first and write the rest a page at a time with `slates_update_shot`.
<!-- @end:reference-breakdown -->

Before you write a line for the build, list every piece of the reference: the hook's picture and line, each beat, each cut's length, the on-screen text, the sound, the offer and the call to action. <!-- src: design review of the brain, 2026-10-25 -->

Put the product in the Library first, so it stays identical in every shot: `slates_import_product` reads its page into a product and its brand into a look. <!-- src: brain lint, one home per lesson, 2026-10-25 -->

## 3. Write the script

`slates-script-craft` covers the mechanics of words and versions. The rules of the ad:

- **Match the reference's words.** Its transcript is the vocabulary: copy its sentence shapes and swap the specifics. When a word feels off, check whether the reference would say it.
- **One message, one emotion.** Price shock, awe at the result, relief from a frustration, curiosity, or real urgency: pick the reference's and commit. A feature list is the most common way an ad dies.
- **Every hook passes four tests:** the viewer thinks "that's me" at once (name their situation, tool or pain); it promises a concrete payoff; it says what the ad is about within two seconds; it works for someone who sees nothing else, which is most viewers.
- **Several hooks, one body.** Write three to six openings for the same body. Each is a whole composition with its own picture, words and idea, never the same opening shot with new text. Read each hook into the body aloud; fix any join that jars. Save them as versions of the opening section beside the shared body.
- **Say less, show more.** Every spoken line has a picture that proves it in the second it is said; a line with no picture is too abstract, so cut or rewrite it. A list of things the product does is one cut per verb.
- **Write it plain.** One thing per line, concrete nouns, every pronoun with one possible antecedent. No cute metaphor, no "introducing", no superlative nobody can check, no logo in the first frame.
- **Fit the words to the time.** The Shot's fit check flags a line too long for its seconds; trim the words, never speed the read.
- **The close tells them exactly what to do,** starting with a verb, with the real offer and the real place to go. The ad sells the click; the page sells the product, so leave the page something to answer.
- **Falsify the top objection.** When buyers doubt one thing (it looks fake, it is too hard, it costs too much), the strongest body makes that doubt impossible to hold by showing it, rather than arguing.

## 4. Make the shots

- Generate in the primary placement's aspect from the start; other formats come from reframing at export, not regeneration.
- Read each Shot's composed request (`slates_get_shot`) before pricing: the prompt, the references in their slots and the settings are what will be sent. Model choice is `slates-model-selection`; read the chosen model's guide before its first generation.
- The hook's picture has to stop a thumb on its own. Spend the most care there.
- The product comes from its Library item in every shot; never invent a finish, a colour or a detail the product does not have.

## 5. Quote, then generate

Price the whole set with the quote on the Shots (`slates_generate_from_shots` returns it) or `slates_estimate_generation_cost`, show the user the itemized total and the prompts, and wait for their yes (`slates-cost-discipline`). Generate the hook shots first when the budget is tight: they decide whether the rest is worth making. A failed job never authorizes an unchanged retry. Look at every result against the reference and the brief (`slates-vision-feedback-loop`) before showing it, and keep earlier takes.

## 6. Cut and export

1. Lay the takes on a named cut in the reference's order and at its cut lengths (`slates-cuts`): ripple the hook so something happens in its first frame, cut on action, trim the air.
2. Add the reference's on-screen text and captions (`slates-motion`, `slates-captions`), and a transition only where the reference has one (`slates-transitions`).
3. Watch the cut against the reference: same rhythm, same beats, your product.
4. Turn the hooks into variants and export every hook, body and format in one job (`slates-ad-variants`).

## The truth rules

<!-- @inject:ad-truth-rules -->
- Every claim is literally true of the user's product: no invented guarantee, statistic, result or offer term, and no claim read off a reference picture.
- Never suggest a price, discount or offer, theirs or a competitor's, even as an example ("say, about four dollars a can"): ask for theirs and leave a bracket in the line until they give it, because an example figure ends up in the ad. <!-- src: brain craft eval, dr-copy offered example prices while asking for the real one, 2026-10-25; a variants hook invented a coffee-shop price, 2026-10-25 -->
- No fabricated testimonials or reviews. An AI person may present the product and say what it is; it never says or implies that it bought or used the product or got a result from it. Fake and AI-generated testimonials are banned outright in the United States (the FTC's rule on fake reviews, 16 CFR Part 465). Keep the reference's beat and give the line to someone who can say it truthfully, or turn it into a fact about the product.
- A real person's likeness, a brand or a logo follows `slates-content-policy`.
<!-- @end:ad-truth-rules -->
