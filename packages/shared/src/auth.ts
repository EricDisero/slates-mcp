import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
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
}

const EMPTY: AgentConnectionFile = {
  cloud: { token: null },
  desktop: { enabled: false, port: null, token: null },
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
    }
  } catch {
    return { ...EMPTY, cloud: { ...EMPTY.cloud }, desktop: { ...EMPTY.desktop } }
  }
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

export function deleteConnection(): void {
  if (existsSync(CONNECTION_FILE)) unlinkSync(CONNECTION_FILE)
}

export class MissingCloudTokenError extends Error {
  code = 'CLOUD_TOKEN_MISSING'
  constructor() {
    super(
      'No Slates cloud token found. Run `slates login` to authorize, or open Slates → Settings → Agent Control → Connect Claude Code.'
    )
  }
}

export class MissingDesktopServerError extends Error {
  code = 'DESKTOP_SERVER_MISSING'
  constructor() {
    super(
      'Slates desktop is not running with Agent Control enabled. Open Slates → Settings → Agent Control → toggle on.'
    )
  }
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
