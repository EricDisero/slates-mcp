// Canonical character-sheet prompt content.
//
// ARCHITECTURE (locked by Eric 2026-07-21): ONE identity sheet per character.
// A dominant off-frontal chest-up portrait carries the face; two full-body
// panels (front + back) carry build, wardrobe and hair. The sheet binds to the
// character's TURNAROUND slot and the expression slot is left null.
//
// Why one sheet and not two — three arguments, none of which depend on a
// comparison generation:
//   1. Reference-cap economics. Every `@character` mention pushes BOTH bound
//      sheets into one reference group, so a two-sheet character costs TWO
//      reference slots on every generation. Against real caps that is brutal:
//      Kling 3.0 takes 4 ingredients (2 characters, zero room for an
//      environment), NB2 has 4 character slots, Seedance 9. One sheet each
//      DOUBLES the cast you can stage on every model we route to.
//   2. Competing face renderings drop 6 → 2. The old pair sent three large
//      portraits plus three postage-stamp faces (turnaround front + both
//      profiles). The model cannot tell which rendering is authoritative and
//      averages them; ByteDance documents the same root cause for its
//      duplicate-character failure (ModelArk :1959) and prescribes fewer
//      competing views. Both profile panels disappear with the shape change.
//   3. One generation instead of two per character — half the sheet spend, one
//      asset to inspect and bind.
//
// KNOWN COST, accepted for v1: a neutral chest-up portrait carries no dental
// information, so a character who smiles in a shot gets invented teeth. The
// 2026-06-26 doctrine already holds that the user's prompt owns expression.
// Revisit only if a receipt shows invented teeth.
//
// THE FRONT PANEL IS HEADLESS (shipped 2026-07-22, receipt-gated). The face is
// cropped off the front body panel — the "ghost mannequin" treatment — taking
// competing face renderings 2 → 1. The BACK panel keeps its head: it has no
// face to compete with the portrait, and it is the only panel where hair fall
// reads. The rule is "kill every competing rendering of the FACE", not "kill
// every head".
//
// Two things had to be true before this shipped, and both were verified on
// real generations (research/model-prompting-research.md, "Head-crop receipt"):
//   1. It is prompt-reachable. NB2 renders a clean invisible-mannequin panel
//      with no refusal. THIS DEPENDS ON THE PHRASING: it is framed as FRAMING
//      ("cropped at the collarbone, head not shown, invisible-mannequin
//      presentation"), a standard e-commerce genre with deep training data.
//      Never phrase it as removal or decapitation.
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
// BACK-COMPAT IS MANDATORY: ~20 live users have characters bound to BOTH
// slots. `buildExpressionSheetPrompt` stays exported and the expression slot
// stays readable; `mentions.ts` only pushes non-null paths, so old two-sheet
// characters and new one-sheet characters both work unchanged.
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
 * for the receipt and for why the phrasing must stay framing, not removal.
 */
export const CHARACTER_SHEET_PANELS_DESC =
  'a large chest-up portrait on the left at a three-quarter angle (never dead-on), ' +
  'a full-body front view in a relaxed A-pose in the centre, framed from the collarbone down with the head not shown — ' +
  'an invisible-mannequin presentation where the clothing holds its own shape, ' +
  'and a full-body back view on the right with the head and hair fully visible'

/** Panel identifiers, in sheet order. */
export const BODY_POSE_LABELS = ['portrait', 'front', 'back'] as const

/**
 * Expression-sheet close-ups — LEGACY. Kept so characters built before the
 * 2026-07-21 single-sheet architecture keep regenerating correctly, and so the
 * expression slot remains usable for a character that genuinely needs a
 * dedicated expression range.
 */
export const CHARACTER_EXPRESSIONS_DESC =
  'neutral expression on left, genuine smile showing teeth in center, serious frown on right'

export const EXPRESSION_LABELS = ['neutral', 'smile', 'serious'] as const

// The sheet's style directive: a user transform REPLACES the inherit-source
// instruction (so the model isn't told to both preserve the medium AND change
// it); otherwise inherit the source medium.
function styleDirective(userStyle?: string | null): string {
  return renderStyleInstruction(userStyle).trim() || INHERIT_SOURCE_STYLE
}

/**
 * The character identity sheet — one asset, three panels, bound to the
 * turnaround slot. Named `buildCharacterTurnaroundPrompt` for continuity with
 * every existing caller and with the slot it binds to.
 *
 * @param userStyle optional natural-language style transform (e.g. "make her a real person")
 */
export function buildCharacterTurnaroundPrompt(userStyle?: string | null): string {
  return (
    `A single character identity reference sheet of one character, three panels side by side on one plate: ` +
    `${CHARACTER_SHEET_PANELS_DESC}. ` +
    `The portrait is the largest panel and occupies roughly a quarter to a third of the sheet — it is the sole authority for the face, so render it at maximum facial detail. ` +
    `No second rendering of the face anywhere on the sheet. ` +
    `Neutral expression and identical appearance, wardrobe and hair across all three panels. ` +
    `${styleDirective(userStyle)} ${IDENTITY_LIGHTING_CLAUSE} ${IDENTITY_CRAFT_CLAUSE} ` +
    `For quadruped or non-bipedal characters, replace the A-pose with a natural standing stance, show the whole animal including the head on both body panels, and keep the same three-panel layout. ` +
    `No text, no labels, no captions, no panel borders.`
  )
}

/**
 * Expression sheet — LEGACY close-up face reference. Since 2026-07-21 the
 * identity sheet above is the default and this slot is normally left null.
 * Generate one only when a character needs an explicit expression range;
 * attaching it costs a second reference slot on every generation.
 */
export function buildExpressionSheetPrompt(userStyle?: string | null): string {
  return (
    `Character expression reference sheet with 3 head and shoulder portraits arranged side by side horizontally: ${CHARACTER_EXPRESSIONS_DESC}. ` +
    `Consistent character appearance across all three. ` +
    `${styleDirective(userStyle)} ${IDENTITY_LIGHTING_CLAUSE} ${IDENTITY_CRAFT_CLAUSE} Same framing for each. ` +
    `No text, no labels, no captions.`
  )
}
