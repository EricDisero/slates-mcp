// Reference best-practices — the canonical "how to use reference images"
// knowledge for every Slates surface (desktop templates, MCP skills, the
// lead-magnet .skill). Authored ONCE here; consumers derive from it.

// The generated partial store — one entry per skills/_partials/*.md file.
// Re-exported so consumers can reach any partial, not just the rules block.
export { PARTIALS } from './partials.generated.js'
import { PARTIALS } from './partials.generated.js'

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
/**
 * THE HEX IS EMITTED WITHOUT ITS `#`. This USED to be load-bearing (2026-07-30):
 * `#` is a reference-token sigil in the prompt composer, and an unresolved
 * `#token` was SILENTLY DELETED, so `#3a3a3c` never survived to any model — fal
 * echoed back `deep neutral-grey background ()` on a real 2026-07-30 request and
 * the plate value had been doing nothing since the composer shipped.
 *
 * 🚨 THE HAZARD IS GONE, AND THE OLD GENERAL RULE WITH IT. The composer now
 * treats a sigil as a mention ONLY when it resolves and passes every other
 * `@`/`#` through byte-identically (`reference-composer.ts` → `TOKEN_RE`) — the
 * exact "HOW YOU'D KNOW THIS IS BEATEN" this comment used to name. Emitting a
 * `#hex` or an `@handle` into prompt text is safe again.
 *
 * It stays bare here anyway: "hex 3a3a3c" reads at least as clearly to a model,
 * and rewording it would churn the generated skills/docs corpus for no gain.
 * That is now a style choice, NOT a workaround — do not re-derive a "never emit
 * a sigil" law from it. `IDENTITY_PLATE_HEX` keeps its `#` because it is a
 * colour constant with possible non-prompt consumers.
 */
export const IDENTITY_BACKGROUND = `a plain, deep neutral-grey background (hex ${IDENTITY_PLATE_HEX.replace('#', '')})`
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
