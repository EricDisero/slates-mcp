# @slatesvideo/cli

The `slates` command for the [Slates](https://slates.video) AI video studio. Drive Slates from your terminal, or let Claude Code shell out to it instead of loading 64 tool schemas into context.

## Install

```bash
npm i -g @slatesvideo/cli
```

Requires Node.js 18+ and the Slates desktop app ([slates.video](https://slates.video)).

## Commands

| Command | What it does |
|---|---|
| `slates login` | Authorize this machine via magic link (or `--token slates_sk_...`) |
| `slates logout` | Clear the stored cloud token |
| `slates status` | Show connection state, account, and credit balance |
| `slates mcp` | Detect installed MCP clients and print the exact config for each; `--write` merges it into Claude Desktop / Cursor configs (with a `.bak` backup) |
| `slates install-skills` | Install the bundled agent skills into `.claude/skills/<name>/SKILL.md`; `--global` targets `~/.claude/skills` |
| `slates run <op>` | Invoke any Slates operation by id; `--list` shows all 64 |

## Skills

15 agent skills ship embedded in `@slatesvideo/shared`: workflow recipes (one-prompt film, direct-response ad, storyboard from script, character turnaround, edit-and-iterate, vision feedback loop), per-model prompting guides (Kling V3, Veo 3.1, Seedance 2.0, Nano Banana 2, FLUX.2 Max, Seedream 5 Lite, lip sync, motion transfer), and cost discipline.

`slates install-skills` writes each one to `.claude/skills/<skill-name>/SKILL.md` in your current project, which is the layout Claude Code's skill discovery requires. Use `--global` to install for every project. Restart Claude Code afterward, then ask: "what slates skills do you have?" to verify.

## Using `slates run` (agent-driven)

```bash
# List every operation
slates run --list

# Create a project
slates run slates_create_project --name "neon samurai"

# Estimate before generating (the cost-discipline skill makes agents do this)
slates run slates_estimate_generation_cost --model kling-v3-standard-5s

# Generate an image into a project
slates run slates_generate_image --projectId <uuid> --prompt "..." --resolution 1k --aspectRatio 16:9

# Kick off a video in the background, then poll it
slates run slates_generate_video --projectId <uuid> --model veo-3.1-fast --prompt "..." --aspectRatio 16:9 --duration 8 --background true --confirm true
slates run slates_get_generation_status --generationId <uuid>

# Assemble + export
slates run slates_add_clip_to_timeline --projectId <uuid> --assetId <uuid>
slates run slates_export_video --projectId <uuid> --outputPath "C:\\Videos\\ad.mp4"

# Structured output for scripting
slates run slates_get_credit_balance --json
```

> The timeline, export, background-generation, edit-image, and image-reference ops need a Slates desktop on agent API v2 — if an op reports a version error, update Slates (Settings → Check for Updates) and retry.

Notes for agent use:

- Repeated flags or comma lists become arrays: `--ids a,b,c`.
- `--json` emits `{text, data, images}`. Image entries carry `mimeType` and byte count only, not the binary. Use the MCP server (`@slatesvideo/mcp-server`) when the agent needs to see generated images inline.
- Generation ops gate on missing `aspectRatio`/`resolution` and on cost over $0.50 (`confirm=true` required), so a scripted run cannot silently overspend.

## First-time setup

1. Install and open the Slates desktop app.
2. **Settings → Agent Control → enter your email → Send link.** Click the emailed link.
3. `slates status` should now show your account. (Alternative: `slates login`.)

Credentials live in `~/.slates/agent-connection.json`. No env vars.

## Links

- Website: [slates.video](https://slates.video)
- Source: [github.com/EricDisero/slates-mcp](https://github.com/EricDisero/slates-mcp)
- Issues: [github.com/EricDisero/slates-mcp/issues](https://github.com/EricDisero/slates-mcp/issues)
