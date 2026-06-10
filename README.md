# slates-mcp

MCP server + CLI + skills package for [Slates](https://slates.video) — drive the AI Video Creation Studio from Claude Code, Cursor, Claude Desktop, ChatGPT, or any MCP-capable client.

This monorepo publishes two installable packages, plus their shared core:

- **`@slatesvideo/mcp-server`** — stdio MCP server. Run with `npx -y @slatesvideo/mcp-server`.
- **`@slatesvideo/cli`** — `slates` binary. Run with `npm i -g @slatesvideo/cli`.
- **`@slatesvideo/shared`** — the operations layer both surfaces depend on (published as their dependency, not installed directly).

Agent-side recipe markdown ("skills") lives in `packages/shared/skills/` and is embedded into `@slatesvideo/shared` at build time — install into your project with `slates install-skills`, or (MCP-only clients) read any guide at runtime via the `slates_get_prompting_guide` tool.

## What it does

The MCP/CLI lets an AI agent control your Slates workspace end to end: create projects, build characters and storyboards, generate images and videos (blocking or in the background), surgically edit images, assemble clips on the editing timeline, export the result as an MP4 (or FCP7 XML for DaVinci Resolve), and watch the desktop app populate live as the agent works. 64 tools total.

Both surfaces share one operations layer (`@slatesvideo/shared`) and one config file (`~/.slates/agent-connection.json`).

> **Desktop version note:** the timeline, export, background-generation, edit-image, and image-reference tools need a Slates desktop on agent API v2. If a tool reports a version error, update Slates (Settings → Check for Updates) and retry. Everything else works on older desktops.

## Setup

1. Install or update Slates desktop. Open it.
2. **Settings → Agent Control → enter your email → Send link.** This one click starts the local HTTP server on `127.0.0.1:27272` (or the next free port) AND emails you a sign-in link.
3. Click the link in your email to authorize this machine.
4. The connection file is now written with both:
   - `desktop` — port + token for the local server
   - `cloud` — `slates_sk_` token for [slates-api](https://slates-api.fly.dev)

That's it. Both the CLI and the MCP auto-discover the connection file. No env vars, no copy-paste. (Need the local server without the cloud token? There's a raw server toggle under **Advanced** — most people don't need it.)

## Using it

### MCP server (Claude / Cursor / Claude Desktop / ChatGPT)

Add to your MCP config:

```json
{
  "mcpServers": {
    "slates": {
      "command": "npx",
      "args": ["-y", "@slatesvideo/mcp-server"]
    }
  }
}
```

Restart your client. Slates tools appear in the tool palette.

### CLI (Claude Code, terminal scripts)

```bash
npm i -g @slatesvideo/cli
slates login                  # only if you haven't connected via Settings
slates install-skills         # installs skills to ./.claude/skills/<name>/SKILL.md
slates mcp                    # detect MCP clients, print (or --write) their config
slates status                 # show connection state
slates run --list             # list every operation
slates run slates_create_project --name "neon samurai"
```

In Claude Code, the agent shells out to `slates run <op> --key value` instead of loading 64 tool schemas into context. The 15 bundled skills provide higher-level recipes — workflow skills (one-prompt film, direct-response ad, character turnaround, storyboard from script, vision feedback loop, edit-and-iterate), per-model prompting guides (Kling V3, Veo 3.1, Seedance 2.0, Nano Banana 2, FLUX.2 Max, Seedream 5 Lite, lip sync, motion transfer), and cost discipline.

## Architecture

```
~/.slates/agent-connection.json          ← single source of truth
        │
        ├── cloud.token   (slates_sk_)   ← carried in Authorization headers to slates-api
        └── desktop.{port,token}         ← carried in Authorization headers to 127.0.0.1:PORT

@slatesvideo/shared
    operations/index.ts                  ← single tool surface
    clients/cloud.ts                     ← https://slates-api.fly.dev
    clients/desktop.ts                   ← http://127.0.0.1:PORT
    auth.ts                              ← read/write connection file
    skills/                              ← bundled markdown recipes (embedded at build time)

@slatesvideo/mcp-server
    server.ts                            ← stdio server, registers operations as MCP tools

@slatesvideo/cli
    src/index.ts                         ← commander entry
    src/commands/login.ts                ← magic-link polling
    src/commands/op.ts                   ← `slates run <op>` dispatcher
    src/commands/install-skills.ts       ← writes embedded skills to .claude/skills/
```

Operations choose their transport internally. `slates_get_credit_balance` hits the cloud. `slates_create_project` hits the desktop. `slates_generate_image` hits the cloud, then the desktop client writes the resulting asset to the local project folder. The user watches it appear in the Slates UI as it lands.

## Publishing

Publish order matters: `@slatesvideo/shared` must land before `@slatesvideo/mcp-server` and `@slatesvideo/cli` (both depend on it at an exact version). Always publish from the repo root with:

```bash
npm run publish:all
```

This builds everything first, then publishes shared → mcp → cli with `--access public`. Each package also has a `prepublishOnly` build hook, so a stray `npm publish` from a fresh clone can't ship an empty `dist`.

## Privacy + security

- The desktop server is bound to `127.0.0.1` only. It rejects any non-loopback connection at the OS level.
- Every request is rejected if it carries a cross-origin `Origin` header (kills browser-fetch attacks) or a non-loopback `Host` header (kills DNS rebinding), before the bearer token is even read.
- The `slates_sk_` token is sent only to the configured cloud host (`slates-api.fly.dev` by default). `SLATES_CLOUD_BASE_URL` can override the host for dev/staging, but only over `https://` (or `http://localhost`) — an insecure override is ignored so the token can't be exfiltrated or sent in cleartext.
- Disconnect (Slates desktop → Settings → Agent Control) revokes the `slates_sk_` token server-side and clears it locally. Once revoked, that token's hash never authenticates again — so a leaked copy stops working too.

## License

MIT — see [LICENSE](LICENSE). Copyright Blueprint Online Learning Inc.
