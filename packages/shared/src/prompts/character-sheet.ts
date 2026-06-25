// Canonical character-sheet prompt content. ONE mode: inherit the source's
// medium, render on a flat-lit plain background, optional natural-language
// style transform. (Replaces the old photorealistic / match-reference fork
// that baked studio lighting or a scene's lighting into the identity ref.)
//
// This is the SOURCE OF TRUTH that the desktop templates, the MCP skill
// markdown, and the lead-magnet are RECONCILED against. They do NOT import it
// yet (the skill-embed + desktop-import wiring is future work per
// plans/2026-06-25-slates-prompting-system-overhaul.md), so when you change a
// rule here, update those copies in the same pass until the wiring ships.

import {
  IDENTITY_LIGHTING_CLAUSE,
  INHERIT_SOURCE_STYLE,
} from './reference-rules.js'
import { renderStyleInstruction } from './style-library.js'

/** Turnaround = the IDENTITY reference. 4 neutral full-body angles. */
export const CHARACTER_ANGLES_DESC =
  'front view, back view, left side profile, right side profile'

/**
 * Expression-sheet close-ups = the FACE identity reference (high-res
 * eyes/skin/teeth/bone). Attached alongside the turnaround; the scene-time
 * reference label drives the rendered expression.
 */
export const CHARACTER_EXPRESSIONS_DESC =
  'neutral expression on left, genuine smile showing teeth in center, serious frown on right'

export const BODY_POSE_LABELS = ['front', 'back', 'profile-left', 'profile-right'] as const
export const EXPRESSION_LABELS = ['neutral', 'smile', 'serious'] as const

// The sheet's style directive: a user transform REPLACES the inherit-source
// instruction (so the model isn't told to both preserve the medium AND change
// it); otherwise inherit the source medium.
function styleDirective(userStyle?: string | null): string {
  return renderStyleInstruction(userStyle).trim() || INHERIT_SOURCE_STYLE
}

/**
 * Body turnaround sheet — the identity reference.
 * @param userStyle optional natural-language style transform (e.g. "make her a real person")
 */
export function buildCharacterTurnaroundPrompt(userStyle?: string | null): string {
  return (
    `Character model reference sheet with 4 full body views of the same character: ${CHARACTER_ANGLES_DESC}. ` +
    `Neutral pose, neutral expression, consistent character appearance across all views. ` +
    `${styleDirective(userStyle)} ${IDENTITY_LIGHTING_CLAUSE} ` +
    `For upright/bipedal characters arrange side-by-side; for quadruped/animal characters use a 2x2 grid. ` +
    `No text, no labels, no captions.`
  )
}

/**
 * Expression sheet — the close-up face reference. Its three portraits carry
 * high-res facial detail (eyes, skin, teeth, bone structure) plus the
 * character's expression range. Attached ALONGSIDE the turnaround; the
 * reference label drives identity-use + scene-driven expression so the multiple
 * expressions don't average the generated face.
 */
export function buildExpressionSheetPrompt(userStyle?: string | null): string {
  return (
    `Character expression reference sheet with 3 head and shoulder portraits arranged side by side horizontally: ${CHARACTER_EXPRESSIONS_DESC}. ` +
    `Consistent character appearance across all three. ` +
    `${styleDirective(userStyle)} ${IDENTITY_LIGHTING_CLAUSE} Same framing for each. ` +
    `No text, no labels, no captions.`
  )
}

