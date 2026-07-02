---
name: slates-style-prompting
description: Per-style prompting depth — how photoreal, anime, painterly, and 3d-render are prompted DIFFERENTLY on Seedance 2.0 vs Kling V3 vs Nano Banana 2, and the style-routing recipe (reference-first, styled start-frame → i2v). Load when the user asks for any visual style ("make it anime", "painterly look", "like a Pixar film") or when style consistency across shots matters.
---

# Per-style prompting (photoreal · anime · painterly · 3d-render)

The style library (`slates_create_style` / the app's style ids) defines what each style IS. This guide is how to PROMPT each style per model. Derived from `research/style-prompting-research.md` (second-brain) — claims marked *(hypothesis)* are untested; don't present them to users as fact.

## The four ground rules (all styles)

1. **Reference beats adjectives.** A style reference image outperforms prose style instructions. If the user has an on-style image — or you can cheaply generate one — attach it and let the default `inherit` behavior match it. Prose styling is the fallback.
2. **Style lives in ONE slot per model:**
   - **Nano Banana 2** — narrative prose; the style is the opening framing of the sentence ("A hand-drawn 2D anime cel illustration of…"), never a comma tag.
   - **Seedance 2.0** — the 8-part formula reserves "visual style" (slot 6) and "image quality" (slot 7). One clause each. Don't scatter style words through the action text.
   - **Kling V3** — prose scene direction; style rides the lighting/style tail of Scene → Subject → Action → Camera → Lighting/Style. Tag soup underperforms badly.
3. **Multi-shot consistency = the SAME style clause, byte-identical, in every shot's prompt** (plus shared references). Paraphrasing the style clause between shots invites drift.
4. **The styled start-frame is the cheapest reliable style lever for video.** Compose the styled frame in NB2 (cheap), hand it to Seedance/Kling image-to-video, and describe only what CHANGES (motion). Never re-describe the style in the i2v prompt — the frame already encodes it.

Never stack style buzzwords ("ARRI ALEXA, 35mm, film grain, depth-of-field mastery…"). One or two register tokens maximum — piles of specs dull the image.

## Photoreal

- **NB2:** never the literal word "photorealistic". Describe *a real photograph*: natural skin texture and imperfection, motivated lighting, one lens/film register ("shot on a 50mm, soft window light"). Photographic composition terms: wide-angle / macro / low-angle.
- **Seedance:** put "sharp focus, natural color, high detail" in the image-quality slot and always include a lighting clause. Keep motion slow and coherent — fast/burst action is the #1 quality killer and reads most fake in photoreal.
- **Kling:** the photoreal-PEOPLE lane — convincing acting, dialogue, lip-sync. It breaks on close-up hands, fine fluids, and crowds beyond ~5 faces: route those beats to Seedance or reframe.
- **Faces on Seedance:** photoreal humans trigger the face-tier routing (AI face vs consented real face — see slates-prompting-seedance §Faces). Set the face flags honestly; never skip them to save credits.

## Anime

- **NB2:** open with the medium — "A hand-drawn 2D anime cel illustration of…" — then normal narrative Subject/Setting/Action. Clean line art, flat-shaded color, expressive eyes. NB2 has no negative prompt: phrase exclusions positively ("flat cel shading with uniform focus", not "no depth of field").
- **Seedance:** visual-style slot = "2D anime style, clean line art, flat cel shading". The slow/coherent-motion preference still applies — burst sakuga actions are the same instability trap as in photoreal.
- **Kling:** weakest anime lane (its strength is live-action-like acting); expect style drift on long prose-only shots. Prefer ground rule 4: NB2 anime start-frame → i2v with a motion-only prompt. *(hypothesis: refs hold Kling's anime better than prose — verify before promising.)*
- Anime faces drift under multiple references faster than photoreal — the named-entity two-sheet doctrine applies unchanged.

## Painterly

- **NB2:** medium + technique in the style framing: "digital concept-art painting, visible brushwork, painted edges". At most ONE school/era register ("classic gouache illustration") — a register, not an artist-name pile.
- **Video:** the least-supported style lane. Use ground rule 4 (painterly NB2 frame → i2v, motion-only prompt) and expect some cleanup of painterliness over the clip *(hypothesis — set user expectations, don't promise a perfectly painterly clip)*.
- Camera language still applies — painterly ≠ static; "slow push-in" works the same.

## 3D render

- **NB2:** name the lineage register in the style framing: "stylized 3D render, soft global illumination, subsurface skin". Lighting vocabulary (GI, rim light) is unusually load-bearing for the 3D read.
- **Seedance:** the physics/effects lane flatters 3D content — visual-style slot "stylized 3D animation", image-quality slot "clean render, high detail".
- **Kling:** same start-frame preference as anime.
- *(hypothesis)* An engine token ("Unreal Engine 5 render") may help NB2; if used, ONE token, style slot only — never on Seedance where spec-stuffing hurts.

## Routing recipe (what to actually do)

1. Style reference available → attach it, rely on inherit. Done.
2. No reference, image request → styled NB2 prose per the section above.
3. No reference, video request → NB2 styled start-frame first, then i2v with motion-only prompt. Direct styled text-to-video is the fallback when a start frame doesn't fit (e.g. dialogue-first Kling shots).
4. Multi-shot run → byte-identical style clause per shot + shared references.
