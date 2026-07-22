// Reference best-practices — the canonical "how to use reference images"
// knowledge for every Slates surface (desktop templates, MCP skills, the
// lead-magnet .skill). Authored ONCE here; consumers derive from it.
//
// Source grades: [Eric-test] = Eric's own hands-on result (doctrine-grade);
// [community] = multi-guide consensus; [code-verified] = verified against
// the slate codebase; [creator-demo] = single creator demonstration.

// The generated partial store — one entry per skills/_partials/*.md file.
// Re-exported so consumers can reach any partial, not just the rules block.
export { PARTIALS } from './partials.generated.js'
import { PARTIALS } from './partials.generated.js'

export type SourceGrade = 'Eric-test' | 'community' | 'code-verified' | 'creator-demo'

export interface ReferenceRule {
  id: string
  title: string
  rule: string
  why: string
  grade: SourceGrade
}

/**
 * The 10 verified reference rules. These are the WHY; the fragments below
 * are the reusable text the templates compose.
 */
export const REFERENCE_RULES: ReferenceRule[] = [
  {
    id: 'two-to-four-refs',
    title: '2-4 strong references beat both extremes',
    rule: 'Use 2-4 strong, focused references — not 1 (warps), not 12 (averages worse). Start with 2-3.',
    why: 'One reference warps toward itself; a dozen averages everyone into mush. One tester cut drift ~60% going 6→2.',
    grade: 'community',
  },
  {
    id: 'one-ref-per-role',
    title: 'One reference per ROLE, labeled in the prompt',
    rule: 'Use one reference per role — identity, style-grade, environment — and label each role explicitly in the prompt text. The model does not infer roles from order.',
    why: 'Same-role competitors drift; two "identity" refs of different people blend into a third face.',
    grade: 'community',
  },
  {
    id: 'identity-name-as-one-entity',
    title: 'One identity sheet per character — NAME whatever you attach as one entity',
    rule: 'Attach the character\'s single identity sheet (dominant portrait + body panels) rather than a pile of views — fewer competing renderings of a face is always better, because the model cannot tell which is authoritative and averages them. When a character DOES carry a second bound sheet (an explicit expression range, or a legacy turnaround+expression pair), NAME both inline as the SAME subject ("Marcus (images 1 and 2)") — that shared name is what tells the model they are ONE person. Do NOT inject a role essay ("use for identity, ignore the outfit/lighting, render neutral"): the user\'s prompt owns wardrobe, expression, and lighting.',
    why: 'Naming both images as one entity IS each model\'s OWN official consistency lever — NB2 "assign a distinct name to each character/object"; Seedance "Reference <Subject_N> in <Image_N>"; Kling "reuse a fixed label verbatim". The old heavy role-essay was the OFF-doctrine part: telling the model to "use for identity" while injecting "ignore the outfit" dragged the studio-lit sheet\'s wardrobe + lighting into scenes that explicitly wanted otherwise (the movie-still injection failure). The close-ups still carry far more facial signal (eyes, skin, teeth, bone structure) than a turnaround\'s postage-stamp faces, so attach both — the NAME, not an instruction, is what makes many refs work. The trend is MORE references (video/audio/3D into Seedance-class models), all addressed by name.',
    grade: 'Eric-test',
  },
  {
    id: 'flat-light-identity',
    title: 'Flat-light identity refs',
    rule: 'Prep identity refs with flat, even, shadowless lighting on a plain neutral background. Studio-lit or scene-lit sheets bleed their lighting into every generation.',
    why: "Eric's Norse-woman test: a studio-lit sheet produced a subject that looked green-screen-pasted in front of mountains. Reference prep beats prompting here.",
    grade: 'Eric-test',
  },
  {
    id: 'describe-environment',
    title: 'Environment: describe it, don\'t feed a grid',
    rule: 'Default to describing the environment in words. Reserve an environment reference for a mandatory exact-match location, and when you do, use ONE clean establishing image — never a multi-panel grid fed whole.',
    why: "Eric's test: character sheet + 3x3 mountain grid → pasted-in mess; the same character + a described background → believable scene with natural lighting the model invented to fit.",
    grade: 'Eric-test',
  },
  {
    id: 'grids-explore-not-input',
    title: 'Grids: generation/exploration = fine; INPUT reference = bad',
    rule: 'Use grids to EXPLORE compositions (cheap multi-angle generation), then pick a cell. Do NOT feed a grid back in as a reference image — cells share a split detail budget and generate jointly, so flaws propagate.',
    why: 'A picked cell re-generated with a "preserve the exact composition" prompt keeps its flaws faithfully (that is the budget path, kept on purpose). A loose prompt can fix anatomy but drifts off the picked composition.',
    grade: 'code-verified',
  },
  {
    id: 'reuse-refs',
    title: 'Reuse the same refs across all shots',
    rule: 'Lock a reference set and reuse it across every shot in a sequence. Swapping refs mid-sequence causes drift.',
    why: 'The model adapts environment refs to each prompt rather than copying them, so swapping compounds inconsistency shot to shot.',
    grade: 'community',
  },
  {
    id: 'text-as-start-frame',
    title: 'Legible in-shot text → image start-frame, never trust text-to-video',
    rule: 'When a shot needs legible on-screen text, bake it into a still start frame (NB2) and animate from that. Do not expect a text-to-video model to render clean text.',
    why: 'Video models smear text; an image model holds it, and the video inherits the locked frame.',
    grade: 'community',
  },
  {
    id: 'i2v-own-footage',
    title: 'I2V / own-footage superpower — describe only what changes',
    rule: 'Restyle your own clip while keeping the performance; "video one" delayed-VFX; marker-object insertion; video-as-ref for a series. In all cases describe ONLY what changes, not the whole scene.',
    why: 'The source clip already carries motion, timing, and performance; re-describing them fights the model. Narrate the delta.',
    grade: 'creator-demo',
  },
  {
    id: 'style-transform-nl',
    title: 'Style transform by natural language',
    rule: 'Default: keep the source\'s artistic medium/style. To change it, add a plain-text instruction ("anime → real person") — no preset pickers.',
    why: 'Paste/natural-language over preset menus is the product philosophy; the medium is inherited unless the user explicitly asks to transform it.',
    grade: 'Eric-test',
  },
]

// ── Reusable text fragments (the template-assembly building blocks) ──
// These are the exact strings the desktop prompt templates, MCP skills,
// and lead-magnet compose. Change a rule HERE and every consumer follows.

/** Flat, even, shadowless identity lighting on a deep neutral-grey plate. */
export const IDENTITY_LIGHTING = 'flat, even, shadowless lighting'
/**
 * The plate value is deliberate, not decorative: **white bleeds into the
 * generated video and washes out the location; black eats edge detail and
 * crushes hair and wardrobe silhouettes.** A deep neutral grey holds both.
 */
export const IDENTITY_PLATE_HEX = '#3a3a3c'
export const IDENTITY_BACKGROUND = `a plain, deep neutral-grey background (${IDENTITY_PLATE_HEX})`
export const IDENTITY_LIGHTING_CLAUSE =
  `Render on ${IDENTITY_BACKGROUND} with ${IDENTITY_LIGHTING} so the sheet captures the character's identity, not scene lighting.`

/**
 * Craft clauses every identity reference wants — the eye and skin detail that
 * survives downstream, plus the two "reads literally" guards. Crushed-black
 * irises carry no light information, so eye tone drifts between generations;
 * no catchlight reads as dead eyes; perfect mirroring reads as synthetic and
 * the model PRESERVES that reading; a game-render look gets ANIMATED like game
 * footage. See skills/_partials/references-read-literally.md.
 */
export const IDENTITY_CRAFT_CLAUSE =
  'Crisp catchlights in the eyes and open, readable irises — never crushed to black. ' +
  "Render surface texture at the medium's own natural level of detail — skin, hair and fabric should read as material, not airbrushed or plastic. " +
  'Break perfect symmetry — avoid a mirrored face or dead-square framing. ' +
  'Whatever the medium, avoid the over-clean 3D-game-model look.'

/** Inherit the source's artistic medium unless told otherwise. */
export const INHERIT_SOURCE_STYLE =
  'Preserve the artistic medium and visual style of the reference image (photograph, anime, illustration, 3D render, painterly, etc.).'

/** Environment plate guidance: one clean, naturally-lit establishing image. */
export const ENVIRONMENT_NATURAL_LIGHT =
  'natural ambient lighting that reads as the location\'s real light, not a studio setup'

/**
 * One-line summary used as a header in skills + the lead magnet. DERIVED from
 * the partial's opening line — a hand-authored copy here would be a ninth
 * wording of the same rule, which is the thing this whole mechanism exists to
 * stop. Edit `skills/_partials/reference-rules-core.md`.
 */
export const REFERENCE_RULES_HEADLINE = PARTIALS['reference-rules-core'].split('\n')[0]

/**
 * Canonical markdown block — the SOURCE OF TRUTH for reference-image doctrine
 * across every Slates surface.
 *
 * ✅ WIRED 2026-07-21. This is no longer hand-reconciled prose. The text lives
 * in `skills/_partials/reference-rules-core.md`; `scripts/sync-partials.mjs`
 * injects it between the `@inject:reference-rules-core` markers in the
 * per-model skills AND emits it here via `partials.generated.ts`. One edit to
 * the partial now moves the markdown skills, this export, the MCP
 * prompting-guide op, the CLI-installed skills, and the Studio Agent together.
 *
 * The build runs `sync-partials.mjs --check`, so a hand-edit inside a marker
 * block fails the build with a diff instead of silently forking.
 *
 * To change reference doctrine: edit `skills/_partials/reference-rules-core.md`.
 * Do NOT edit this file, and do NOT edit between markers in a skill.
 */
export const REFERENCE_RULES_TEXT = `## Reference rules (how to use reference images)

${PARTIALS['reference-rules-core']}`
