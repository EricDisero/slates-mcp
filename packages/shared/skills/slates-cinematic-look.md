---
name: slates-cinematic-look
description: Use when a frame should look filmed, not generated (light, exposure, grade, lens, atmosphere, imperfection), or when an image came back too clean or studio-lit. The organized technique catalogue for every image model, and the rule for picking only what the shot needs.
---

# Cinematic look — make a generated frame read as filmed

<!-- @card:start -->
**Image models default to clean, evenly lit and fully exposed.** Real film frames can be dark, flat, murky or burned out. Describe what the camera sees; a mood word or look reference alone does not get you there.

**Look at every reference first.** Write a look reference's grade and imperfections into the prompt: darkness, contrast, black level, colour cast/saturation, softness/noise and subject separation. Never grade cleaner, brighter or higher-contrast than that reference unless asked. Inspect the character sheet's garments. Cite references inline: `the woman from image 1`, `lit and graded like image 2`; never open with a reference-role paragraph. References are optional; these techniques work from words alone.

For a new photographic frame:
- **One physical light system:** source, position, effect on the subject; no light without a source. If using atmosphere, put it in front too.
- **Exposure as it looks:** `close to a silhouette, features only just readable`, not a stop under.
- **Lens name plus effect, every time:** `200mm telephoto`, `the peaks loom huge behind her and melt into soft shapes`.
- **Name every garment and close the foreground:** say exactly what is there; omissions invite reference leakage or invented props.
- **Only what the shot needs:** one light system, at most one exposure, atmosphere and colour choice, one or two composition moves and one moment. Add the imperfections the scene calls for.

A scene reference owns the grade; a look-only reference does not own the new scene's light. For an owned-frame edit, describe only the change and what stays. Never use a released film frame as the edit base; use it as an art-direction brief for a new scene. Use positive descriptions first; one targeted negative is enough where supported. FLUX needs positive wording.

Use query with a technique ID or section, depth "index" to browse, or depth "full" for the catalogue and examples.
<!-- @card:end -->

**Evidence scope:** most Slates receipts come from single generations of one scene on GPT Image 2.5 Sunburst. They show useful directions to test, not reliable success rates or a universal ranking. The research record owns prompts, source links and observations: `business/projects/slates/research/cinematic-look-research.md` in the vault. This skill owns active technique wording. The catalogue checker compares IDs, evidence tags and worked-example bytes.

Image models default to a clean, evenly lit, fully exposed picture. Real film frames are often graded "wrong": underexposed, backlit, silhouetted, burned out, flat or murky. A model only goes there when the prompt says what that looks like. A look reference alone does not get you there; describing the frame does.

## Two routes to a filmed frame

1. **Describe a new frame.** Write the scene and reference roles inline, then the light, exposure, camera and texture choices needed to realize it.
2. **Edit a frame you own.** When a Slates plate or sheet, your own photo or footage, or a Blender render already has the composition and look, describe only the requested changes and what must remain. Example: "Take image 1 and change only the character to the character in image 2." Never use a frame from a released film as the base; a film still is an art-direction brief for route 1.

## The rules

1. **Describe what the camera sees, not the camera setting.** "Her face sits a stop under" was ignored; "close to a silhouette, her features only just readable" landed. Mood words carry little on their own.
2. **Build one physical light system first.** Name the source and its position, what it does to the subject, and rule out light with no source. If the shot needs atmosphere, place it in front of the subject as well as behind. Every source and shadow must agree.
3. **Name the lens and describe its effect, every time you describe a new photographic frame.** A lens named alone changed nothing visible in the summit test; named with its effect, it produced compression and blur.
4. **Use only what the shot needs.** One light system (its consequence clauses count as one), at most one pick each from exposure, atmosphere and colour, one or two composition moves and one moment. Then stop adding. These are drafting limits, not model capability limits.
5. **Name everything a reference could fill.** Every garment, and a closed list of what is in the foreground. Anything left out can come from a reference or be invented. In route 2, preserve the existing inventory and describe only the change.
6. **One targeted negative after a positive description is fine; a list is not.** Follow the model's grammar: FLUX needs positive wording.
7. **A scene reference owns the grade; a look-only reference does not own the light.** With a look-only reference, still write the light direction and visible exposure for the new scene. Name references inline where used, never in an opening role paragraph.
8. **Look at every reference before writing.** First describe a look reference's own grade and imperfections: darkness, contrast, true or muddy blacks, colour cast and saturation, softness and noise, and how much the subject separates from the background. Never grade cleaner, brighter or higher-contrast than the reference unless the user asks. Inspect a character sheet's garments so the prompt names or replaces every one. Without a reference, the same techniques work from words alone.

## Build order

Inspect references first. For a new frame: time/weather → light source and direction → effect on the subject → exposure as it looks → atmosphere in front, if needed → colour → composition and camera placement (lens plus effect) → the moment → kind of picture → inventory (every garment and the closed foreground). Carry the observed reference grade through those choices. Adapt examples to the actual scene; never inherit their props, wardrobe or light by accident.

## Evidence tags

`receipt` measured on Slates generations · `vendor` stated in the model maker's own guide · `practitioner` a published third-party guide or test · `canon` established cinematography, never measured on a model · `untested` reasoning only: try it, then record the result in the research doc and change the tag.

## The catalogue

Each row: the technique, its evidence, what it does to the frame, when to reach for it and when to skip it, and wording written as what the frame looks like.

<!-- @catalogue:start -->

### 1. Exposure and tone — the "graded wrong" frame

| Technique | Evidence | What it does | Reach for · skip | Say |
|---|---|---|---|---|
| `flat-underexposure` | receipt | The whole frame sits in a narrow, dark tonal range; the subject barely separates | A dark, flat look reference or fading light · skip hard contrast, glowing practicals and crushed blacks | "Everything sits in dark, muddy navy blue; nothing is bright or truly black. Her dim face barely separates from the trees; even the focused face is slightly soft, with fine noise in the dark blues." |
| `subject-under-key` | untested | The face is clearly darker than the brightest part of the frame; features read, nothing lights them | Backlit exteriors, sunrise and sunset, window interiors · skip beauty, product, lip-sync close-ups | "Her face is in shadow, clearly darker than the sky behind her; her features are readable but nothing lights them." |
| `near-silhouette` | receipt | A dark shape with edge detail against a bright field | Wides, entrances and exits, solitude · skip shots that depend on recognising the face | "She is close to a silhouette: her face and jacket fall into deep shadow, her features only just readable." |
| `clipped-highlights` | receipt | The sky near the sun, windows and practicals go pure white | Backlit shots, windows, night practicals · skip skies that carry the story, white packaging | "The sky around the sun burns out to white." |
| `dense-shadows-with-ramp` | receipt | Shadows sink to near-black but fall off gradually, and one detail survives in the dark | Night, interiors, a backlit foreground · skip video dark work that already turns to murk | "The shadows are dense and slightly crushed, the foreground rock nearly black, and the light fades into them gradually." |
| `low-key-ratio` | vendor | One side of the face lit, the other falls away with nothing filling it | Interiors, night, close-ups that carry mood · skip bright comedy or commercial register | "Light reaches only the left side of his face; the right side falls into shadow and nothing fills it." |
| `flare-washed-contrast` | receipt | Stray light lifts the blacks and flattens contrast over part of the frame | Shooting toward the sun or a hard practical · skip crisp thriller, neon noir | "Flare washes across the upper half of the frame and lowers the contrast." |
| `lifted-matte-blacks` | canon | The darkest tones sit at charcoal, like a faded print | Daytime melancholy, period looks, overcast · never with `dense-shadows-with-ramp` | "The darkest parts of the frame are a soft charcoal rather than black." |
| `uneven-exposure-across-frame` | untested | Exposure is right for one zone only; one side runs hot, the far side goes dark | Mixed-light interiors, night streets, documentary register · skip clean product shots | "The lamp side of the room is overexposed and the far corner goes nearly black." |

### 2. Light source and direction — one physical system

| Technique | Evidence | What it does | Reach for · skip | Say |
|---|---|---|---|---|
| `name-the-one-source` | receipt | A dominant source with shadows consistent with its distance | When the light needs control · skip when preserving existing light | "The sun is low behind her and off her right shoulder, just above the far peaks." |
| `forbid-the-phantom-key` | receipt | Removes the soft front light models invent on faces | Any backlit, side-lit or practical-lit person · skip flash, frontal sun, beauty work | "There is no light in front of her: no frontal key, no fill." |
| `hard-rim-backlight` | receipt | A bright edge on hair and shoulder while the face stays in ambient light | Golden hour, practicals behind the subject · skip overcast and blue hour, which have no hard source | "A hard orange rim of light traces her hair, the edge of her cheek and one shoulder." |
| `face-in-bounce` | receipt | The unlit side is filled only by coloured light reflected from the surroundings | Backlit exteriors, rooms with coloured walls · skip when the face must read cleanly | "Her face sits in soft, cooler bounce light off the rock." |
| `raking-side-light` | receipt | Light skims a surface so pores, weave and grain show | Close-ups, skin realism, materials · skip when the brief is flattery | "Daylight rakes across her face from one side, so texture catches along the cheekbone and the other side sits in soft shadow." |
| `practicals-only` | vendor | Lights inside the frame are the only light: pools with dark gaps between | Night interiors, cars, bars, kitchens at night · skip when the room must read | "The only light is the open fridge she is standing in; the kitchen behind her is dark." |
| `window-light-falloff` | canon | Bright near the window, then a fast drop across the room | Day interiors, quiet drama · skip big evenly lit spaces | "Grey daylight from the single window on the left; a few steps away the room drops into shadow." |
| `mixed-colour-temperatures` | receipt | Warm and cool sources side by side, uncorrected | Dusk interiors, night streets, cars at night · skip clean commercial | "Warm lamplight on his face; cold blue daylight from the window on the wall behind him." |

### 3. Atmosphere and optics — what sits between the lens and the subject

| Technique | Evidence | What it does | Reach for · skip | Say |
|---|---|---|---|---|
| `haze-in-front` | receipt | Haze, dust or smoke between camera and subject softens the subject's edges | Exteriors, sunbeams, dusty sets · skip crisp product or text shots | "Thin haze crosses the frame in front of her, so her edges are no sharper than the rock beside her." |
| `source-flare` | vendor | Flare from a bright source in the frame | Facing the sun, headlights, stage lights · skip jargon stacks and scenes with no hard source | "The low sun at the edge of the frame throws a flare that crosses in front of her." |
| `halation-on-highlights` | canon | A soft reddish glow bleeds past bright edges | Night practicals, candles, neon, film looks · skip clean digital register | "Bright lights have a soft reddish glow bleeding past their edges." |
| `defocus-as-outcome` | receipt | Planes separate: only the subject is sharp | Close and medium shots · skip wides where the place must read | "On a 200mm telephoto lens only she and the pan are sharp; the background melts into soft shapes and the foreground rock edge falls out of focus." |
| `soft-overall-no-sharpening` | receipt | Lower microcontrast, no halos along edges | Photoreal people, film register · skip product detail and dense text | "The image is slightly soft overall; edges carry no crisp outline." |
| `grain-in-shadows` | vendor | One texture note | Film or low-light register · never stacked with other noise words | "Fine grain is visible in the shadows." |
| `edge-falloff` | canon | The corners sit darker than the centre | Film looks, night · skip flat graphic compositions | "The corners of the frame are darker than the centre." |
| `glass-or-weather-between` | receipt | Rain, smudges or condensation between the lens and the subject | Cars, cafés, storms, observed framing · skip when the face must be sharp | "Seen through a rain-streaked car window; the drops are sharp and she is soft behind them." |

### 4. Colour and grade — preserve the reference unless a change is requested

| Technique | Evidence | What it does | Reach for · skip | Say |
|---|---|---|---|---|
| `warm-muddy` | receipt | Warm but desaturated; whites read cream, greens olive | Dusty or earthy exteriors, fatigue, nostalgia · skip crisp commercial | "The colour is warm and a little muddy rather than clean." |
| `restrained-desaturated` | canon | Muted overall; at most one colour stays strong | Drama, cold or bleak moods · skip joyful or brand-colour work | "Colours are muted and low in saturation; only the red of her jacket holds its colour." |
| `uncorrected-white-balance` | receipt | The colour cast is left in | Phone or documentary register, shade, fluorescents · skip product colour accuracy | "White balance left a little cool and uncorrected; the white mug looks bluish." |
| `tungsten-in-daylight` | canon | The daylight scene renders blue-cyan | Cold mornings, alienation · skip warm romance | "Daylight renders cold and blue, as if the camera were set for indoor lamps; skin looks pale." |
| `sodium-vapour-mono` | canon | Street light collapses colour to amber | Urban night, industrial areas, parking lots · skip scenes that need colour separation | "Orange streetlight flattens every colour to amber and brown; shadows go brown-black." |
| `bleach-bypass-look` | canon | High contrast, drained colour, silvery skin | War, grit, harsh drama · skip warm or intimate scenes | "Colour almost drained out, contrast harsh, skin grey-silver, heavy shadows." |
| `teal-orange` | vendor | Warm skin against teal shadows; the generic blockbuster look | Only when the brief asks for blockbuster register · never as a default | "Skin stays warm while the shadows and sky are pushed toward teal." |
| `era-or-device-register` | vendor | One phrase shifts colour, grain and flash together | Period or amateur looks · one per prompt | "As if shot on 1980s colour film, slightly grainy." |
| `cross-processed` | vendor | Hard colour shifts: cyan shadows, magenta highlights | Music video, fashion, 90s editorial · skip naturalism | "Colours shifted hard, cyan in the shadows and magenta in the highlights." |

### 5. Time and weather presets — bundles of the above, and mutually exclusive

| Technique | Evidence | What it does | Reach for · skip | Say |
|---|---|---|---|---|
| `golden-hour-backlit` | receipt | Sun low behind, long shadows toward camera, rim light, face in bounce, sky near the sun white, warm haze | Warm exteriors · never with noon shadows or overcast softness | "The sun sits just above the ridge behind her; long shadows run toward the camera; a hard rim on her hair; her face in cool bounce; the sky around the sun burns white." |
| `after-sunset` | canon | No direct sun, soft shadowless light, sky fading pink to blue, practicals just on | Quiet exteriors · never with rim light or hard shadows | "The sun has just set; soft shadowless light; the sky fades from pink to deep blue; porch lights have just come on." |
| `blue-hour` | receipt | Cool even light; warm practicals run hot against it; faces dim | Streets and cafés at dusk · never with a warm key on the face | "Deep blue dusk light, almost no shadows; the café windows glow hot orange; her face is dim and blue." |
| `hard-noon` | practitioner | Bleached sky, short hard shadows, squinting | Heat, desert, exhaustion · skip anything that must flatter | "Midday sun straight overhead; tiny hard shadows under her brows and chin; she squints." |
| `overcast-flat` | practitioner | No shadows, low contrast, honest skin | Plain daylight, street realism · never with rim light or flare | "Flat grey overcast light, no shadows, low contrast, colours slightly dull." |
| `night-practicals` | canon | Pools of light, dark gaps, colour casts, blooming highlights | Night streets and interiors · never with "evenly lit" | "The street is dark between the orange streetlights; he is lit only when he passes under one." |
| `firelight` | canon | Warm flicker from below, fast falloff, black past a few metres | Campfires, candles · never with daylight fill | "The campfire is the only light: warm and flickering from below, their faces half lit, everything beyond the circle black." |
| `moonlight-day-for-night` | canon | Cool, low saturation, one faint hard shadow direction, sky darker than the ground | Night exteriors · skip when warm practicals dominate | "Cold blue moonlight from one side; faint hard shadows; colour almost gone; faces only just readable." |
| `rain-wet-night` | canon | Wet surfaces smear reflections; rain shows only where it passes a light | Urban night · rain across the whole frame, never in one corner | "Rain shows as bright streaks where it passes the streetlight; the wet asphalt reflects the lights as long smears." |
| `fog-or-dust` | canon | Depth falls off to grey; figures layer by distance | Mystery, scale · never with crisp distant detail | "Fog swallows everything past the second streetlight; the far figures are pale grey shapes." |

### 6. Composition and camera placement

| Technique | Evidence | What it does | Reach for · skip | Say |
|---|---|---|---|---|
| `dirty-foreground-occlusion` | receipt | An out-of-focus object near the lens covers part of the frame | Anything that should feel observed rather than staged · only objects that belong in the space | "The edge of a pine branch crosses the left third of the frame, close to the lens and completely out of focus." |
| `off-centre-cropped-subject` | practitioner | The subject sits near an edge, partly cut by the frame | Candid and documentary register · skip deliberate symmetry | "She sits in the right third of the frame; her elbow is cut off by the edge." |
| `negative-space` | canon | A small subject in a large empty area | Isolation, scale · in a video plate give the empty area texture, or it moves with the foreground | "She is a small figure at the bottom right; the rest of the frame is pale, cloud-streaked sky." |
| `frame-within-frame` | canon | A doorway, window or vehicle surrounds the subject | Observed feel, confinement · skip when it hides the action | "Seen through the open barn door; the dark door frame surrounds her on three sides." |
| `over-the-shoulder-foreground` | vendor | A foreground head or shoulder, dark and soft | Dialogue, two-person scenes | "The back of his head and shoulder fill the left edge, dark and out of focus; she faces him, sharp." |
| `compression-as-outcome` | receipt | The long-lens look: the background looms huge and close | Making a background loom, crowds, heat haze · skip intimate interiors | "Shot from far away on a 200mm telephoto lens, the peaks loom huge and close behind her, stacked right up against her shoulders." |
| `camera-height` | receipt | Ground level, hip height or overhead, picked on purpose | Every shot · eye level only by choice | "The camera sits on the ground by the stove, looking up at her past the pan." |
| `grabbed-framing` | untested | Horizon slightly off, framing a beat late | Documentary or UGC register · skip composed cinema | "The horizon tilts slightly and the framing is a little late; her head is near the top edge." |
| `reflection-partial` | receipt | The subject seen in glass, steel or a puddle | Night, cities, variety across a set · never a bathroom mirror | "We see her only as a reflection in the dark shop window, overlapped by the street behind the glass." |

### 7. Texture, wardrobe and set

| Technique | Evidence | What it does | Reach for · skip | Say |
|---|---|---|---|---|
| `name-the-capture-context` | receipt | Says what kind of picture this is, instead of listing flaws | Every photoreal shot · never a flaw inventory, which reads as tokens and turns plastic | "A frame from a film shot on location, not a studio portrait." |
| `skin-under-real-conditions` | vendor | Skin carries the environment: wind, sun, sweat | People in real conditions · never a stack of pore and blemish words | "Wind-chapped cheeks and a sunburnt nose after a day on the mountain; skin shiny with sweat at the hairline." |
| `hair-state` | receipt | Flyaways, wind, strands stuck to the forehead | Weather, action, fatigue · vary the state, never the style that carries identity | "Wind has pulled strands loose across her face." |
| `wardrobe-wear` | vendor | Creases, dust, fading | Lived-in characters · skip fashion hero shots | "Her jacket is creased at the elbows and faded at the seams; dust on the knees." |
| `full-wardrobe-spec` | receipt | Names top, legwear and footwear so a reference cannot fill the gap | Any shot built from a character reference · not optional | "Grey hiking jacket zipped up, dark hiking trousers, scuffed brown boots." |
| `closed-prop-list` | receipt | A positive, closed inventory of what is in the frame | Any frame where the model adds junk · never a "no extra props" list | "The only things on the rock are the stove and the pan." |
| `lived-in-wear-on-named-things` | practitioner | Wear goes on objects already named, never as new objects | Sets that should feel used · never "add clutter" | "The pan is blackened underneath and the rock around the stove is stained with old soot." |
| `material-specificity` | vendor | Names the physical material | Hero objects · never a generic noun | "A dented enamel mug, a scratched aluminium pot, a waxed-cotton jacket going pale at the seams." |

### 8. Moment, performance and motion

| Technique | Evidence | What it does | Reach for · skip | Say |
|---|---|---|---|---|
| `caught-mid-action` | receipt | The action is under way and the camera goes unnoticed | People, by default · skip deliberate portraits and address-the-lens beats | "Her right hand works a wooden spatula in the pan mid-stir." |
| `eyeline-off-lens` | receipt | The eyes are on the task, another person or out of frame | Images and B-roll · never a lip-sync beat, where eyes on the lens are the point | "She looks down at the pan." |
| `unresolved-expression` | receipt | Not a stock smile: squinting, chewing, tired, mid-thought | Realism · skip brand-joy beats | "She squints against the glare, jaw set, tired." |
| `motion-blur-on-the-mover` | practitioner | Only the moving part blurs | Hands, tools, hair, passing vehicles · never on text or a face that must read | "Her hand with the spoon is a slight blur of movement; the pan and the rock are sharp." |
| `focus-slightly-missed` | untested | Focus landed just behind the subject | Documentary register · skip identity-critical shots | "Focus landed on the rock just behind her; her face is a touch soft." |
| `handheld-operator-body` | receipt | For video: write the body holding the camera, not the path | Documentary, UGC, tension · skip locked-off formal shots | "Handheld, the operator breathing; the frame sways slightly, drifts off her and corrects back." |
| `weight-and-consequence` | practitioner | For video: mass moves through the body and the world reacts | Any physical action · skip static dialogue | "She shifts her weight onto her back foot as she lifts the heavy pan; the stove wobbles." |
| `frame-zero` | receipt | In a still that feeds video, the event has not happened yet | Every image-to-video plate · never an aftermath plate | Describe the moment just before the event: the pole still straight, the glass still whole. |

<!-- @catalogue:end -->

## Techniques that clash

- **`near-silhouette` against a recognisable face or lip-sync.** On identity-critical shots use `subject-under-key` with `face-in-bounce`; keep silhouettes for wides.
- **`dense-shadows-with-ramp` against murk.** Always say the light falls off gradually and keep one detail readable in the dark. On video dark work keep the subject readable; `slates-blocking-to-prompt`'s "no crushed blacks" is scoped to that lane.
- **`lifted-matte-blacks` against `dense-shadows-with-ramp`.** Pick one.
- **One colour-temperature story.** `warm-muddy` does not go with `tungsten-in-daylight` or a cool `uncorrected-white-balance`.
- **Presets exclude each other.** Golden hour has no noon shadows; overcast has no rim light or flare; `practicals-only` has no even room light.
- **Haze or flare against readable text or product.** Keep the atmosphere away from the text, or drop it.
- **`defocus-as-outcome` against a place that must read.** Keep it for close and medium shots.
- **Motion blur, handheld sway or missed focus against text, lip-sync or identity.** Keep them off the face and off the text.
- **`closed-prop-list` against `lived-in-wear-on-named-things`.** Wear goes on the named objects, never as new ones.

## On video

- **The grade lives in the still.** A motion prompt describes how the light behaves as things move — the flare slides as the camera turns, haze drifts across the foreground, her face stays in shadow as she turns — and preserves the still's grade unless the user requests a change.
- **Lens and film-stock names translate; they do not paste.** The rule and ByteDance's own wording: `slates-prompting-seedance` → "Don't cross-pollinate image-model syntax".
- **A negative-prompt field can cancel a technique.** Never suppress in `negative_prompt` something the prompt asks for (Kling: `slates-prompting-kling-v3`).

## Model notes

- **GPT Image 2.5.** Ask for a real photograph or film still outright. In the recorded summit tests, it tended to brighten faces, clean up colour and add props; visible-outcome wording gave more control than gear names alone. References route through its edit endpoint.
- **Nano Banana 2 and Pro.** Google recommends named cameras, film eras, chiaroscuro lighting and positive framing, so gear names are a sanctioned lever here: still add what they do to the picture. The recorded Nano Banana Pro edits changed more of the frame than intended; scope each requested change and name what should stay.
- **FLUX.2 Max.** No negative prompt at all, and word order is weight, so put the light system early. Its own examples use crushed shadows, blown highlights and era looks.
- **Seedream 5 Lite.** Keep it short: pick fewer techniques to fit its prompting guide's roughly 100-word ceiling. See `slates-prompting-seedream-5-lite`.

## Worked examples

**Route 1, IMG-A197 (Sunburst, 2026-09-15).** Image 1 is the character identity sheet, image 2 a look reference. One light system, one exposure decision, the wardrobe and the foreground named. Eric: *"just so well done."*

<!-- @example:img-a197:start -->
```text
A film still shot on location, lit and graded like image 2. The woman from image 1 cooks on a rocky summit high in the Rockies at golden hour. She stands facing camera behind a stainless steel frying pan of sliced vegetables on a camp stove on the rock in the lower foreground, framed from mid-thigh up. Her right hand works a wooden spatula in the pan mid-stir, her left rests on the pan handle. She looks down at the pan with a slight smile. Long wavy blonde hair down. Grey hiking jacket zipped up, the word "SLATES" once in small plain letters on the left chest, and dark hiking trousers. The only things on the rock are the stove and the pan. Behind her: pine tops, a deep valley and snow-capped peaks running to the horizon.

The sun sits just above the far peaks behind her right shoulder and the whole frame is exposed for that sky. She is close to a silhouette: her face and jacket fall into deep shadow, her features only just readable, lit by nothing but a faint warm bounce off the rock. A hard orange rim of light traces her hair, the edge of her cheek and one shoulder. The sky around the sun burns out to white, flare washes across the upper half of the frame and lowers the contrast, and steam off the pan glows where the sun comes through it. The shadows are dense and slightly crushed, the rock in the foreground is nearly black, and the colour is warm and a little muddy rather than clean. No other text in the image.
```
<!-- @example:img-a197:end -->

**Route 1 with a lens, IMG-A198 (Sunburst, 2026-09-15).** The same frame, with the lens named and its effect described. Real compression and depth of field came back.

<!-- @example:img-a198:start -->
```text
A film still shot on location from far away on a 200mm telephoto lens, lit and graded like image 2. The woman from image 1 cooks on a rocky summit high in the Rockies at golden hour. She stands facing camera behind a stainless steel frying pan of sliced vegetables on a camp stove on the rock in the lower foreground, framed from mid-thigh up. Her right hand works a wooden spatula in the pan mid-stir, her left rests on the pan handle. She looks down at the pan with a slight smile. Long wavy blonde hair down. Grey hiking jacket zipped up, the word "SLATES" once in small plain letters on the left chest, and dark hiking trousers. The only things on the rock are the stove and the pan.

The long lens compresses the distance: the snow-capped peaks loom huge and close behind her, stacked right up against her shoulders, and they melt into soft out-of-focus shapes. Only she and the pan are sharp. The pine tops between her and the peaks are a smear of dark green, and the foreground rock edge falls out of focus too.

The sun sits just above the far peaks behind her right shoulder and the whole frame is exposed for that sky. She is close to a silhouette: her face and jacket fall into deep shadow, her features only just readable, lit by nothing but a faint warm bounce off the rock. A hard orange rim of light traces her hair, the edge of her cheek and one shoulder. The sky around the sun burns out to white, flare washes across the upper half of the frame and lowers the contrast, and steam off the pan glows where the sun comes through it. The shadows are dense and slightly crushed, the rock in the foreground is nearly black, and the colour is warm and a little muddy rather than clean. No other text in the image.
```
<!-- @example:img-a198:end -->

**Route 1, platform revision (IMG-A200 and IMG-A204).** IMG-A199 followed its written hot lamp and crushed blacks, but Eric wanted the reference's flatter, darker, softer grade. This exact revision subsequently produced A200 and A204 using neutral identity sheets and the original look reference. Eric preferred A204 to the scene-reference remixes A201–A203; A203 and A204 used the same model and quality settings. Prompt and references changed together, so their individual contributions are not isolated.

<!-- @example:platform-flat-untested:start -->
```text
A film still shot on location from a distance on an 85mm lens, lit and graded like image 2. The young woman from image 1 waits alone at the far end of an empty country train platform at blue hour. She stands side-on to the camera in the right third of the frame, framed from the chest up, looking down the empty track toward where a train would come from, her lips slightly parted. A dark wool coat hangs open over a grey hooded sweatshirt, hood down. The wind has pulled a few strands of hair loose across her cheek. The only things near her are the edge of the concrete platform and a single old lamp post, its lamp not yet switched on.

The sun is gone and the light is almost gone with it. The whole frame is underexposed and flat: everything sits in a narrow range of dark, muddy navy blue, nothing in it is bright and nothing is truly black. The brightest thing in the picture is the dull grey-blue sky above the trees. Her face is lit only by that weak sky from behind and to her left, so it is dim and blue and barely separates from the dark trees behind her; her features are there, but you have to look for them. There is no light in front of her, no rim of light on her hair, no catchlight in her eyes, and no contrast anywhere to make her stand out.

The long lens compresses the distance: the trees sit close behind her as soft dark shapes, and only her face is in focus, and even that is slightly soft. It looks like a camera pushed to its limit in low light: low contrast, a little murky, fine noise in the dark blues, and colour drained to a cold blue-grey. No text anywhere in the image.
```
<!-- @example:platform-flat-untested:end -->

**Route 2, IMG-A184 (Sunburst, 2026-09-09).** Image 1 was a finished blue-hour frame, image 2 a character. The whole prompt: *"take this image 1 and just change the character to the character in image 2"*. Composition, grade, light and depth of field held exactly. That base frame was not one Slates owns, so the receipt proves the technique, not a shippable workflow: use your own frame.

## Adding or changing a technique

1. Record the evidence first: a row in the research doc's technique table, with its tag and source.
2. Add or change the row here, with the same id and the same tag.
3. Run the build. The catalogue check fails until both files agree.
