// Canonical character-sheet prompt content.
//
// ARCHITECTURE (locked by Eric 2026-07-21): ONE identity sheet per character.
// A dominant off-frontal chest-up portrait carries the face; two full-body
// panels (front + back) carry build, wardrobe and hair. The result is the
// character's one canonical identity reference.
//
// Why one sheet and not two — three arguments, none of which depend on a
// comparison generation:
//   1. Reference-cap economics. Every character uses one reference slot.
//   2. One authoritative face avoids averaging competing renderings.
//   3. One generation means one asset to inspect and bind.
//
// EXPRESSION IS A SLIGHT SMILE WITH THE TEETH JUST VISIBLE (Eric, 2026-07-30,
// replacing the v1 neutral default). The v1 note called neutral's missing
// dental information a "known cost, revisit only if a receipt shows invented
// teeth" — this is that revisit, and it arrived from the other direction:
// Eric hand-edited a sheet to smiling and the result "worked really well".
//
// WHY: a closed-mouth portrait carries ZERO dental information, so every
// downstream shot where the character smiles has to invent teeth, and teeth are
// person-specific and stable — inventing them is a highly visible identity
// break. The smile also records the nasolabial fold, the eye crinkle and where
// the cheeks sit raised, none of which a neutral mouth shows.
//
// THE COST, NAMED: `references-read-literally.md` says a baked-in property is
// read as a property of the SUBJECT, so a smile risks a character who smiles
// through a beat that asked for grief. Survivable because the 2026-06-26
// doctrine still holds — the user's prompt owns expression, and downstream
// prompts name an emotional register on every delivered line.
//
// SLIGHT, never a grin: a broad smile deforms eyes, cheeks and mouth enough
// that the model has to un-deform it for any neutral shot.
//
// NON-HUMANS ARE CARVED OUT (Eric, 2026-07-30). A smile clause on a horse, a
// dragon or a robot produces bared teeth. Non-human characters get a natural
// neutral expression instead. NOTE THE SCOPE DIFFERS from the A-pose carve-out
// beside it: that one is anatomical (quadruped / non-bipedal), this one is
// about having a human mouth — so a BIPEDAL robot or humanoid alien is covered
// by this carve-out and not by that one. Two carve-outs, deliberately, because
// one predicate does not fit both.
//
// Receipt strength: N=1, and it is a "looked right" judgement, not a scored
// identity-hold comparison against the neutral sheets. HOW YOU'D KNOW THIS IS
// BEATEN: a character smiling through a beat prompted angry or grieving, or
// identity holding measurably worse than neutral did. Reverting is one line.
//
// THE FRONT PANEL IS HEADLESS (shipped 2026-07-22, receipt-gated). The face is
// cropped off the front body panel, taking competing face renderings 2 → 1.
// ONLY the face — the body, neck, arms and hands render normally; see the
// 2026-07-30 (b) note below for what happens when that isn't said. The BACK
// panel keeps its head: it has no
// face to compete with the portrait, and it is the only panel where hair fall
// reads. The rule is "kill every competing rendering of the FACE", not "kill
// every head".
//
// Two things had to be true before this shipped, and both were verified on
// real generations (research/model-prompting-research.md, "Head-crop receipt"):
//   1. It is prompt-reachable. NB2 renders a clean invisible-mannequin panel
//      with no refusal. THIS DEPENDS ON THE PHRASING: it is framed as FRAMING
//      ("cropped at the collarbone, invisible-mannequin presentation"), a
//      standard e-commerce genre with deep training data. Never phrase it as
//      removal or decapitation.
//
//      2026-07-30 (a) — THE PHRASING NARROWED, and the receipt above was
//      MODEL-SCOPED. "framed from the collarbone down with the head not shown"
//      passed NB2 and is a HARD 422 on gpt-image-2: fal returns
//      content_policy_violation with loc ["body","prompt"], so the text is
//      rejected before any image is read. Diagnosis: "the head not shown"
//      states an anatomical ABSENCE — a headless human body — which reads as
//      gore to OpenAI's classifier. "cropped at the collarbone" states a
//      CAMERA fact and carries the same instruction.
//      RULE: describe an exclusion as a framing choice, never as a missing
//      body part. The "invisible-mannequin" genre anchor is KEPT because the
//      NB2 receipt says it is what makes the panel reachable there.
//      HOW YOU'D KNOW THIS IS BEATEN: a front panel that comes back with a
//      head on it, meaning "cropped at the collarbone" alone is too weak
//      without the absence clause. If that happens, the fix is a
//      model-conditional phrasing, not restoring the 422.
//
//      2026-07-30 (b) — THE GENRE ANCHOR HAS TO BE SCOPED TO THE FACE, and
//      this one cost real generations. "an invisible-mannequin presentation
//      WHERE THE CLOTHING HOLDS ITS OWN SHAPE" is the e-commerce genre stated
//      in full — and the full genre means NO BODY AT ALL, an empty outfit
//      photographed on nothing. Eric's sheets came back with the skin removed:
//      no neck, no hands, no forearms, a floating garment. The genre anchor
//      was doing exactly what it says.
//      Eric's replacement, verbatim, and the default since: "an invisible-
//      mannequin presentation with just the face cropped out." Same anchor
//      (still what makes the panel reachable on NB2), bounded so the only
//      thing missing is the face.
//      RULE: a genre anchor imports the WHOLE genre unless you bound it —
//      name what STAYS, not just what goes. This is the same failure shape as
//      (a) from the opposite side: (a) was an exclusion phrased too
//      anatomically, (b) was an exclusion scoped too widely.
//      HOW YOU'D KNOW THIS IS BEATEN: front panels returning with a head on
//      them — "just the face cropped out" would then be reading as a face
//      edit rather than a crop, leaving the collarbone clause to carry it
//      alone.
//   2. The literal-reading law does NOT fire on it. This was the real risk and
//      it is ours, not the source corpus's: `references-read-literally.md` says
//      a baked-in property is read as a property of the SUBJECT, and this panel
//      renders headlessness as CONTENT (empty plate above the collar), not as
//      photographic framing. The predicted failure was a headless or
//      neck-glitched downstream character. A Kling shot from a bound sheet came
//      back head intact, identity holding, wardrobe held — in a MULTI-CHARACTER
//      frame, which is the scope ByteDance's averaging failure lives in
//      (ModelArk :1948-1994), so it is the hardest form of the test.
//
// Receipt strength: N=1 character, decisive for filterability, strong for the
// literal-reading risk, NOT a scored V2-vs-V3 comparison — nobody measured
// whether 2 → 1 improves identity hold, only that it doesn't break. HOW YOU'D
// KNOW THIS IS BEATEN: a downstream character generating headless,
// neck-glitched, or with a floating collar; or a scored run where heads-kept
// holds identity better. Reverting is a one-line change here — no migration,
// no data touched. Quadrupeds are carved out below (a horse has no collarbone).
//
// SOURCE OF TRUTH. The desktop imports these builders through
// `slate/src/shared/prompts/character-sheet.ts` (a thin re-export since 1.2.1)
// — there is no desktop prompt mirror to update. Map:
// second-brain business/projects/slates/product/prompting-ssot.md

import {
  IDENTITY_CRAFT_CLAUSE,
  IDENTITY_LIGHTING_CLAUSE,
  INHERIT_SOURCE_STYLE,
} from './reference-rules.js'
import { renderStyleInstruction } from './style-library.js'

/**
 * The identity sheet's panels. The portrait is FIRST and DOMINANT — every
 * detail the downstream model will ever know about the face comes from those
 * pixels, so it gets the resolution. The body panels exist for build,
 * proportion, wardrobe and hair, not for the face.
 *
 * The front panel is headless and the back panel KEEPS its head — that
 * asymmetry is the whole rule. A front-facing body panel renders a ~40px face
 * that cannot match the portrait's, so the sheet would carry two competing
 * identities and the model averages them. A back view has no face to compete
 * with, and it is the only panel where hair fall reads. See the header comment
 * for the receipt, and for why the phrasing must stay FRAMING rather than
 * removal and must be SCOPED TO THE FACE rather than to the whole body.
 */
export const CHARACTER_SHEET_PANELS_DESC =
  'a large chest-up portrait on the left at a three-quarter angle (never dead-on), ' +
  'a full-body front view in a relaxed A-pose in the centre, cropped at the collarbone — ' +
  'an invisible-mannequin presentation with just the face cropped out, ' +
  'and a full-body back view on the right with the head and hair fully visible'

/** Panel identifiers, in sheet order. */
export const BODY_POSE_LABELS = ['portrait', 'front', 'back'] as const

// The sheet's style directive: a user transform REPLACES the inherit-source
// instruction (so the model isn't told to both preserve the medium AND change
// it); otherwise inherit the source medium.
function styleDirective(userStyle?: string | null): string {
  return renderStyleInstruction(userStyle).trim() || INHERIT_SOURCE_STYLE
}

/**
 * The character identity sheet — one asset, three panels.
 *
 * @param userStyle optional natural-language style transform (e.g. "make her a real person")
 */
export function buildCharacterIdentityPrompt(userStyle?: string | null): string {
  return (
    `A single character identity reference sheet of one character, three panels side by side on one plate: ` +
    `${CHARACTER_SHEET_PANELS_DESC}. ` +
    `The portrait is the largest panel and occupies roughly a quarter to a third of the sheet — it is the sole authority for the face, so render it at maximum facial detail. ` +
    `No second rendering of the face anywhere on the sheet. ` +
    `A slight natural smile with the teeth just visible, and identical appearance, wardrobe and hair across all three panels. ` +
    `${styleDirective(userStyle)} ${IDENTITY_LIGHTING_CLAUSE} ${IDENTITY_CRAFT_CLAUSE} ` +
    `For non-human characters, use a natural neutral expression instead of a smile. ` +
    `For quadruped or non-bipedal characters, replace the A-pose with a natural standing stance, show the whole animal including the head on both body panels, and keep the same three-panel layout. ` +
    `No text, no labels, no captions, no panel borders.`
  )
}

/** @deprecated Use buildCharacterIdentityPrompt. */
export const buildCharacterTurnaroundPrompt = buildCharacterIdentityPrompt
