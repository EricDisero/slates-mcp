# slates-mcp — Claude code notes

This is the MCP server + CLI + skills monorepo for Slates. Treat it as a thin transport layer over slates-api (cloud) and the slate desktop app's local HTTP server.

## Layout

```
slates-mcp/
├── package.json                ← npm workspaces root
├── tsconfig.json               ← shared compiler options
└── packages/
    ├── shared/                 ← @slatesvideo/shared
    │   src/
    │     auth.ts               ← read/write ~/.slates/agent-connection.json
    │     clients/cloud.ts      ← slates-api HTTP client
    │     clients/desktop.ts    ← 127.0.0.1:PORT HTTP client
    │     operations/index.ts   ← single source of truth for the tool surface
    │     index.ts              ← public re-exports
    ├── mcp/                    ← @slatesvideo/mcp-server (stdio MCP, bin: slates-mcp-server)
    │   src/server.ts
    └── cli/                    ← @slatesvideo/cli (bin: slates)
        src/index.ts
        src/commands/{login,logout,status,op,install-skills}.ts
        skills/*.md             ← bundled agent recipes
```

## Hard rules

- **Never duplicate operation logic.** Both surfaces register the same `ALL_OPERATIONS` array. Adding a new tool = one edit in `packages/shared/src/operations/index.ts`, then both surfaces ship it.
- **No native deps.** Pure TS + `@modelcontextprotocol/sdk` + `commander` + `zod` + `zod-to-json-schema`. No FFmpeg, no sharp, no canvas. The desktop side handles binary work.
- **Bearer tokens only flow to their intended hosts.** `slates_sk_` to `slates-api.fly.dev`; the desktop token to `127.0.0.1:PORT`. The clients enforce this — never bypass.
- **Connection file is the single source of truth.** Don't add a second config or env-var path. The CLI's `slates login` writes it, the desktop app writes the desktop side, both surfaces read it.

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

1. Drop a markdown file with frontmatter into `packages/cli/skills/`.
2. Frontmatter must include `name:` and `description:` for skill discovery.
3. Two categories — keep them separate:
   - **Workflow skills** (`slates-direct-response-ad`, `slates-storyboard-from-script`, etc.) compose multiple ops into a recipe. Cap ~6 — more than that and the LLM can't tell which one fires.
   - **Per-model prompting skills** (`slates-prompting-nano-banana-2`, `slates-prompting-veo-3`, etc.) fire when calling the matching `slates_generate_*` op. Naming convention: `slates-prompting-{model}.md`. One per model variant family.
   - **Cross-cutting hygiene skills** (`slates-cost-discipline`) fire on every generation call regardless of model. Should be rare — only add when a discipline applies across many ops.
