---
name: slates-style-prompting
description: "Translate a visual-style brief into model-specific image or video direction and maintain the look across shots. Covers photoreal, anime, painterly and 3D styles, references and optional start-frame control."
---

# Per-style prompting (photoreal · anime · painterly · 3d-render)

<!-- @operative:start -->
**Operative summary.**
- Bind references inline where they contribute, and describe light and exposure when a reference carries look only. (§ The four ground rules (all styles))
- Write in each model's own language, with the style as one framing clause, and never stack style buzzwords; use one or two register tokens at most. (§ The four ground rules (all styles))
- Keep the look consistent across shots by reusing references and stable descriptions, and treat a styled start frame as one video control. (§ The four ground rules (all styles))
- For photoreal, describe a real photograph with natural texture and motivated light, and keep motion slow and coherent. (§ Photoreal)
- For anime, painterly and 3D styles, open with the medium; for video in the weaker lanes, make a styled start frame and prompt motion only. (§ Anime; § Painterly; § 3D render)
- Route by the brief: inspect any style reference, use the current image default, and let `slates-model-selection` own model choice. (§ Routing recipe (what to actually do))
<!-- @operative:end -->

The style library (`slates_create_style` / the app's style ids) defines what each style IS. This guide is how to PROMPT each style per model. Derived from `research/style-prompting-research.md` (second-brain) — claims marked *(hypothesis)* are untested; don't present them to users as fact.

## The four ground rules (all styles)

1. **Assign references where they contribute.** Describe the scene with inline bindings, such as "the woman from image 1, lit and graded like image 2." Preserve an existing scene reference when its look should stay. A look-only reference may need light and exposure described for the new scene; prose and references can work together.
2. **Use each model’s language, without imposing a fixed prompt template:**
   - **Nano Banana 2.1** — narrative prose; the style is the opening framing of the sentence ("A hand-drawn 2D anime cel illustration of…"), never a comma tag.
   - **Seedance 2.0** — the 8-part formula reserves "visual style" (slot 6) and "image quality" (slot 7). One clause each. Don't scatter style words through the action text.
   - **Kling V3** — prose scene direction; style rides the lighting/style tail of Scene → Subject → Action → Camera → Lighting/Style. Tag soup underperforms badly.
3. **Keep the intended look consistent across shots.** Reuse relevant references and stable descriptions, adapting the wording to each scene.
4. **A styled start frame is one video control.** Generate it with the image seat suited to the brief, then describe the motion. Preserve its look unless the user wants the light or grade to change.

Never stack style buzzwords ("ARRI ALEXA, 35mm, film grain, depth-of-field mastery…"). One or two register tokens maximum — piles of specs dull the image.

## Photoreal

- **Nano Banana:** never the literal word "photorealistic". Describe *a real photograph*: natural skin texture and imperfection, motivated lighting, one lens/film register ("shot on a 50mm, soft window light"). Photographic composition terms: wide-angle / macro / low-angle.
- **Seedance:** put "sharp focus, natural color, high detail" in the image-quality slot and always include a lighting clause. Keep motion slow and coherent — fast/burst action is the #1 quality killer and reads most fake in photoreal.
- **Kling:** the photoreal-PEOPLE lane — convincing acting, dialogue, lip-sync. It breaks on close-up hands, fine fluids, and crowds beyond ~5 faces: route those beats to Seedance or reframe.
- **Faces on Seedance:** photoreal humans trigger the face-tier routing (AI face vs consented real face — see slates-prompting-seedance §Faces). Set the face flags honestly; never skip them to save credits.

## Anime

- **Nano Banana:** open with the medium — "A hand-drawn 2D anime cel illustration of…" — then normal narrative Subject/Setting/Action. Clean line art, flat-shaded color, expressive eyes. Nano Banana has no negative prompt: phrase exclusions positively ("flat cel shading with uniform focus", not "no depth of field").
- **Seedance:** visual-style slot = "2D anime style, clean line art, flat cel shading". The slow/coherent-motion preference still applies — burst sakuga actions are the same instability trap as in photoreal.
- **Kling:** weakest anime lane (its strength is live-action-like acting); expect style drift on long prose-only shots. Prefer ground rule 4: Nano Banana anime start-frame → i2v with a motion-only prompt. *(hypothesis: refs hold Kling's anime better than prose — verify before promising.)*
- Anime faces drift under multiple references faster than photoreal; the named-entity one-sheet doctrine applies unchanged.

## Painterly

- **Nano Banana:** medium + technique in the style framing: "digital concept-art painting, visible brushwork, painted edges". At most ONE school/era register ("classic gouache illustration") — a register, not an artist-name pile.
- **Video:** the least-supported style lane. Use ground rule 4 (painterly Nano Banana frame → i2v, motion-only prompt) and expect some cleanup of painterliness over the clip *(hypothesis — set user expectations, don't promise a perfectly painterly clip)*.
- Camera language still applies — painterly ≠ static; "slow push-in" works the same.

## 3D render

- **Nano Banana:** name the lineage register in the style framing: "stylized 3D render, soft global illumination, subsurface skin". Lighting vocabulary (GI, rim light) is unusually load-bearing for the 3D read.
- **Seedance:** the physics/effects lane flatters 3D content — visual-style slot "stylized 3D animation", image-quality slot "clean render, high detail".
- **Kling:** same start-frame preference as anime.
- *(hypothesis)* An engine token ("Unreal Engine 5 render") may help Nano Banana; if used, ONE token, style slot only — never on Seedance where spec-stuffing hurts.

## Routing recipe (what to actually do)

1. Style reference available → inspect it, bind its look role, and describe any light or exposure needed in the new scene.
2. Image request → use the current image default unless the brief supplies a reason for another seat; load that model's craft. The Nano Banana examples above apply when Nano Banana is selected, not to every image model.
3. Video request → choose a styled start frame when composition, exact text or an approved look must hold. Use the image seat suited to that job, then the chosen video model's motion and sound grammar. Direct styled text-to-video is also valid when it serves the brief; an image pass is not mandatory.
4. Multi-shot run → retain stable style references and descriptors, adapting action, light and model-specific wording to each scene.

`slates-model-selection` and the current catalogue own routing. These style techniques supply craft after the production choice; no user needs to select a skill or workflow.
