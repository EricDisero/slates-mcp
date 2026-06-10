import { requireDesktop } from '../auth.js'

// Thin client for the local Slates desktop HTTP server (127.0.0.1:PORT).
// All workflow/state ops (projects, characters, storyboards, frames,
// asset slot binding) go here. Generation routes through cloud, but the
// generated assets are saved into desktop projects via this client.

// Health payload from GET /agent/healthz. Older desktop builds return only
// { ok, service } — version / agentApiVersion / capabilities arrived with
// agent API v2, so every newer field is optional (supertype, non-breaking).
export interface DesktopHealth {
  ok: true
  service: string
  version?: string
  agentApiVersion?: number
  capabilities?: string[]
}

// Friendly message for the by-far-most-common failure: the desktop app
// isn't running (or the connection file holds a stale port). A raw
// "fetch failed" tells the agent nothing actionable.
const DESKTOP_UNREACHABLE_MESSAGE =
  'Slates desktop app is not reachable — open the Slates app and retry. ' +
  'Not installed? https://slates.video/download'

// Timeout-class failures are NOT "app not running": undici's default 300s
// headers timeout fires on long blocking calls (export_video encoding can
// exceed 5 min) while the desktop is still mid-work. Mislabeling that as
// unreachable invites a retry that double-spends.
const DESKTOP_TIMEOUT_MESSAGE =
  'The Slates desktop app did not respond in time but may still be working ' +
  '(long renders and video generations can exceed the HTTP timeout). ' +
  'For video generation use background: true and poll with slates_get_generation_status. ' +
  'For exports, check whether the output file landed on disk before retrying.'

const CONNECTION_ERROR_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EHOSTUNREACH'])
const TIMEOUT_ERROR_CODES = new Set(['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'ETIMEDOUT'])

// fetch wraps the real failure in TypeError('fetch failed', { cause }).
// The cause carries the code — sometimes directly, sometimes (connect
// failures) as an AggregateError whose sub-errors carry it. Collect all.
function fetchErrorCodes(err: unknown): string[] {
  const codes: string[] = []
  const cause = (err as { cause?: unknown })?.cause
  const code = (cause as { code?: unknown })?.code
  if (typeof code === 'string') codes.push(code)
  const subErrors = (cause as { errors?: unknown })?.errors
  if (Array.isArray(subErrors)) {
    for (const sub of subErrors) {
      const c = (sub as { code?: unknown })?.code
      if (typeof c === 'string') codes.push(c)
    }
  }
  return codes
}

// Module-level health cache so capability checks don't re-hit /agent/healthz
// on every op call. 60s TTL — long enough to amortize a multi-op workflow,
// short enough that an app update mid-session is picked up. Keyed by port
// (each desktop instance = one port).
const HEALTH_CACHE_TTL_MS = 60_000
const healthCache = new Map<number, { health: DesktopHealth; fetchedAt: number }>()

export class SlatesDesktopClient {
  private readonly token: string
  private readonly port: number

  constructor(opts?: { token?: string; port?: number }) {
    if (opts?.token && opts.port) {
      this.token = opts.token
      this.port = opts.port
    } else {
      const d = requireDesktop()
      this.token = d.token
      this.port = d.port
    }
  }

  private get baseUrl(): string {
    return `http://127.0.0.1:${this.port}`
  }

  async healthz(): Promise<DesktopHealth> {
    const res = await this.fetchOrFriendly(`${this.baseUrl}/agent/healthz`)
    if (!res.ok) {
      throw new Error(`Desktop healthz failed (${res.status})`)
    }
    return res.json() as Promise<DesktopHealth>
  }

  // Version handshake. New ops (timeline, export, background generation,
  // edit-image, image references) exist only on agent API v2 desktops.
  // Calling a missing route on an old desktop would 404 with an opaque
  // error — this check turns that into an actionable "update Slates"
  // message BEFORE the op's first real request.
  async requireCapability(cap: string, friendlyFeature: string): Promise<void> {
    const cached = healthCache.get(this.port)
    let health: DesktopHealth
    if (cached && Date.now() - cached.fetchedAt < HEALTH_CACHE_TTL_MS) {
      health = cached.health
    } else {
      health = await this.healthz()
      healthCache.set(this.port, { health, fetchedAt: Date.now() })
    }
    if (health.agentApiVersion === undefined || !health.capabilities?.includes(cap)) {
      throw new Error(
        `Your Slates desktop app doesn't support ${friendlyFeature} yet ` +
          `(agent API v${health.agentApiVersion ?? 1}, need v2 with '${cap}'). ` +
          `Update Slates (Settings → Check for Updates) and retry.`
      )
    }
  }

  async get<T>(path: string, params?: Record<string, string | number | boolean | null | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v == null) continue
        url.searchParams.set(k, String(v))
      }
    }
    const res = await this.fetchOrFriendly(url.toString(), {
      headers: { Authorization: `Bearer ${this.token}` },
    })
    return this.handle<T>(path, res)
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchOrFriendly(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    })
    return this.handle<T>(path, res)
  }

  // Network-level failures surface as a generic TypeError from fetch.
  // Classify by the underlying error code: connection-class (ECONNREFUSED
  // on a closed app, stale port after an app restart) → "open the app";
  // timeout-class (undici headers/body timeout on a long blocking render,
  // caller abort) → "may still be working — don't blind-retry"; anything
  // else → rethrow with context, NOT a misleading unreachable message.
  // HTTP-level errors still flow to handle().
  private async fetchOrFriendly(url: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init)
    } catch (err) {
      const codes = fetchErrorCodes(err)
      if (codes.some((c) => CONNECTION_ERROR_CODES.has(c))) {
        throw new Error(DESKTOP_UNREACHABLE_MESSAGE)
      }
      const name = (err as { name?: unknown })?.name
      if (name === 'AbortError' || codes.some((c) => TIMEOUT_ERROR_CODES.has(c))) {
        throw new Error(DESKTOP_TIMEOUT_MESSAGE)
      }
      let path = url
      try {
        path = new URL(url).pathname
      } catch {
        // keep the full url
      }
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`slates-desktop request to ${path} failed: ${message}`, { cause: err })
    }
  }

  private async handle<T>(path: string, res: Response): Promise<T> {
    const text = await res.text()
    let parsed: unknown = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      // fall through
    }
    if (!res.ok) {
      const detail =
        parsed && typeof parsed === 'object' && 'error' in parsed
          ? (parsed as { error: string }).error
          : text || res.statusText
      throw new Error(`slates-desktop ${path} failed (${res.status}): ${detail}`)
    }
    return parsed as T
  }
}
