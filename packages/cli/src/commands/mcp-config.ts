import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import TOML from '@iarna/toml'

export const CODEX_MCP_SETUP = 'codex mcp add slates -- npx -y @slatesvideo/mcp-server'

/** Read configuration only. A detected entry does not prove authentication or connectivity. */
export function inspectCodexMcpConfig(environment = { cwd: process.cwd(), home: homedir(), codexHome: process.env.CODEX_HOME }) {
  const files = [...new Set([join(environment.codexHome || join(environment.home, '.codex'), 'config.toml'), join(environment.cwd, '.codex', 'config.toml')])].filter(file => existsSync(file))
  const invalid: string[] = []
  const servers: Record<string, Record<string, unknown>> = {}
  for (const file of files) {
    try {
      const config = TOML.parse(readFileSync(file, 'utf8'))
      const entries = config.mcp_servers
      if (entries && typeof entries === 'object' && !Array.isArray(entries)) {
        for (const [name, entry] of Object.entries(entries)) {
          if (entry && typeof entry === 'object' && !Array.isArray(entry)) servers[name] = { ...servers[name], ...entry }
        }
      }
    } catch {
      // Parser excerpts can include credentials; report the path without quoting config contents.
      invalid.push(file)
    }
  }
  const slates = Object.entries(servers).filter(([name, server]) => name === 'slates' || (Array.isArray(server.args) && server.args.includes('@slatesvideo/mcp-server')))
  const configured = slates.some(([, server]) => server.enabled !== false && (typeof server.command === 'string' || typeof server.url === 'string'))
  return { files, configured: configured && invalid.length === 0, disabled: slates.length > 0 && !configured, invalid }
}
