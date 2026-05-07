import { requireCloudToken } from '../auth.js'

export const DEFAULT_CLOUD_BASE_URL =
  process.env.SLATES_CLOUD_BASE_URL ?? 'https://slates-api.fly.dev'

// Thin client for slates-api. Used for credit-aware ops that route through
// the user's account (generation proxy, credits balance, model registry,
// license checks). The desktop client below is the local equivalent.

export class SlatesCloudClient {
  constructor(
    private readonly token: string = requireCloudToken(),
    private readonly baseUrl: string = DEFAULT_CLOUD_BASE_URL
  ) {}

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
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
      throw new Error(`slates-api ${path} failed (${res.status}): ${detail}`)
    }
    return parsed as T
  }
}

export interface SlatesUserInfo {
  success: boolean
  user: {
    id: string
    email: string
    name: string
    license_status: string
    tier: string
    credit_balance_cents: number
    credit_balance_dollars: string
  }
  scopes: string[]
}

export interface CreditsBalance {
  success: boolean
  credit_balance_cents: number
  credit_balance_dollars: string
}

export interface ModelRegistryResponse {
  success: boolean
  credit_markup: number
  models: Array<{
    model: string
    cost_cents: number
    cost_dollars: string
  }>
}
