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

1. Drop a markdown file with frontmatter into `packages/shared/skills/`.
2. Frontmatter must include `name:` and `description:` for skill discovery.
3. Rebuild — `scripts/embed-skills.mjs` runs as shared's prebuild and regenerates `src/skills/content.ts` (the `SKILLS` record). The CLI's `install-skills` and the `slates_get_prompting_guide` op both read from that record; never edit the generated file by hand.
4. Three categories — keep them separate:
   - **Workflow skills** (`slates-one-prompt-film`, `slates-direct-response-ad`, `slates-storyboard-from-script`, etc.) compose multiple ops into a recipe. Cap ~6 — more than that and the LLM can't tell which one fires. Currently AT the cap (6).
   - **Per-model prompting skills** (`slates-prompting-nano-banana-2`, `slates-prompting-veo-3`, etc.) fire when calling the matching `slates_generate_*` op. Naming convention: `slates-prompting-{model}.md`. One per model variant family.
   - **Per-style prompting** (`slates-style-prompting`) — cross-model style depth (photoreal/anime/painterly/3d-render on Seedance vs Kling vs NB2). Fires on style requests; style names alias to it in `resolveGuideTopic()`. SSOT: born in second-brain `research/style-prompting-research.md`, encoded here — never author style content directly in this file.
   - **Cross-cutting hygiene skills** (`slates-cost-discipline`) fire on every generation call regardless of model. Should be rare — only add when a discipline applies across many ops.
5. If the skill maps to a model id, extend the alias table in `resolveGuideTopic()` (operations/index.ts) so `slates_get_prompting_guide` resolves the model id to it.
