// Reference best-practices — the canonical "how to use reference images"
// knowledge for every Slates surface (desktop templates, MCP skills, the
// lead-magnet .skill). Authored ONCE here; consumers derive from it.
//
// Source grades: [Eric-test] = Eric's own hands-on result (doctrine-grade);
// [community] = multi-guide consensus; [code-verified] = verified against
// the slate codebase; [creator-demo] = single creator demonstration.

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
    id: 'identity-label-roles',
    title: 'Attach both sheets — label them, don\'t gate them',
    rule: 'Attach BOTH the full-body turnaround (body/proportion/outfit) AND the close-up expression sheet (high-res facial detail). Label them as identity references and tell the model to render the SCENE\'s expression (default neutral). The label — not gating — is what stops the multiple expressions from averaging the face.',
    why: 'An UNLABELED expression sheet hurts: the model copies its varied expressions and the face drifts to a midpoint. Labeled ("use for identity; render the scene\'s expression"), the close-ups are a fidelity win — they carry far more facial signal (eyes, skin, teeth, bone structure) than the postage-stamp faces in a full-body turnaround. The trend is MORE references (video/audio/3D into Seedance-class models); role-labeling is what makes many refs work, so lean into attaching rich refs and labeling every role.',
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

/** Flat, even, shadowless identity lighting on a plain neutral background. */
export const IDENTITY_LIGHTING = 'flat, even, shadowless lighting'
export const IDENTITY_BACKGROUND = 'a plain neutral-grey background'
export const IDENTITY_LIGHTING_CLAUSE =
  `Render on ${IDENTITY_BACKGROUND} with ${IDENTITY_LIGHTING} so the sheet captures the character's identity, not scene lighting.`

/** Inherit the source's artistic medium unless told otherwise. */
export const INHERIT_SOURCE_STYLE =
  'Preserve the artistic medium and visual style of the reference image (photograph, anime, illustration, 3D render, painterly, etc.).'

/** Environment plate guidance: one clean, naturally-lit establishing image. */
export const ENVIRONMENT_NATURAL_LIGHT =
  'natural, even ambient lighting that reads as the location\'s real light, not a studio setup'

/** One-line summary used as a header in skills + the lead magnet. */
export const REFERENCE_RULES_HEADLINE =
  'Identity = a few flat-lit neutral angles; one reference per role, labeled; 2-4 refs not 12; describe environments instead of feeding a grid.'

/**
 * Canonical markdown block — the SOURCE OF TRUTH the skill markdown and the
 * lead-magnet are reconciled AGAINST. NOTE: nothing imports this yet — the
 * skills hand-author their own reference-rule prose and embed-skills.mjs ships
 * the raw .md as-is, so a change here must be propagated to the per-model skill
 * blocks + lead-magnet by hand until the skill-embed wiring lands (see
 * plans/2026-06-25-slates-prompting-system-overhaul.md). The TARGET is to
 * inject this text so it can't drift; today it's reconciled manually.
 */
export const REFERENCE_RULES_TEXT = `## Reference rules (how to use reference images)

${REFERENCE_RULES_HEADLINE}

1. **2-4 strong references beat both extremes.** Not 1 (warps toward itself), not 12 (averages worse). Start with 2-3 focused refs.
2. **One reference per ROLE, labeled in the prompt.** Identity / style-grade / environment. The model does not infer roles from order — name each role in the prompt text. Same-role competitors drift.
3. **Attach both sheets — label them, don't gate them.** Attach the full-body turnaround (body/proportion/outfit) AND the close-up expression sheet (high-res facial detail: eyes, skin, teeth, bone structure). Label both as identity references and tell the model to render the SCENE's expression (default neutral). An *unlabeled* expression sheet hurts (the model copies the varied expressions → midpoint face); *labeled*, the close-ups are a fidelity win. The trend is MORE references — role-labeling is what makes many refs work.
4. **Flat-light identity refs.** Prep identity refs with ${IDENTITY_LIGHTING} on a plain neutral background. Studio-lit / scene-lit sheets bleed their lighting into every generation (the studio-lit sheet → "green-screen-pasted in front of mountains" failure). Reference prep beats prompting here.
5. **Environment: describe it, don't feed a grid.** Default to describing the location in words. Reserve an environment reference for a mandatory exact-match, and then use ONE clean establishing image with ${ENVIRONMENT_NATURAL_LIGHT} — never a multi-panel grid fed whole.
6. **Grids: explore, don't input.** Use grids to explore compositions cheaply, then pick a cell. Never feed a grid back in as a reference — cells share a split detail budget and generate jointly, so flaws propagate.
7. **Reuse the same refs across all shots.** Lock a set and reuse it; swapping refs mid-sequence causes drift.
8. **Legible in-shot text → bake it into an image start frame, never trust text-to-video.** Animate from the locked frame.
9. **I2V / own-footage superpower.** Restyle your own clip keeping the performance; delayed-VFX on "video one"; marker-object insertion; video-as-ref for a series. Describe ONLY what changes.
10. **Style transform by natural language.** Default keeps the source's art style; an optional plain-text instruction transforms it ("anime → real person"). No preset pickers.`
