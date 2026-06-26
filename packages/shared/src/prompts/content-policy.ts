// Content-policy-safe construction — the canonical "build the scene safe from
// the first word" knowledge for every Slates surface (desktop templates, MCP
// skills, the lead-magnet .skill). Authored ONCE here; consumers derive from it.
//
// The principle: don't depict the harm — depict the energy, the aftermath, the
// threat, or the scale. A standoff is more tense than a massacre; an evacuated
// city is eerier than a crowd in panic; a roar lands harder than a kill. The
// substitutions below usually read as MORE cinematic, not less, and they keep a
// generation from getting silently rejected or degraded by the model's filter.
//
// Source: second-brain business/projects/slates/content-strategy/lead-magnets/
// reference-content-policy.md. SSOT map: business/projects/slates/product/
// prompting-ssot.md.

export interface SubstitutionRule {
  /** The risky construction to avoid. */
  avoid: string
  /** The safe-by-construction substitution that usually reads more cinematic. */
  use: string
}

/**
 * The substitution table — the core craft move. When a scene drifts toward any
 * `avoid`, re-stage it as the matching `use` before writing the prompt.
 */
export const CONTENT_POLICY_SUBSTITUTIONS: SubstitutionRule[] = [
  {
    avoid: 'Civilians in panic, crowds fleeing under debris',
    use: 'An evacuated / empty city; abandoned streets; a lone figure for scale',
  },
  {
    avoid: 'Weapons firing into buildings or at people',
    use: 'Energy-discharge standoffs, searchlights sweeping, charged auras, shockwaves with no muzzle fire',
  },
  {
    avoid: 'Creatures tearing into each other, gore',
    use: 'A grapple / standoff — roars, near-misses, circling, an energy clash; combat that stays contained (in/on the water, never lifting into the air)',
  },
  {
    avoid: 'Destruction with people in harm’s way',
    use: 'Destruction in uninhabited terrain — glaciers, deserts, ruins, open sea, evacuated zones',
  },
  {
    avoid: 'Realistic guns as the focus',
    use: 'Stylized / fantasy implements, weapons slung-not-fired, the weapon as silhouette or prop only',
  },
  {
    avoid: 'Blood, wounds, death',
    use: 'Impact light, dust, debris, buckling and collapse, a silhouette dropping out of frame',
  },
  {
    avoid: 'Real, named public figures',
    use: 'Original / anonymous characters',
  },
  {
    avoid: 'Real brand logos',
    use: 'Original or generalized branding — except the user’s own product, which is the whole point of a brand film',
  },
]

/** The pre-flight checklist — run before delivering any risk-surface prompt. */
export const CONTENT_POLICY_PREFLIGHT: string[] = [
  'No civilians depicted in panic/harm; crowds are evacuated or absent.',
  'No weapons firing at people/buildings; threat is energy / searchlight / silhouette.',
  'No creature-on-creature or creature-on-person gore; combat is grapple / standoff / roar, contained.',
  'Destruction is in uninhabited / evacuated terrain.',
  'Creatures are original ("not based on any franchise"); no real public figures; no real brand logos except the user’s own product.',
  'Anything with children is wholesome and age-appropriate.',
]

// ── Reusable text fragments (the template-assembly building blocks) ──
// The exact strings the desktop prompt templates, MCP skills, and lead-magnet
// compose. Change a rule HERE and every consumer follows.

/** One-line summary used as a header in skills + the lead magnet. */
export const CONTENT_POLICY_HEADLINE =
  "Don't depict the harm — depict the energy, the aftermath, the threat, or the scale. Build the scene safe from the first word."

/** The confirmed-safe envelope — pull a drifting scene back toward this shape. */
export const CONTENT_POLICY_SAFE_BENCHMARK =
  'One original creature, in a generalized monument or amphitheatre, in daylight, no weapons present, performing expressive action (rising, roaring, spreading wings). Original design, generalized location, daylight, expressive rather than violent — most epic ideas re-stage into this without losing the punch.'

/** The containment clause — keeps a scene in policy AND grounds its physics. */
export const CONTENT_POLICY_CONTAINMENT =
  'Give any creature or combat scene a containment rule ("the fight STAYS at the sea surface", "boss scale locked ~2.5 human-heights, NOT kaiju-giant", "destruction stays in the evacuated valley"). It improves coherence (no absurd escalation) AND keeps the scene inside policy — same clause buys both.'

/** The hard, non-negotiable rule on minors. Overrides every stylistic goal. */
export const CONTENT_POLICY_MINORS =
  'Never write romantic, sexual, or suggestive content involving or directed at minors, and never anything that sexualizes a young-presenting character. Any scene with children stays wholesome and age-appropriate. Non-negotiable.'

/**
 * Canonical markdown block — the SOURCE OF TRUTH the skill markdown, the desktop
 * inline mirror, and the lead-magnet are reconciled AGAINST. NOTE: nothing
 * imports this yet — the desktop carries its own inline copy and the skills
 * hand-author their prose, so a change here must be propagated to those copies
 * in the same pass until the desktop-import + skill-embed wiring lands (see
 * plans/2026-06-25-slates-prompting-system-overhaul.md).
 */
export const CONTENT_POLICY_TEXT = `## Content-policy-safe construction

${CONTENT_POLICY_HEADLINE}

Write scenes that hit full cinematic impact without ever *needing* to depict prohibited content. This is a craft move, not a compromise — the substitutions below usually read as more cinematic, not less, and they keep your generation from getting silently rejected or degraded by the model's filter. Load this whenever a prompt involves conflict, creatures, crowds, destruction, weapons, or young characters.

### Substitution table

| Avoid | Use instead |
|---|---|
${CONTENT_POLICY_SUBSTITUTIONS.map((s) => `| ${s.avoid} | ${s.use} |`).join('\n')}

### The safe benchmark
${CONTENT_POLICY_SAFE_BENCHMARK}

### Containment rule — it doubles as a physics win
${CONTENT_POLICY_CONTAINMENT}

### Scale and stakes without harm
Epic stakes come from environmental danger and reaction, not depicted victims: tiny figures diving clear of *collapsing* terrain (not being crushed), a war-horn over an *empty* field, an army *scrambling* across a frozen valley as a titan tears free of a glacier. The danger is the environment; the figures are reacting, not dying. Snow plumes, glowing runes, splintering ice, shockwaves, and dust carry the chaos.

### Minors — hard rule
${CONTENT_POLICY_MINORS}

### Pre-flight (run before delivering any risk-surface prompt)
${CONTENT_POLICY_PREFLIGHT.map((c) => `- [ ] ${c}`).join('\n')}

If a box fails, apply the substitution table before writing the prompt.`
