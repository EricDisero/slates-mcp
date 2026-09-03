import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  readConnection,
  CONNECTION_FILE,
  SlatesCloudClient,
  SlatesDesktopClient,
  SKILLS,
  type SlatesUserInfo,
  type DesktopHealth,
} from '@slatesvideo/shared'
import { EXIT } from '../exit-codes.js'

// `slates doctor` — every setup precondition, in one command, each failure
// printing its own fix.
//
// The five things that can be wrong were checked in FOUR different places
// (`status`, `setup`, the MCP client detector, and the op layer's own errors),
// so "why isn't this working" meant running three commands and reading a stack
// trace. One command, five checks, and the fix beside each one.

interface Check {
  name: string
  ok: boolean
  detail: string
  fix?: string
}

function frontmatterName(markdown: string, fallback: string): string {
  if (!markdown.startsWith('---')) return fallback
  const end = markdown.indexOf('\n---', 3)
  if (end === -1) return fallback
  const m = markdown.slice(3, end).match(/^name:\s*(.+?)\s*$/m)
  return m ? m[1].trim() : fallback
}

/** Every op that needs a desktop capability, and the capability it needs. Kept
 *  in step with `requireCapability` call sites in the ops registry. */
const REQUIRED_CAPABILITIES: Array<[string, string]> = [
  ['shots', 'Shots — the whole shot-list surface'],
  ['background-generation', 'background: true on any generate op'],
  ['image-references', 'reference images on image generation'],
  ['image-models-v2', 'gpt-image-2 / nano-banana-pro / nano-banana-2-lite'],
]

export async function runDoctor(): Promise<void> {
  const checks: Check[] = []
  const conn = readConnection()

  // 1. The connection file.
  checks.push({
    name: 'Connection file',
    ok: existsSync(CONNECTION_FILE),
    detail: existsSync(CONNECTION_FILE) ? CONNECTION_FILE : `not found at ${CONNECTION_FILE}`,
    fix: 'Run `slates login`, or open Slates → Settings → Agent Control → Send link.',
  })

  // 2. The cloud token, verified against the API rather than merely present.
  if (!conn.cloud.token) {
    checks.push({
      name: 'Cloud account',
      ok: false,
      detail: 'no token',
      fix: 'Run `slates login` (or connect from Slates → Settings → Agent Control).',
    })
  } else {
    try {
      const me = await new SlatesCloudClient().get<SlatesUserInfo>('/api/agent/me')
      const balance = me.user.credit_balance ?? me.user.credit_balance_cents ?? 0
      checks.push({
        name: 'Cloud account',
        ok: true,
        detail: `${me.user.email} · ${me.user.tier} · ${balance.toLocaleString('en-US')} credits`,
      })
    } catch (err) {
      checks.push({
        name: 'Cloud account',
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
        fix: 'The token is expired or was revoked — run `slates login` again.',
      })
    }
  }

  // 3. The desktop server: enabled, on a port, and actually answering.
  let health: DesktopHealth | null = null
  if (!conn.desktop.enabled || !conn.desktop.port || !conn.desktop.token) {
    checks.push({
      name: 'Desktop server',
      ok: false,
      detail: 'not enabled in the connection file',
      fix: 'Open Slates → Settings → Agent Control → toggle on. Every workspace op needs this.',
    })
  } else {
    try {
      health = await new SlatesDesktopClient().healthz()
      checks.push({
        name: 'Desktop server',
        ok: true,
        detail: `127.0.0.1:${conn.desktop.port} · v${health.version ?? '?'} · agent API v${health.agentApiVersion ?? 1}`,
      })
    } catch (err) {
      checks.push({
        name: 'Desktop server',
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
        fix: 'Open the Slates app. If it IS open, the stored port is stale — toggle Agent Control off and on.',
      })
    }
  }

  // 4. Desktop capabilities vs the ops that need them.
  if (health) {
    const have = new Set(health.capabilities ?? [])
    const missing = REQUIRED_CAPABILITIES.filter(([cap]) => !have.has(cap))
    checks.push({
      name: 'Desktop capabilities',
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? `${have.size} capabilities, all the ops need present`
          : `missing: ${missing.map(([cap, what]) => `${cap} (${what})`).join(', ')}`,
      fix: 'Update Slates (Settings → Check for Updates). The ops that need these will refuse until you do.',
    })
  }

  // 5. Installed skills vs what this CLI ships.
  const bundled = new Set(Object.entries(SKILLS).map(([k, v]) => frontmatterName(v, k)))
  const roots = [join(process.cwd(), '.claude', 'skills'), join(homedir(), '.claude', 'skills')]
  const installedRoot = roots.find((r) => existsSync(r))
  if (!installedRoot) {
    checks.push({
      name: 'Agent skills',
      ok: false,
      detail: 'none installed',
      fix: 'Run `slates install-skills` (add --global for ~/.claude/skills), then restart Claude Code.',
    })
  } else {
    const installed = new Set(
      readdirSync(installedRoot).filter((d) => existsSync(join(installedRoot, d, 'SKILL.md')))
    )
    const missing = [...bundled].filter((s) => !installed.has(s))
    checks.push({
      name: 'Agent skills',
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? `${bundled.size} of ${bundled.size} installed in ${installedRoot}`
          : `${bundled.size - missing.length} of ${bundled.size} installed — missing ${missing.length}`,
      fix: 'Run `slates install-skills` to bring them up to this CLI version, then restart Claude Code.',
    })
  }

  // 6. MCP client configs — present is enough; `slates mcp` owns the detail.
  const mcpConfigs = [
    join(homedir(), '.claude.json'),
    join(homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
    join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    join(homedir(), '.cursor', 'mcp.json'),
  ].filter((p) => existsSync(p))
  const wired = mcpConfigs.filter((p) => {
    try {
      return readFileSync(p, 'utf8').includes('slates')
    } catch {
      return false
    }
  })
  checks.push({
    name: 'MCP client config',
    ok: wired.length > 0,
    detail:
      wired.length > 0
        ? `slates entry found in ${wired.length} of ${mcpConfigs.length} detected config(s)`
        : `${mcpConfigs.length} client config(s) detected, none mentions slates`,
    fix: 'Run `slates mcp --write` (or `slates setup`), then restart the client.',
  })

  // ── Report ──
  const version = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'), 'utf8')
  ) as { version: string }
  console.log(`slates doctor — CLI v${version.version}\n`)
  for (const c of checks) {
    console.log(`${c.ok ? '  ok  ' : '  ✗   '}${c.name}: ${c.detail}`)
    if (!c.ok && c.fix) console.log(`        → ${c.fix}`)
  }
  const failed = checks.filter((c) => !c.ok)
  console.log(
    failed.length === 0
      ? `\nAll ${checks.length} checks passed.`
      : `\n${failed.length} of ${checks.length} checks failed. Fix them top-down — a later one often depends on an earlier one.`
  )
  if (failed.length > 0) process.exit(EXIT.ERROR)
}
