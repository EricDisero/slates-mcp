# @slatesvideo/cli

The `slates` command for the [Slates](https://slates.video) AI video studio. Drive Slates from your terminal, or let Claude Code shell out to it instead of loading <!-- gen:tool-count -->91<!-- /gen:tool-count --> tool schemas into context.

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
| `slates run <op>` | Invoke any Slates operation by id; `--list` shows all <!-- gen:tool-count -->91<!-- /gen:tool-count -->, `<op> --help` shows one op's flags |
| `slates run <op> --input '<json>'` | Pass a NESTED object (Shot `params`/`refs`, batch updates) — flags cannot express those |
| `slates use <project>` | Set the default project, by id or name, so ops stop needing `--projectId` |
| `slates doctor` | Check every setup precondition and print the fix for each failure |
| `slates completion bash\|zsh\|pwsh` | Shell completion for the operation ids |

## Skills

<!-- gen:skill-count -->33<!-- /gen:skill-count --> agent skills ship embedded in `@slatesvideo/shared`: <!-- gen:workflow-skill-count -->18<!-- /gen:workflow-skill-count --> workflow recipes (<!-- gen:workflow-skills -->blocking-to-prompt, camera-language, character-identity, content-policy, cost-discipline, dialogue-blocking, direct-response-ad, edit-and-iterate, model-selection, one-prompt-film, previs-blocking, project-organization, restyle-from-blocking, shot-variety, storyboard-from-script, style-prompting, ugc-influencer-ad, vision-feedback-loop<!-- /gen:workflow-skills -->) and <!-- gen:per-model-skill-count -->15<!-- /gen:per-model-skill-count --> per-model prompting guides covering <!-- gen:video-roster -->kling-v3.0-std, kling-v3.0-pro, kling-v3.0-omni, veo-3.1-fast, veo-3.1-standard, Seedance 2.0, Seedance 2.5, Gemini Omni Flash, MiniMax H3, MiniMax H3 Max, LTX-2.5, LTX-2.5 Pro<!-- /gen:video-roster -->, <!-- gen:image-roster -->Nano Banana 2 (Gemini 3.1 Flash Image), Nano Banana 2 Lite, Nano Banana Pro, GPT Image 2, FLUX.2 Max, Seedream 5 Lite<!-- /gen:image-roster --> and <!-- gen:audio-roster -->Seed Audio 1.0, ElevenLabs Sound Effects v2<!-- /gen:audio-roster -->.

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
- Generation ops gate on missing `aspectRatio`/`resolution` and on cost over <!-- gen:confirm-credits -->17<!-- /gen:confirm-credits --> credits (`confirm=true` required), so a scripted run cannot silently overspend. The exit code says which: **0** done, **1** error, **3** confirm required, **4** clarification required, **5** desktop unreachable, **6** not signed in.

## First-time setup

1. Install and open the Slates desktop app.
2. **Settings → Agent Control → enter your email → Send link.** Click the emailed link.
3. `slates status` should now show your account. (Alternative: `slates login`.)

Credentials live in `~/.slates/agent-connection.json`. No env vars.

## Links

- Website: [slates.video](https://slates.video)
- Source: [github.com/EricDisero/slates-mcp](https://github.com/EricDisero/slates-mcp)
- Issues: [github.com/EricDisero/slates-mcp/issues](https://github.com/EricDisero/slates-mcp/issues)
