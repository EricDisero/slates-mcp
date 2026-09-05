// Canonical environment-plate prompt content. ONE clean establishing image —
// NOT a 3x3 grid fed whole (that was Eric's "green-screen pasted in front of
// mountains" failure: a bordered collage used as a reference). Default
// workflow is to DESCRIBE the location in words; this plate is the optional
// exact-match lock, and when used it is a single naturally-lit frame.

import {
  ENVIRONMENT_NATURAL_LIGHT,
  INHERIT_SOURCE_STYLE,
} from './reference-rules.js'
import { renderStyleInstruction } from './style-library.js'

// A user transform REPLACES the inherit-source instruction (no "preserve the
// medium AND change it" contradiction); otherwise inherit the source medium.
function styleDirective(userStyle?: string | null): string {
  return renderStyleInstruction(userStyle).trim() || INHERIT_SOURCE_STYLE
}

/**
 * Single establishing image of an empty location — the optional
 * exact-match environment reference. One frame, naturally lit.
 * @param userStyle optional natural-language style transform
 */
export function buildEnvironmentEstablishingPrompt(userStyle?: string | null): string {
  return (
    `A single clean establishing shot of this empty location, framed at a three-quarter angle — never a dead-on frontal view — so two walls or planes are visible and the floor reads as usable staging space. ` +
    `Capture the space: its architecture or geography, materials, and depth. ` +
    `Include a clearly readable ANCHOR OBJECT with a definite position in the room — a sofa, a doorway, a counter, a signpost — so later shots can be blocked against it. ` +
    `The location is empty and unpopulated, ready for scene staging. ` +
    `${styleDirective(userStyle)} Use ${ENVIRONMENT_NATURAL_LIGHT}, motivated by ONE dominant source with shadows falling consistently away from it — soft and diffused for interiors, no hard visible light rays. ` +
    `Add gentle atmospheric haze with distance so near and far planes separate in depth rather than reading at the same sharpness. ` +
    `If the reference image contains people or characters, generate the location as an empty space — ignore the figures. ` +
    `No text, no labels, no captions.`
  )
}

// ⚠️ STATUS: authored doctrine that currently reaches NO model. Adjudicated
// 2026-09-04 (dead-code sweep §5 D1). Both constants below have zero consumers
// anywhere in the workspace, and — unlike IMAGE_PROMPT_FORMULA, which was a
// verbatim second copy of slates-prompting-nano-banana-2.md and was deleted —
// nothing in skills/*.md or the craft cards carries this content. So it is a
// capability gap, not a duplicate: deleting it would lose the only copy.
//
// The fix is NOT to wire a TS consumer. craft-cards.ts states the rule: "THE
// CARD IS NEVER WRITTEN HERE… a card authored downstream is a second copy of
// the skill that drifts from it." Environment plates have no skill of their own
// yet (there is a Characters/Environments/Styles tab in the product, and a
// slates-character-identity skill, but no environment counterpart). Wiring this
// in means AUTHORING that skill section — a content + token-budget decision —
// after which these two constants should be deleted, not kept alongside it.
//
// Until then: EDITING THE TEXT BELOW CHANGES NOTHING THAT SHIPS.

/** Guidance shown to users/agents: prefer describing the environment in text. */
export const ENVIRONMENT_DESCRIBE_FIRST =
  'Default to describing the environment in words and let the model build it to fit the shot. Generate an establishing plate only when a location must be locked exactly across shots. ' +
  'When you do: frame it three-quarter, never dead-on (a frontal facade turns the location into a backdrop characters stand in FRONT of; a three-quarter exposes side geometry and usable floor), ' +
  'name an anchor object so blocking can be stated as "between the sofa\'s hall-side arm and the window" instead of "on the left" — one is testable after a camera turn, the other drifts, ' +
  'give it one motivated light source with shadows falling away from it, and ask for atmospheric haze so depth separates.'

/**
 * The continuity test for a location that must hold across shots: generate a
 * SECOND frame from the reverse angle and approve the plate only if the anchor
 * object, the openings, the light side, the materials and the palette all still
 * match. A plate that fails this will drift the moment the camera turns — and a
 * broken plate gives every later character failure a second plausible cause.
 */
export const ENVIRONMENT_REVERSE_ANGLE_TEST =
  'Reverse-angle check: generate one frame from the opposite side of the space and confirm the anchor object, openings, light direction, materials and colour palette all still match. If they do not, the plate is not locked — fix the plate before staging anything in it.'
