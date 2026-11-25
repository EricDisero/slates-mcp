import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir, platform } from 'node:os'
import TOML from '@iarna/toml'

export const CODEX_MCP_SETUP = 'codex mcp add slates -- npx -y @slatesvideo/mcp-server'

const SERVER_PACKAGE = '@slatesvideo/mcp-server'

/** A server entry is ours by its name or by the package it launches, whatever the config format. */
function isSlatesServer(name: string, server: Record<string, unknown>): boolean {
  return name === 'slates' || (Array.isArray(server.args) && server.args.includes(SERVER_PACKAGE))
}

export function claudeDesktopConfigPath(): string {
  const os = platform()
  if (os === 'win32') {
    const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming')
    return join(appData, 'Claude', 'claude_desktop_config.json')
  }
  if (os === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
  }
  return join(homedir(), '.config', 'Claude', 'claude_desktop_config.json')
}

export function cursorConfigPath(): string {
  return join(homedir(), '.cursor', 'mcp.json')
}

/** Claude Code's file: user-scope servers at the top, local-scope ones under each project. */
export function claudeCodeConfigPath(): string {
  return join(homedir(), '.claude.json')
}

/**
 * The JSON client configs that exist, and the ones with a Slates server entry: `mcpServers` at the
 * top level or under one of Claude Code's `projects`. The file is parsed, because `.claude.json`
 * lists every folder the user has opened and a folder named "slates" is not a server.
 */
export function inspectJsonMcpConfigs(candidates = [claudeCodeConfigPath(), claudeDesktopConfigPath(), cursorConfigPath()]) {
  const files = candidates.filter(file => existsSync(file))
  const hasSlates = (servers: unknown): boolean =>
    !!servers && typeof servers === 'object' && !Array.isArray(servers) &&
    Object.entries(servers).some(([name, server]) => !!server && typeof server === 'object' && isSlatesServer(name, server as Record<string, unknown>))
  const configured = files.filter(file => {
    try {
      const config = JSON.parse(readFileSync(file, 'utf8')) as { mcpServers?: unknown; projects?: Record<string, { mcpServers?: unknown } | null> }
      return hasSlates(config.mcpServers) || Object.values(config.projects ?? {}).some(project => hasSlates(project?.mcpServers))
    } catch {
      return false
    }
  })
  return { files, configured }
}

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
  const slates = Object.entries(servers).filter(([name, server]) => isSlatesServer(name, server))
  const configured = slates.some(([, server]) => server.enabled !== false && (typeof server.command === 'string' || typeof server.url === 'string'))
  return { files, configured: configured && invalid.length === 0, disabled: slates.length > 0 && !configured, invalid }
}
