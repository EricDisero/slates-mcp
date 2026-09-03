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

<!-- gen:tool-count -->91<!-- /gen:tool-count --> tools covering the full workspace: project, folder, character, environment, style, and storyboard management (create / update / delete), image generation and surgical image editing (<!-- gen:image-roster -->Nano Banana 2 (Gemini 3.1 Flash Image), Nano Banana 2 Lite, Nano Banana Pro, GPT Image 2, FLUX.2 Max, Seedream 5 Lite<!-- /gen:image-roster --> — with project-asset reference images), video generation (<!-- gen:video-roster -->kling-v3.0-std, kling-v3.0-pro, kling-v3.0-omni, veo-3.1-fast, veo-3.1-standard, Seedance 2.0, Seedance 2.5, Gemini Omni Flash, MiniMax H3, MiniMax H3 Max, LTX-2.5, LTX-2.5 Pro<!-- /gen:video-roster -->), audio generation (<!-- gen:audio-roster -->Seed Audio 1.0, ElevenLabs Sound Effects v2<!-- /gen:audio-roster -->), lip sync, motion transfer, background generation with status polling, timeline assembly (add / reorder / remove clips), MP4 export and FCP7 XML export for DaVinci Resolve, cost estimation, and credit balance. Bundled prompting/workflow guides are readable at runtime via the `slates_get_prompting_guide` tool — no skill installation needed for MCP-only clients.

Generation tools estimate cost first and ask for confirmation on anything over <!-- gen:confirm-credits -->17<!-- /gen:confirm-credits --> credits, so the agent cannot silently burn credits. Every tool also carries MCP annotations, so a host can auto-approve a read and warn on a delete; the <!-- gen:skill-count -->33<!-- /gen:skill-count --> bundled skills are exposed as MCP **prompts**, and the manual, the model capability table and the live price list as **resources**.

The timeline, export, background-generation, edit-image, and image-reference tools require a Slates desktop on agent API v2 — if a tool reports a version error, update Slates (Settings → Check for Updates) and retry.

## Links

- Website: [slates.video](https://slates.video)
- Source: [github.com/EricDisero/slates-mcp](https://github.com/EricDisero/slates-mcp)
- Issues: [github.com/EricDisero/slates-mcp/issues](https://github.com/EricDisero/slates-mcp/issues)
