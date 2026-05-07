import { requireDesktop } from '../auth.js'

// Thin client for the local Slates desktop HTTP server (127.0.0.1:PORT).
// All workflow/state ops (projects, characters, storyboards, frames,
// asset slot binding) go here. Generation routes through cloud, but the
// generated assets are saved into desktop projects via this client.

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

  async healthz(): Promise<{ ok: true; service: string }> {
    const res = await fetch(`${this.baseUrl}/agent/healthz`)
    if (!res.ok) {
      throw new Error(`Desktop healthz failed (${res.status})`)
    }
    return res.json() as Promise<{ ok: true; service: string }>
  }

  async get<T>(path: string, params?: Record<string, string | number | boolean | null | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v == null) continue
        url.searchParams.set(k, String(v))
      }
    }
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.token}` },
    })
    return this.handle<T>(path, res)
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    })
    return this.handle<T>(path, res)
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
