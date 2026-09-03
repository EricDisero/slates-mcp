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
    │     clients/blender.ts    ← 127.0.0.1:9876-9879 TCP bridge into the slates-blender add-on
    │     operations/index.ts   ← single source of truth for the tool surface
    │     prompts/shot-spec.ts  ← ShotSpec + THE attachment-role list + the script layer (mirrored into slate)
    │     prompts/shot-grammar.ts ← framing buckets + the MEASURED speech rate (leaf subpath)
    │     skills/content.ts     ← GENERATED — embedded SKILLS record, do not edit
    │     index.ts              ← public re-exports
    ├── mcp/                    ← @slatesvideo/mcp-server (stdio MCP, bin: slates-mcp-server)
    │   src/server.ts
    │   manifest.json           ← Claude Desktop .mcpb manifest
    │   scripts/stage-mcpb.mjs  ← stages dist-mcpb/ for `npm run build:mcpb`
    └── cli/                    ← @slatesvideo/cli (bin: slates)
        src/index.ts
        src/commands/{login,logout,status,doctor,setup,use,op,install-skills,mcp,completion}.ts
```

## Hard rules

- **Never duplicate operation logic.** Both surfaces register the same `ALL_OPERATIONS` array. Adding a new tool = one edit in `packages/shared/src/operations/index.ts`, then both surfaces ship it.
- **No native deps.** Pure TS + `@modelcontextprotocol/sdk` + `commander` + `zod` + `zod-to-json-schema`. No FFmpeg, no sharp, no canvas. The desktop side handles binary work.
- **Bearer tokens only flow to their intended hosts.** `slates_sk_` to `slates-api.fly.dev`; the desktop token to `127.0.0.1:PORT`. The clients enforce this — never bypass.
- **Connection file is the single source of truth.** Don't add a second config or env-var path. The CLI's `slates login` writes it, the desktop app writes the desktop side, both surfaces read it.
- **Cost-key builders must byte-match the desktop's.** `videoCostKey()` in `operations/index.ts` mirrors `klingCreditKey`/`seedanceCreditKey` in `slate/src/shared/pricing.ts` — every key dimension (resolution incl 4K, face/realface, audio) must be reflected here or agent pre-flight quotes diverge from what's billed (the Kling-4K quote gap shipped exactly this way, caught 2026-07-02). Any key-shape change in either repo updates both in the same pass. Full contract: `slate/.claude/pricing.md`.
- **Everything below `operations/index.ts` and `prompts/` is SSOT for something downstream.**
  Prompting tips, model facts and routing, model capabilities, the agent doctrine, banned tokens,
  the shot spec and its attachment-role union, the framing grammar and the measured speech rate,
  the variety counts and `Operation.billable` all live in this package and are consumed by the
  desktop, the MCP server and the CLI. **Never hand-type one of those facts downstream, and never
  restate model routing in an op description or a skill.** Each lock, why it exists and the
  publish-before-you-build obligation it creates: `.claude/rules/ssot.md`, which loads on any file
  under `packages/shared/src/prompts/` or in the ops registry.
- **Asset params take UUIDs OR badge codes.** Generation ops resolve refs ("IMG-A8", bare "a8") against the project AT CALL TIME via `resolveAssetRefs()` and echo the resolved code+label in every result. New ops with asset-id params must use the same helper — stale-code guessing burned a real $4.44 render on the wrong start frame (2026-07-03).
- **The desktop consumes the PUBLISHED npm package, not this working tree.** Local iteration: `npm run build`, then copy `packages/shared/{dist,package.json,skills}` into `slate/node_modules/@slatesvideo/shared/` so the in-app Studio Agent picks changes up without a publish. `slate/scripts/check-shared-version.mjs` screams on version drift at dev startup. ⚠️ **The copy is not enough on its own — restart the app**: `context.ts` caches the system prompt for the process lifetime, so a rebuilt doctrine or a changed op description is invisible until it reboots. Shipping to users: **`slates-api/docs/coordinated-release-runbook.md` owns the order** — it is the only copy, and this line used to be one of several restatements that could disagree.
- **🚨 The Blender bridge is a SEPARATE GPL-3.0 program — keep the boundary clean (added 2026-08-28).** `slates_blender_*` ops talk over a localhost TCP socket to the `slates-blender` add-on (its own repo, `C:\Coding Projects\slates\slates-blender`). That add-on links `bpy` and is therefore GPL, as every Blender add-on is; **this repo stays proprietary because the boundary is a socket, and GPL propagates through linkage, not across a process.** So: never vendor add-on code into this package, and never import from it. The wire protocol (`{type:"execute",code,strict_json}` → `{status,result,stdout,stderr}`, NUL-delimited JSON) is the whole contract, it is documented in `clients/blender.ts` and in the add-on's `CLAUDE.md`, and **changing it is a two-repo edit**.
  - **No camera-move library, ever.** Camera work is `bpy` written by the agent against the Blender docs the add-on ships, steered by the `slates-previs-blocking` / `slates-camera-language` skills. A fixed menu of moves caps the workflow at whatever we thought of; the skills are where this evolves, and they cost nothing to change.
  - **⛔ ONE THING LEFT BEFORE PUBLISHING THESE OPS: a real Blender.** The page and the download landed 2026-08-28 — `https://slates.video/blender` exists (`slates-web/src/app/blender/page.tsx`) and serves the add-on zip from the public Tigris bucket, so `BLENDER_SETUP_HINT` no longer promises a 404. What has NOT happened is `previs.py` / `scene.py` running inside an actual Blender; everything below `bpy` is proven (socket, prelude, `_mod` resolution, and the DEFERRED render round-trip, all driven end-to-end against `slates-blender/tests/serve_stub.py`), but the `bpy` calls themselves have only been checked against the bundled 5.1 reference and upstream's own tools. Publish after one real render. ⚠️ **Their prefix cost is now zero, and this note used to be the mechanism that kept it low.** Since 2026-09-02 the six ops are the `blender` TIER GROUP: the desktop does not send them until `slates_load_tools` asks for them, so their POSITION in `ALL_OPERATIONS` no longer decides anything. They stay last anyway — registry order is the reading order on the MCP surface, which sends everything.
  - **The blocking clip is just a video asset.** `slates_blender_render_blocking` imports through the same `/agent/assets/upload` route as `slates_upload_reference_image`, and its asset id goes into `slates_generate_video`'s existing `videoReferenceAssetIds`. No bespoke generation path — if you find yourself adding one, the design has drifted.

## Build

```bash
npm install
npm run build       # shared → mcp → cli, then the agent-surface lockstep check
npm run typecheck   # whole-monorepo type check
npm run check:agent-surface   # just the lockstep check (needs a built dist)
```

`scripts/agent-surface-lockstep-check.mjs` runs at the end of `npm run build`. It has eight numbered
checks and **prints its own numbers** — the op count, the doctrine size, the per-turn byte total —
so nothing downstream has to restate them in prose (which is exactly how they went stale):

| # | Asserts |
|---|---|
| 1 | Both surfaces render through the ONE `toolDefinitions()`, same op id set, no surface-private capability (`present_plan` is the documented exception) |
| 2 | The MCP server passes non-empty `instructions` from `buildAgentDoctrine` within the byte ceiling, and advertises the four protocol capabilities |
| 3 | Neither consumer contains doctrine prose of its own |
| 4 | Every banned token inlined into an op description still appears in its source skill's `@banned` block |
| 5 | `MODEL_FACTS.notes` stays ROUTING — no prices, durations or counts — and every lane reaches an op |
| 6 | Every op carries all four MCP annotations, and none is contradicted by its own transport verbs |
| 7 | The CORE tool surface is under its byte ceiling, every deferred op is loadable, and the per-turn total is reported |
| 8 | Every per-model skill carries a craft card (under its ceiling, leading the file, naming ≥5 levers) and its own never-use list |

**Every one is mutation-tested** — break it, confirm red, restore, confirm green. A checker nobody has
seen fail is not a checker. `scripts/mcp-instructions-smoke.mjs` then spawns the real stdio server and
reads the doctrine, the annotations, a prompt, a resource, structured content and a flattened
validation error back off a real client. The desktop half of checks 1 and 3 skips with a warning when
`../slate` is not on disk, per the sibling-repo rule.

## Adding a new operation

1. Open `packages/shared/src/operations/index.ts`.
2. Define a `const newThing: Operation<{...}>` with id, description, Zod input schema, and `run`.
3. Add to `ALL_OPERATIONS`.
4. Rebuild. Both MCP and CLI now expose it.

If the op needs new desktop endpoints, add the route in `slate/src/main/agent/routes.ts` first, then call it from the desktop client.

## Adding a new skill

**Bundled skills in `packages/shared/skills/` are FREE product quality and ship inside the public
npm tarball. Paid pack skills live in `pack-skills/` at the repo root and must never be put there**
— an entitlement filter over a public artifact protects nothing; not shipping the file is the only
gate. The frontmatter, the four skill categories, the `resolveGuideTopic()` alias table and the
endpoint-schema-beats-model-card rule: `.claude/rules/skills.md`.
