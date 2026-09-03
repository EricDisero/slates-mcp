// @slatesvideo/shared/prompts — the canonical "WHAT" layer for Slates model
// prompting: reference best-practices, the style library, per-model facts, and
// the character/environment prompt builders. The desktop app, the MCP
// prompting skills, and the lead-magnet .skill all DERIVE from here.
//
// Propagation rule (the TARGET): research → second-brain; encode once → here;
// everything else derives. Reality today: nothing imports this module yet — the
// desktop templates and MCP skill markdown are RECONCILED against it by hand
// until the desktop-import + skill-embed wiring ships (see the SSOT map +
// plan). So a change here must be applied to those copies in the same pass for
// now. SSOT map: second-brain business/projects/slates/product/prompting-ssot.md

export * from './reference-rules.js'
export * from './reference-composer.js'
export * from './content-policy.js'
export * from './style-library.js'
// Model CAPABILITY SSOT (aspect ratios, video resolutions, durations, reference
// caps). The desktop's MODEL_REGISTRY spreads these into every entry and the op
// surface validates + generates its descriptions from them — never hand-typed.
export * from './model-capabilities.js'
export * from './model-facts.js'
export * from './character-sheet.js'
export * from './environment-sheet.js'
// Exported from the `./prompts` subpath (not just the root barrel) because the
// desktop RENDERER imports the tips — the root barrel re-exports auth.js
// (node:fs/os/path), which breaks browser bundling. `./prompts` stays Node-free.
export * from './prompting-tips.js'
// Asset captions — one rule for the op surface's compactAsset and the desktop
// gallery. Also its own leaf subpath (`@slatesvideo/shared/asset-label`) for the
// renderer, which cannot import the root barrel.
export * from './asset-label.js'
