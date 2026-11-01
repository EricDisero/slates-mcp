import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs'

// Reads/writes ~/.slates/agent-connection.json — the single file the
// Slates desktop app produces and the MCP/CLI consume.
//
// The desktop app owns the desktop side (port + token) of this file. The
// CLI owns the cloud side (slates_sk_ token). Both can be present, both
// can be missing. We never assume one implies the other; tools that
// require the desktop server fail-fast with a clear message when only
// the cloud token is present, and vice versa.

export const AGENT_DIR = join(homedir(), '.slates')
export const CONNECTION_FILE = join(AGENT_DIR, 'agent-connection.json')

export interface AgentConnectionFile {
  cloud: { token: string | null }
  desktop: {
    enabled: boolean
    port: number | null
    token: string | null
  }
  /**
   * The project `slates use` selected, filled into any op that takes
   * `projectId` and was called without one.
   *
   * 🚨 CLI-OWNED, AND ONLY A DEFAULT. The desktop app owns the `desktop` half
   * of this file and must never write here; an explicit `--projectId` always
   * wins. It exists because every workspace op takes a UUID and an agent had to
   * carry that UUID through the whole session by hand — which is exactly the
   * kind of state a shell session is bad at holding.
   */
  defaultProjectId?: string | null
}

const EMPTY: AgentConnectionFile = {
  cloud: { token: null },
  desktop: { enabled: false, port: null, token: null },
  defaultProjectId: null,
}

export function readConnection(): AgentConnectionFile {
  if (!existsSync(CONNECTION_FILE)) return { ...EMPTY, cloud: { ...EMPTY.cloud }, desktop: { ...EMPTY.desktop } }
  try {
    const parsed = JSON.parse(readFileSync(CONNECTION_FILE, 'utf-8')) as Partial<AgentConnectionFile>
    return {
      cloud: { token: parsed.cloud?.token ?? null },
      desktop: {
        enabled: !!parsed.desktop?.enabled,
        port: parsed.desktop?.port ?? null,
        token: parsed.desktop?.token ?? null,
      },
      defaultProjectId: parsed.defaultProjectId ?? null,
    }
  } catch {
    return { ...EMPTY, cloud: { ...EMPTY.cloud }, desktop: { ...EMPTY.desktop } }
  }
}

export function setDefaultProjectId(projectId: string | null): void {
  writeConnection({ ...readConnection(), defaultProjectId: projectId })
}

export function readDefaultProjectId(): string | null {
  return readConnection().defaultProjectId ?? null
}

export function writeConnection(data: AgentConnectionFile): void {
  if (!existsSync(AGENT_DIR)) mkdirSync(AGENT_DIR, { recursive: true })
  writeFileSync(CONNECTION_FILE, JSON.stringify(data, null, 2), { mode: 0o600 })
}

export function setCloudToken(token: string | null): void {
  const cur = readConnection()
  writeConnection({
    ...cur,
    cloud: { token },
  })
}

export function clearCloudToken(): void {
  setCloudToken(null)
}

export class MissingCloudTokenError extends Error {
  code = 'CLOUD_TOKEN_MISSING'
  constructor() {
    super(
      'No Slates cloud token found. Run `slates login` to authorize, or open Slates → Settings → AI tools → Send link.'
    )
  }
}

export class MissingDesktopServerError extends Error {
  code = 'DESKTOP_SERVER_MISSING'
  constructor() {
    super(
      'Slates desktop is not running with its local server on. Open Slates → Settings → AI tools and connect (Send link, or Connect without the email link).'
    )
  }
}

/** A short hash of a bearer token, so a file can name which login wrote it without holding the token. */
export function tokenHash(token: string | null | undefined): string | null {
  return token ? createHash('sha256').update(token).digest('hex').slice(0, 16) : null
}

export function requireCloudToken(): string {
  const c = readConnection()
  if (!c.cloud.token) throw new MissingCloudTokenError()
  return c.cloud.token
}

export function requireDesktop(): { port: number; token: string } {
  const c = readConnection()
  if (!c.desktop.enabled || !c.desktop.port || !c.desktop.token) {
    throw new MissingDesktopServerError()
  }
  return { port: c.desktop.port, token: c.desktop.token }
}

// ~/.slates/mcp-server.json — how to start the Slates server the desktop app carries inside itself
// (`slate/src/main/agent/mcpLauncher.ts` writes it on every start of a packaged app; nothing here
// writes it). Its own file, not a field of the connection file, because a CLI older than this one
// rewrites the connection file with only the fields it knows and would drop it.
//
// Why it exists (2026-10-31): a customer's Claude Code ran an old copy of this package that lacked
// the transition tools while his app had them. A server started from this file is the app's own
// copy, so it is always the version that matches the app, and updates when the app does.
export const MCP_LAUNCHER_FILE = join(AGENT_DIR, 'mcp-server.json')

export interface McpLauncher {
  /** The bundled server's package version. */
  version: string
  command: string
  args: string[]
  env: Record<string, string>
}

/** The desktop's bundled server, or null when there is none on this computer (no app, an old app,
 *  an uninstalled one whose file was left behind, or a file this version cannot read). */
export function readMcpLauncher(file = MCP_LAUNCHER_FILE): McpLauncher | null {
  try {
    const raw = JSON.parse(readFileSync(file, 'utf-8')) as Partial<McpLauncher>
    const env = raw.env ?? {}
    if (
      typeof raw.version !== 'string' ||
      typeof raw.command !== 'string' ||
      !Array.isArray(raw.args) ||
      !raw.args.every((a) => typeof a === 'string') ||
      typeof env !== 'object' ||
      !Object.values(env).every((v) => typeof v === 'string')
    ) return null
    // The app was moved or uninstalled since it wrote the file: nothing to start.
    if (!existsSync(raw.command) || (raw.args[0] && !existsSync(raw.args[0]))) return null
    return { version: raw.version, command: raw.command, args: raw.args, env }
  } catch {
    return null
  }
}
