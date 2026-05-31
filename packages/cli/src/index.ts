#!/usr/bin/env node
import { Command } from 'commander'
import { readConnection, setCloudToken, clearCloudToken } from '@slatesvideo/shared'
import { runLogin } from './commands/login.js'
import { runLogout } from './commands/logout.js'
import { runStatus } from './commands/status.js'
import { runOp } from './commands/op.js'
import { runInstallSkills } from './commands/install-skills.js'
import { ALL_OPERATIONS, type Operation } from '@slatesvideo/shared'

// Slates CLI. The CLI mirrors the MCP tool surface as commands so Claude
// Code can shell out to them and skip the cost of loading 20+ tool
// schemas into its context window. Skills (in packages/skills) tell the
// agent how to compose them.
//
// First-time use:
//   1. Open Slates desktop → Settings → Agent Control → toggle on.
//   2. Run `slates login` — sends a magic link to your account email.
//   3. Click the link in your email.
//   4. The CLI auto-detects the connection and writes the cloud token
//      into ~/.slates/agent-connection.json. The desktop app's local
//      port + token are already there from step 1.
//
// Inside Claude Code:
//   `/slates run slates_create_project --name "neon samurai"`
//   `/slates run slates_generate_image --prompt "..." --resolution 2k`
//
// Or import @slatesvideo/skills/*.md into .claude/skills/ for higher-
// level recipes.

const program = new Command()
program
  .name('slates')
  .description('Slates CLI — drive AI Video Creation Studio from your terminal.')
  .version('0.2.0')
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
  .command('install-skills')
  .description('Copy the bundled skills into your local .claude/skills directory.')
  .option('--force', 'Overwrite existing skill files', false)
  .action((opts) => runInstallSkills(opts))

const runCmd = program
  .command('run')
  .description('Invoke a Slates operation by id (use `slates run --list` to see them).')
  .option('--list', 'List all available operations', false)
  .option('--json', 'Emit raw JSON response instead of formatted text', false)
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

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
