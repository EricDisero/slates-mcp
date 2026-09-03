---
paths:
  - "packages/shared/skills/**"
  - "pack-skills/**"
  - "packages/shared/scripts/embed-skills.mjs"
  - "scripts/build-skills-pack.mjs"
  - "packages/cli/src/commands/install-skills.ts"
---

# Skills — free versus paid, and how to add one


**⚠️ The bundled skills here are FREE product quality — they are NOT the paid "Agentic Skills Pack" ($29 funnel order bump).** The free/paid line is locked (Eric, 2026-07-09): *capability free, outcomes paid.* Everything in `packages/shared/skills/` ships free to every user (CLI `install-skills`, MCP prompting-guide op, desktop Studio Agent) — never gate any of it behind the bump. The paid pack's content is **campaign blueprints harvested from our real ads** (exact prompt stacks, shot lists, workflow runs per ad, replayable as "make this for my product") plus any pack-exclusive skills built specifically for the bump. Doctrine: `second-brain/business/projects/slates/strategy/funnel-architecture.md` → "Pack content doctrine".

**🚨 Paid skills live in `pack-skills/` at the repo root — NEVER in `packages/shared/skills/`.**
`packages/shared/package.json`'s `files` array includes `skills`, so **that folder ships inside the
public npm tarball**: anyone can `npm pack @slatesvideo/shared` and read every file in it. An
entitlement filter in `install-skills` protects nothing — it is security by omission over a public
artifact. **The only real gate is not shipping the file.** (`install-skills.ts` iterates
`Object.entries(SKILLS)` with no entitlement check of any kind, and that is fine *because* the
paid files never reach the record.)

`scripts/embed-skills.mjs` globs `packages/shared/skills/*.md` only, so moving a file into
`pack-skills/` automatically drops it from the `SKILLS` record — and therefore from npm, the
`/members` feed, the MCP prompting-guide op and the desktop Studio Agent, in one move.

Two ad skills were written straight into `packages/shared/skills/` on 2026-08-16 and swept into a
release commit by a `git add -A`. They never reached npm (the build ran before the files landed),
but the near-miss is why this rule is now explicit. **Use explicit paths in `git add`, never `-A`.**

Build the pack with `npm run build:skills-pack` (root). It assembles the free skills plus
everything in `pack-skills/` into a deterministic zip, refuses to build when `pack-skills/` is empty,
and generates the README so the inventory is never hand-typed. The zip's download URL is
hand-mirrored in **two** repos and gated by `slates-web/scripts/check-skills-pack-lockstep.mjs` —
**never move that URL before the object is uploaded**, or every paying customer gets a 404.

1. Drop a markdown file with frontmatter into `packages/shared/skills/`.
2. Frontmatter must include `name:` and `description:` for skill discovery.
3. Rebuild — `scripts/embed-skills.mjs` runs as shared's prebuild and regenerates `src/skills/content.ts` (the `SKILLS` record). The CLI's `install-skills` and the `slates_get_prompting_guide` op both read from that record; never edit the generated file by hand.
4. **🚨 A first-party prompt guide is authority on the MODEL; the ENDPOINT SCHEMA is authority on the
   REQUEST — and the skill has to serve the request** (learned on MiniMax H3, 2026-08-27). MiniMax's
   own guides document an angle-bracket tag block (`<Subject N>` / `<Picture N>` / `<Video N>` /
   `<Audio N>`) as the way to declare references. fal — the provider we actually call — exposes
   references as TYPED SLOTS and its `prompt` description instructs *"refer to reference assets by
   their modality and order: Image 1, Image 2, Video 1, Audio 1"*. Writing the skill from the
   first-party guide alone would have shipped a syntax that reaches the model as literal angle
   brackets. **Read the live OpenAPI before writing a per-model skill, not just the model card.**
   The same read found `prompt_expansion_mode` defaulting to `balanced` — a provider-side prompt
   rewrite that the desktop now disables on every request (prompt-transparency invariant), which is
   itself a fact the skill has to teach.
5. Three categories — keep them separate:
   - **Workflow skills** (`slates-one-prompt-film`, `slates-direct-response-ad`, `slates-storyboard-from-script`, etc.) compose multiple ops into a recipe. **No count is stated here on purpose** — this line said "cap ~6, currently AT the cap (6)" while eighteen shipped, which is the shape of claim that reads as a rule and is only ever a stale tally. The real constraint is DISCRIMINABILITY: a new workflow skill has to be one an LLM can tell apart from every existing one by its first sentence alone. If you cannot write that sentence, it is a section of an existing skill.
   - **Per-model prompting skills** (`slates-prompting-nano-banana-2`, `slates-prompting-veo-3`, etc.) fire when calling the matching `slates_generate_*` op. Naming convention: `slates-prompting-{model}.md`. One per model variant family. The audio lane adds two: `slates-prompting-seed-audio` and `slates-prompting-elevenlabs` (Sound Effects v2 — the ElevenLabs TTS surface was removed 2026-08-01, so that skill is SFX-only and `tts`/`voiceover` alias to Seed Audio instead). ⚠️ In `resolveGuideTopic()` the `seed-audio` alias MUST be tested **before** `seedance` — "seed-audio" also starts with "seed", and falling through hands the video guide to an audio model.
   - **Per-style prompting** (`slates-style-prompting`) — cross-model style depth (photoreal/anime/painterly/3d-render on Seedance vs Kling vs NB2). Fires on style requests; style names alias to it in `resolveGuideTopic()`. SSOT: born in second-brain `research/style-prompting-research.md`, encoded here — never author style content directly in this file.
   - **Cross-cutting hygiene skills** (`slates-cost-discipline`) fire on every generation call regardless of model. Should be rare — only add when a discipline applies across many ops.
6. If the skill maps to a model id, extend the alias table in `resolveGuideTopic()` (operations/index.ts) so `slates_get_prompting_guide` resolves the model id to it.
