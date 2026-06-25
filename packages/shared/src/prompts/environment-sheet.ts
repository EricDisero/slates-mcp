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
    `A single clean establishing shot of this empty location: a wide, eye-level view that captures the space — its architecture or geography, materials, and depth. ` +
    `The location is empty and unpopulated, ready for scene staging. ` +
    `${styleDirective(userStyle)} Use ${ENVIRONMENT_NATURAL_LIGHT}. ` +
    `If the reference image contains people or characters, generate the location as an empty space — ignore the figures. ` +
    `No text, no labels, no captions.`
  )
}

/** Guidance shown to users/agents: prefer describing the environment in text. */
export const ENVIRONMENT_DESCRIBE_FIRST =
  'Default to describing the environment in words and let the model build it to fit the shot. Generate an establishing plate only when a location must be locked exactly across shots.'
