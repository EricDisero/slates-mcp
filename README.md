# slates-mcp

MCP server + CLI + skills package for [Slates](https://slates.video) — drive the AI Video Creation Studio from Claude Code, Cursor, Claude Desktop, ChatGPT, or any MCP-capable client.

This monorepo publishes three packages:

- **`@slatesvideo/mcp-server`** — stdio MCP server. Run with `npx -y @slatesvideo/mcp-server`.
- **`@slatesvideo/cli`** — `slates` binary. Run with `npm i -g @slatesvideo/cli`.
- **`@slatesvideo/skills`** — agent-side recipe markdown files (bundled inside the CLI package; install with `slates install-skills`).

## What it does

The MCP/CLI lets an AI agent control your Slates workspace end to end: create projects, build characters and storyboards, generate images and videos, organize assets, and watch the desktop app populate live as the agent works.

Both surfaces share one operations layer (`@slatesvideo/shared`) and one config file (`~/.slates/agent-connection.json`).

## Setup

1. Install or update Slates desktop. Open it.
2. **Settings → Agent Control → toggle on.** This starts a local HTTP server on `127.0.0.1:27272` (or the next free port) and writes the connection file.
3. Inside Settings → Agent Control, click **Send link** to authorize this machine. You'll get an email with a sign-in link. Click it.
4. The connection file now has both:
   - `desktop` — port + token for the local server
   - `cloud` — `slates_sk_` token for [slates-api](https://slates-api.fly.dev)

That's it. Both the CLI and the MCP auto-discover the connection file. No env vars, no copy-paste.

## Using it

### MCP server (Claude / Cursor / Claude Desktop / ChatGPT)

Add to your MCP config:

```json
{
  "mcpServers": {
    "slates-studio": {
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
slates install-skills         # writes recipe files to ./.claude/skills/
slates status                 # show connection state
slates run --list             # list every operation
slates run slates_create_project --name "neon samurai"
```

In Claude Code, the agent shells out to `slates run <op> --key value` instead of loading 25 tool schemas into context. Skills (in `./.claude/skills/`) provide higher-level recipes — direct-response ad, character turnaround, storyboard from script, vision feedback loop, edit-and-iterate.

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

@slatesvideo/mcp-server
    server.ts                            ← stdio server, registers operations as MCP tools

@slatesvideo/cli
    src/index.ts                         ← commander entry
    src/commands/login.ts                ← magic-link polling
    src/commands/op.ts                   ← `slates run <op>` dispatcher
    skills/                              ← bundled markdown recipes
```

Operations choose their transport internally. `slates_get_credit_balance` hits the cloud. `slates_create_project` hits the desktop. `slates_generate_image` hits the cloud, then the desktop client writes the resulting asset to the local project folder. The user watches it appear in the Slates UI as it lands.

## Privacy + security

- The desktop server is bound to `127.0.0.1` only. It rejects any non-loopback connection at the OS level.
- Every request is checked for an empty `Origin` header (kills browser-fetch attacks) and a loopback `Host` header (kills DNS rebinding) before the bearer token is even read.
- The `slates_sk_` token is only ever sent to `slates-api.fly.dev`. Override with `SLATES_CLOUD_BASE_URL` only if you know what you're doing.
- Tokens are revocable from Slates desktop Settings → Agent Control → Disconnect. Once revoked, the previous token's hash never authenticates again.

## License

Unlicensed (proprietary). Contact ericdisero@gmail.com for licensing questions.
