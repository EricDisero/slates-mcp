# @slatesvideo/mcp-server

MCP server for the [Slates](https://slates.video) desktop app. Your AI agent (Claude, Cursor, or any MCP client) drives a local video studio: it creates projects, builds characters and storyboards, generates images and videos, and organizes assets. Files land on disk, and the Slates app updates live as the agent works.

## Requirements

- The Slates desktop app, installed and running. Get it at [slates.video](https://slates.video).
- Node.js 18 or newer.

## Claude Desktop

Add this to your config file:

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

Config file locations:

- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

Restart Claude Desktop. The Slates tools appear in the tool palette.

## Claude Code

One command:

```bash
claude mcp add slates -- npx -y @slatesvideo/mcp-server
```

Tip: with Claude Code you can skip the MCP server entirely and use the CLI instead (`npm i -g @slatesvideo/cli`), which keeps the tool schemas out of your context window. See [@slatesvideo/cli](https://www.npmjs.com/package/@slatesvideo/cli).

## Cursor

Add the same entry to `~/.cursor/mcp.json`:

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

## Connecting your account

The server reads its credentials from `~/.slates/agent-connection.json`. Two ways to create it:

1. In the Slates app: **Settings → Agent Control → enter your email → Send link**. Click the link in your email. Done.
2. From a terminal: `npx @slatesvideo/cli login`.

No environment variables, no API keys to paste into config files.

## What the agent can do

64 tools covering the full workspace: project, folder, character, environment, style, and storyboard management (create / update / delete), image generation and surgical image editing (Nano Banana 2, FLUX.2 Max, Seedream 5 Lite — with project-asset reference images), video generation (Kling V3, Veo 3.1, Seedance 2.0), lip sync, motion transfer, background generation with status polling, timeline assembly (add / reorder / remove clips), MP4 export and FCP7 XML export for DaVinci Resolve, cost estimation, and credit balance. Bundled prompting/workflow guides are readable at runtime via the `slates_get_prompting_guide` tool — no skill installation needed for MCP-only clients.

Generation tools estimate cost first and ask for confirmation on anything over $0.50, so the agent cannot silently burn credits.

The timeline, export, background-generation, edit-image, and image-reference tools require a Slates desktop on agent API v2 — if a tool reports a version error, update Slates (Settings → Check for Updates) and retry.

## Links

- Website: [slates.video](https://slates.video)
- Source: [github.com/EricDisero/slates-mcp](https://github.com/EricDisero/slates-mcp)
- Issues: [github.com/EricDisero/slates-mcp/issues](https://github.com/EricDisero/slates-mcp/issues)
