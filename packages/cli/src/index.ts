#!/usr/bin/env node
import { Command } from 'commander'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readConnection, setCloudToken, clearCloudToken } from '@slatesvideo/shared'
import { runLogin } from './commands/login.js'
import { runLogout } from './commands/logout.js'
import { runStatus } from './commands/status.js'
import { runOp } from './commands/op.js'
import { runInstallSkills } from './commands/install-skills.js'
import { runMcp } from './commands/mcp.js'
import { runSetup } from './commands/setup.js'
import { ALL_OPERATIONS, type Operation } from '@slatesvideo/shared'

// Slates CLI. The CLI mirrors the MCP tool surface as commands so Claude
// Code can shell out to them instead of loading every tool schema into
// its context window. Bundled skills (embedded in @slatesvideo/shared,
// installed via `slates install-skills`) tell the agent how to compose
// the operations into recipes.
//
// First-time use:
//   1. Open Slates desktop → Settings → Agent Control → Send link.
//   2. Click the link in your email (or run `slates login`).
//   3. The connection is written to ~/.slates/agent-connection.json —
//      cloud token + the desktop app's local port + token.
//
// Inside Claude Code:
//   slates run slates_create_project --name "neon samurai"
//   slates run slates_generate_image --prompt "..." --resolution 1k --aspectRatio 16:9
//
// Run `slates install-skills` to copy the bundled skills into
// .claude/skills/<name>/SKILL.md for higher-level recipes.

// Version comes from this package's own package.json (dist/index.js → ../package.json)
// so the CLI never drifts from the published version.
const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')
) as { version: string }

const program = new Command()
program
  .name('slates')
  .description('Slates CLI — drive AI Video Creation Studio from your terminal.')
  .version(pkg.version)
  .enablePositionalOptions()

program
  .command('login')
  .description('Authorize this CLI to use your Slates account (magic link).')
  .option('--email <email>', 'Slates account email (otherwise prompted)')
  .option('--client-name <name>', 'Label this connection (shows in Slates Settings)', 'Slates CLI')
  .option('--token <token>', 'Skip the magic-link flow and paste a slates_sk_ token directly.')
  .action((opts) => runLogin(opts))

program
  .command('logout')
  .description('Clear the stored Slates cloud token.')
  .action(() => runLogout())

program
  .command('status')
  .description('Show the current Slates connection status.')
  .action(() => runStatus())

program
  .command('setup')
  .description('One-command onboarding: write the MCP config into every detected client, install the skills, and point you at the account-connect step.')
  .option('--global', 'Install skills into ~/.claude/skills instead of the current project', false)
  .option('--skip-skills', 'Only write MCP configs; do not install skills', false)
  .action((opts) => runSetup(opts))

program
  .command('mcp')
  .description('Detect installed MCP clients and print (or write) the Slates MCP config for each.')
  .option('--write', 'Merge the "slates" entry into detected Claude Desktop / Cursor config files (backs up to .bak first)', false)
  .action((opts) => runMcp(opts))

program
  .command('install-skills')
  .description('Install the bundled skills into .claude/skills/<name>/SKILL.md (Claude Code layout).')
  .option('--global', 'Install into ~/.claude/skills instead of the current project', false)
  .action((opts) => runInstallSkills(opts))

program
  .command('run')
  .description('Invoke a Slates operation by id (use `slates run --list` to see them).')
  .option('--list', 'List all available operations', false)
  .option('--json', 'Emit structured JSON ({text, data, images: [{mimeType, bytes}]}). Image binary is omitted — use the MCP server for inline image payloads.', false)
  .allowUnknownOption()
  .passThroughOptions()
  .argument('[opId]', 'Operation id, e.g. slates_create_project')
  .argument('[args...]', '--key value pairs for the operation input')
  .action(async (opId: string | undefined, args: string[], options) => {
    // With passThroughOptions enabled, --json/--list AFTER the opId end
    // up in `args` instead of `options`. Detect both positions.
    const jsonFlag = !!options.json || args.some((a) => a === '--json' || a.startsWith('--json='))
    const listFlag = !!options.list || args.some((a) => a === '--list')
    if (listFlag || !opId) {
      const ops = ALL_OPERATIONS as readonly Operation<unknown>[]
      for (const op of ops) {
        console.log(`${op.id}\n  ${op.description}\n`)
      }
      return
    }
    await runOp({ opId, rawArgs: args, json: jsonFlag })
  })

// Hidden helper for skills that just need the cloud token.
program
  .command('print-cloud-token', { hidden: true })
  .action(() => {
    const c = readConnection()
    if (!c.cloud.token) {
      console.error('No cloud token. Run `slates login`.')
      process.exit(1)
    }
    process.stdout.write(c.cloud.token)
  })

// Hidden helper for tests / scripting.
program
  .command('set-cloud-token <token>', { hidden: true })
  .action((token: string) => {
    setCloudToken(token)
    console.log('Cloud token written.')
  })

program
  .command('clear-cloud-token', { hidden: true })
  .action(() => {
    clearCloudToken()
    console.log('Cloud token cleared.')
  })

// Bare `slates` with no args: print help and exit 0 (commander's default
// help-on-missing-command exits 1, which reads as an error to scripts).
if (process.argv.length <= 2) {
  program.outputHelp()
  process.exit(0)
}

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
