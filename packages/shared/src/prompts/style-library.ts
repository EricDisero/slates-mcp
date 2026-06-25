// Style library — the canonical "style name → description / medium" map and
// the single rule that governs how Slates handles style: inherit the source's
// artistic medium by default, transform only on an explicit natural-language
// instruction. No preset pickers (PRODUCT_PHILOSOPHY: paste/NL over menus).

import { INHERIT_SOURCE_STYLE } from './reference-rules.js'

export interface StyleEntry {
  id: string
  label: string
  /** What the model should produce when this style is requested. */
  description: string
  /** The artistic medium this style implies. */
  medium: string
}

/**
 * Optional named styles for when a user DOES want to name one. The default is
 * always `inherit` — keep the reference's own medium. These are descriptions,
 * not preset buttons; they exist so an agent can translate a user's plain
 * request ("make it anime") into a clean instruction.
 */
export const STYLE_LIBRARY: StyleEntry[] = [
  {
    id: 'inherit',
    label: 'Match Source',
    description: INHERIT_SOURCE_STYLE,
    medium: 'whatever the reference already is',
  },
  {
    id: 'photoreal',
    label: 'Photoreal',
    description:
      'A real photograph of a real person/place. Natural skin texture and imperfection, motivated lighting, lens and film-stock language — never the word "photorealistic" as a token.',
    medium: 'live-action photography',
  },
  {
    id: 'anime',
    label: 'Anime',
    description: 'Hand-drawn 2D anime/cel style: clean line art, flat-shaded color, expressive eyes.',
    medium: '2D animation',
  },
  {
    id: 'painterly',
    label: 'Painterly',
    description: 'Visible brushwork, painted edges, concept-art rendering rather than photographic capture.',
    medium: 'digital/traditional painting',
  },
  {
    id: '3d-render',
    label: '3D Render',
    description: 'Stylized 3D CGI render: sculpted forms, subsurface materials, soft GI lighting (Pixar/Unreal lineage).',
    medium: '3D render',
  },
  {
    id: 'comic',
    label: 'Comic',
    description: 'Inked comic-book style: bold outlines, halftone or flat color, graphic shadows.',
    medium: 'comic illustration',
  },
]

export const DEFAULT_STYLE_ID = 'inherit'

const STYLE_BY_ID = new Map(STYLE_LIBRARY.map((s) => [s.id, s]))

export function getStyle(id: string | null | undefined): StyleEntry {
  return (id && STYLE_BY_ID.get(id)) || STYLE_BY_ID.get(DEFAULT_STYLE_ID)!
}

/**
 * Render the optional style instruction that templates append verbatim.
 * - No user style → empty string (inherit the source medium, the default).
 * - A free-text instruction ("make her a real person") → appended as a clean
 *   transform clause.
 * - A known style id → the library description.
 *
 * Tolerant of the legacy desktop values ('photorealistic' / 'match-reference'):
 * 'match-reference' coalesces to inherit (empty); 'photorealistic' maps to the
 * photoreal description. So old character/environment rows stay valid with no
 * data migration.
 */
export function renderStyleInstruction(userStyle?: string | null): string {
  const raw = (userStyle ?? '').trim()
  if (!raw) return ''
  const lower = raw.toLowerCase()
  // Legacy / default values are no-ops — keep the source medium.
  if (lower === 'match-reference' || lower === 'inherit' || lower === 'match source') return ''
  if (lower === 'photorealistic' || lower === 'photoreal') {
    return ` Style: ${getStyle('photoreal').description}`
  }
  const known = STYLE_BY_ID.get(lower)
  if (known) return ` Style: ${known.description}`
  // Free-text natural-language transform — append verbatim.
  return ` Style change: ${raw}.`
}
