import { readConnection } from '@slatesvideo/shared'
import { runMcp } from './mcp.js'
import { runInstallSkills } from './install-skills.js'

interface SetupOptions {
  global?: boolean
  skipSkills?: boolean
}

// `slates setup` — the one-command onboarding. Does the three setup steps in
// order so a user (or an agent following a single instruction) can go from
// "nothing" to "connected":
//   1. Write the Slates MCP config into every detected client (Claude Desktop,
//      Claude Code, Cursor) — no manual JSON editing.
//   2. Install the bundled agent skills into the current project.
//   3. Point at the account-connect step (magic link — interactive, so it
//      happens in the Slates desktop app or via `slates login`, not here).
//
// Steps 1-2 are mechanical and run automatically; step 3 is auth and only ever
// guided, never silently performed.
export function runSetup(opts: SetupOptions): void {
  console.log('Slates setup — getting you connected.')

  // 1. MCP client config — always write in the one-command flow (that's the point).
  console.log('\n① Configuring MCP clients')
  runMcp({ write: true })

  // 2. Agent skills.
  if (opts.skipSkills) {
    console.log('\n② Skills — skipped (--skip-skills). Run `slates install-skills` when ready.')
  } else {
    console.log('\n② Installing agent skills')
    runInstallSkills({ global: !!opts.global })
  }

  // 3. Account connection — interactive (magic link), so guide rather than block.
  console.log('\n③ Connect your Slates account')
  const conn = readConnection()
  const hasCloud = !!conn.cloud?.token
  const hasDesktop = !!conn.desktop?.token
  if (hasCloud && hasDesktop) {
    console.log('  ✓ Already connected (cloud + desktop tokens present).')
  } else {
    if (hasCloud || hasDesktop) {
      console.log(`  Partially connected (${hasCloud ? 'cloud' : 'desktop'} only) — finish the link below.`)
    }
    console.log('  Open Slates desktop → Settings → Agent Control → enter your email → Send link,')
    console.log('  then click the link in your email. (Or run `slates login`.)')
    console.log('  That one step authorizes the agent AND starts the local server the tools talk to.')
  }

  console.log('\nDone. Restart your AI tool to load Slates, then verify with: slates status')
}
