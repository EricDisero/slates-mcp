# slates-mcp — Claude code notes

This is the MCP server + CLI + skills monorepo for Slates. Treat it as a thin transport layer over slates-api (cloud) and the slate desktop app's local HTTP server.

## Layout

```
slates-mcp/
├── package.json                ← npm workspaces root
├── tsconfig.json               ← shared compiler options
├── smithery.yaml               ← Smithery registry config (stdio via npx)
└── packages/
    ├── shared/                 ← @slatesvideo/shared
    │   skills/*.md             ← bundled agent recipes (single source)
    │   scripts/embed-skills.mjs← prebuild: skills/*.md → src/skills/content.ts (gitignored, generated)
    │   src/
    │     auth.ts               ← read/write ~/.slates/agent-connection.json
    │     clients/cloud.ts      ← slates-api HTTP client
    │     clients/desktop.ts    ← 127.0.0.1:PORT HTTP client (+ healthz capability handshake)
    │     operations/index.ts   ← single source of truth for the tool surface
    │     skills/content.ts     ← GENERATED — embedded SKILLS record, do not edit
    │     index.ts              ← public re-exports
    ├── mcp/                    ← @slatesvideo/mcp-server (stdio MCP, bin: slates-mcp-server)
    │   src/server.ts
    │   manifest.json           ← Claude Desktop .mcpb manifest
    │   scripts/stage-mcpb.mjs  ← stages dist-mcpb/ for `npm run build:mcpb`
    └── cli/                    ← @slatesvideo/cli (bin: slates)
        src/index.ts
        src/commands/{login,logout,status,op,install-skills,mcp}.ts
```

## Hard rules

- **Never duplicate operation logic.** Both surfaces register the same `ALL_OPERATIONS` array. Adding a new tool = one edit in `packages/shared/src/operations/index.ts`, then both surfaces ship it.
- **No native deps.** Pure TS + `@modelcontextprotocol/sdk` + `commander` + `zod` + `zod-to-json-schema`. No FFmpeg, no sharp, no canvas. The desktop side handles binary work.
- **Bearer tokens only flow to their intended hosts.** `slates_sk_` to `slates-api.fly.dev`; the desktop token to `127.0.0.1:PORT`. The clients enforce this — never bypass.
- **Connection file is the single source of truth.** Don't add a second config or env-var path. The CLI's `slates login` writes it, the desktop app writes the desktop side, both surfaces read it.
- **Cost-key builders must byte-match the desktop's.** `videoCostKey()` in `operations/index.ts` mirrors `klingCreditKey`/`seedanceCreditKey` in `slate/src/shared/pricing.ts` — every key dimension (resolution incl 4K, face/realface, audio) must be reflected here or agent pre-flight quotes diverge from what's billed (the Kling-4K quote gap shipped exactly this way, caught 2026-07-02). Any key-shape change in either repo updates both in the same pass. Full contract: `slate/.claude/pricing.md`.
- **Prompting-tips SSOT = `packages/shared/src/prompts/prompting-tips.ts`.** There is NO hand-written tips copy anywhere downstream, ever (a hand-mirrored modal is how Omni Flash shipped showing a Veo body under a Kling title, caught 2026-07-10). **Adding a new model = three entries in THIS repo, same pass: (1) `model-facts.ts` fact, (2) `skills/slates-prompting-{model}.md` skill, (3) `prompting-tips.ts` entry (the curated user-facing subset of the skill).** When a skill's rules change, update the tips entry in the same pass.
  - **🚨 THE DESKTOP NO LONGER RENDERS THE TIPS AT ALL (2026-08-10).** They render in exactly one place: the generated page **<https://slates.video/docs/prompting>**, emitted by `slates-web/scripts/build-llm-docs.mjs` via `scripts/llm-docs/extract-tips.ts`, which imports `PROMPTING_TIPS` from this file. The desktop links to it from the Help menu (`?` in the title bar). *(This bullet previously pointed at `slate/.../prompt/PromptingTipsRenderer.tsx`, which had already been deleted on 2026-08-01 — the tips then lived in a Settings accordion, and now they live on the web. Rationale and the standing rule: `slate/CLAUDE.md` → Prompting-tips SSOT.)*
  - **So a tips edit is not done until slates-web regenerates.** After changing this file run `npm run build:llm-docs` from `slates-web/`; `npm run build` there FAILS on stale docs (`check:llm-docs`). A new key also needs a reading group in `extract-tips.ts`, or it renders on no page — the generator warns by name.
  - Rebuild + copy to slate's node_modules (local) or publish (release) is still how the CLI/MCP side picks changes up. The desktop maps model ids → tips family keys with its MODEL_REGISTRY helpers; content lives only here.
- **Portable Prompt Builder is generated, never authored downstream.** `packages/shared/exports/slates-prompt-builder/prompt-builder.md` owns portable scope/output behavior; its routing table derives from `MODEL_FACTS`, and its references copy the resolved production skills directly after stripping only discovery frontmatter. `npm run sync-prompt-builder` regenerates the Markdown, manifest, and deterministic `.skill`; build/typecheck/prepublish fail if any output is stale. Never edit `exports/slates-prompt-builder/generated/` or the Second Brain lead-magnet mirrors directly.
- **`MODEL_FACTS.kind` is `image | video | audio` (audio added 2026-07-31), and every kind needs a consumer block.** The desktop's `buildModelRouting()` FILTERS `MODEL_FACTS` by kind — a fact whose kind matches no filter compiles, sits in the registry, and is **silently invisible to the Studio Agent**. `AUDIO_MODELS` mirrors `VIDEO_MODELS` (both exported from `operations/index.ts`) as the exact `slates_generate_audio` model-id list. Audio cost keys go through `audioCostKey()`, which must byte-match the desktop's `audioCreditKey()` — asserted by `pricing-consistency-check.mjs` §4. **🚨 Seed Audio has NO duration parameter: the `durationSeconds` an agent passes is written into the prompt AND is what the user is billed**, so the op's clarification gate refuses to guess it.
- **Audio MIN / MAX / DEFAULT seconds live in THREE repos — a change is a three-site edit.** Here (`SEED_AUDIO_MIN_SECONDS` &co, feeding `audioCostKey`), `slate/src/shared/pricing.ts` (MODEL_REGISTRY `audio.durationSeconds`, feeding `clampAudioDuration` + `audioCreditKey`), and `slates-api/src/lib/audio-keys.ts` (the server's fail-closed bounds). `audioCostKey` must **mirror the desktop's clamping exactly, non-finite arm included** — `Math.max(min, NaN)` is NaN, so a missing arm yields the key `seed-audio-NaNs` while the desktop quotes the default. The MINs were absent and the floor was a hardcoded 1, which quoted a real `seed-audio-2s` price for a generation the proxy REJECTS. `pricing-consistency-check.mjs` §4 now sweeps **out-of-range values deliberately** — the property under test is not "is it in range" but "do the two clamp IDENTICALLY", so skipping the values where they can differ skips the whole test.
- **🚨 Model CAPABILITY SSOT = `packages/shared/src/prompts/model-capabilities.ts` (added 2026-08-16).** `MODEL_CAPABILITIES` owns what each model will ACCEPT: aspect ratios (incl. `providerAspectRatios`), video resolutions (incl. `fixed`/`default`), duration windows (incl. `resolutionOverrides`/`modeOverrides`) and reference caps. **Nothing downstream may hand-type one of these facts again.** `operations/index.ts` builds its Zod enums from `aspectRatioUnion` / `videoResolutionUnion` / `durationBounds`, generates every `.describe()` from `describeAspectRatios` / `describeVideoResolutions` / `describeDurations` / `describeReferenceImageCaps`, and gates `slates_generate_video` + `slates_estimate_generation_cost` through `assertVideoCapabilities`. `MODEL_FACTS` derives its reference caps via `caps()`. `slate/src/shared/pricing.ts` spreads the same rows into `MODEL_REGISTRY`.
  - **Why:** the op re-stated all of it by hand and had drifted on every axis — an invented `9:21` (in zero models), "Kling/Seedance support all" (Seedance has no `4:5`; Kling-on-fal takes three ratios), "Veo locks to 16:9" (two on fal), "Kling: 5-15" (min 3), a `videoResolution` line that never mentioned Kling, and 4s quoted for Veo at 1080p. A customer burned a round trip on `4:5` + Seedance: accepted client-side, queued, credits reserved, rejected asynchronously. `pricing-consistency-check` covers COST and `check:composer-mirror` covers PROMPT; CAPABILITY was the one class with no enforcement, which is why it rotted.
  - **Validate against `AGENT_ROUTE_PROVIDER` (`'fal'`), not the direct-API sets.** Agent generations are credits-only and the credits route carries Kling and Veo on fal, so an agent gets Kling's 3 ratios and Veo's 2. Validating against the 8/10 direct sets would accept a ratio fal rejects.
  - **Keep it a dependency-free LEAF.** It ships as its own exports subpath (`./model-capabilities`) with a `default` condition, because slate's renderer bundles it AND the slates-api checkers load it through tsx as CommonJS.
  - **Still open (plan §5):** the IMAGE param surface is unaudited — its ratio enum is now generated (so no phantom values) but is a union, not per-model, so `gpt-image-2`'s five ratios are unenforced. `checkAspectRatio` is ready; wire it the way `assertVideoCapabilities` does.
- **Model routing doctrine SSOT = `packages/shared/src/prompts/model-facts.ts`.** `MODEL_FACTS` (kind: image vs video, default/premium/niche notes) and `VIDEO_MODELS` (the exact `slates_generate_video` model ids) are exported from the package and CONSUMED at runtime by the desktop Studio Agent system prompt (`slate/src/main/studio-agent/context.ts` derives its MODEL ROUTING block and model-id list from them — added 2026-07-03 after the agent suggested Seedance, a video-only model, as an image generator from a hand-written prose copy). Editing routing = edit `model-facts.ts` (+ `skills/slates-model-selection.md` for the long-form table) and rebuild. NEVER restate model routing in op descriptions, skill files, or desktop prompt prose — point at `slates-model-selection` / derive from `MODEL_FACTS` instead. Op descriptions that duplicate the doctrine are a bug: they drift AND bloat the desktop's cached token prefix.
- **Asset params take UUIDs OR badge codes.** Generation ops resolve refs ("IMG-A8", bare "a8") against the project AT CALL TIME via `resolveAssetRefs()` and echo the resolved code+label in every result. New ops with asset-id params must use the same helper — stale-code guessing burned a real $4.44 render on the wrong start frame (2026-07-03).
- **The desktop consumes the PUBLISHED npm package, not this working tree.** Local iteration: `npm run build`, then copy `packages/shared/{dist,package.json,skills}` into `slate/node_modules/@slatesvideo/shared/` so the in-app Studio Agent picks changes up without a publish. `slate/scripts/check-shared-version.mjs` screams on version drift at dev startup. Shipping to users = publish + bump slate's dep + desktop release (publish BEFORE the release build, in that order).

## Build

```bash
npm install
npm run build       # builds shared → mcp → cli in order
npm run typecheck   # whole-monorepo type check
```

## Adding a new operation

1. Open `packages/shared/src/operations/index.ts`.
2. Define a `const newThing: Operation<{...}>` with id, description, Zod input schema, and `run`.
3. Add to `ALL_OPERATIONS`.
4. Rebuild. Both MCP and CLI now expose it.

If the op needs new desktop endpoints, add the route in `slate/src/main/agent/routes.ts` first, then call it from the desktop client.

## Adding a new skill

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
   - **Workflow skills** (`slates-one-prompt-film`, `slates-direct-response-ad`, `slates-storyboard-from-script`, etc.) compose multiple ops into a recipe. Cap ~6 — more than that and the LLM can't tell which one fires. Currently AT the cap (6).
   - **Per-model prompting skills** (`slates-prompting-nano-banana-2`, `slates-prompting-veo-3`, etc.) fire when calling the matching `slates_generate_*` op. Naming convention: `slates-prompting-{model}.md`. One per model variant family. The audio lane adds two: `slates-prompting-seed-audio` and `slates-prompting-elevenlabs` (Sound Effects v2 — the ElevenLabs TTS surface was removed 2026-08-01, so that skill is SFX-only and `tts`/`voiceover` alias to Seed Audio instead). ⚠️ In `resolveGuideTopic()` the `seed-audio` alias MUST be tested **before** `seedance` — "seed-audio" also starts with "seed", and falling through hands the video guide to an audio model.
   - **Per-style prompting** (`slates-style-prompting`) — cross-model style depth (photoreal/anime/painterly/3d-render on Seedance vs Kling vs NB2). Fires on style requests; style names alias to it in `resolveGuideTopic()`. SSOT: born in second-brain `research/style-prompting-research.md`, encoded here — never author style content directly in this file.
   - **Cross-cutting hygiene skills** (`slates-cost-discipline`) fire on every generation call regardless of model. Should be rare — only add when a discipline applies across many ops.
6. If the skill maps to a model id, extend the alias table in `resolveGuideTopic()` (operations/index.ts) so `slates_get_prompting_guide` resolves the model id to it.
