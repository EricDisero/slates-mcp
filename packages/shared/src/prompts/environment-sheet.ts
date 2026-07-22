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
