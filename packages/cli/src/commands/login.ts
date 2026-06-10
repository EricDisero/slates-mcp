import { setCloudToken } from '@slatesvideo/shared'
import { promptInput } from '../util/prompt.js'

const CLOUD_BASE_URL = process.env.SLATES_CLOUD_BASE_URL ?? 'https://slates-api.fly.dev'

export interface LoginOptions {
  email?: string
  clientName?: string
  token?: string
}

export async function runLogin(opts: LoginOptions): Promise<void> {
  // Manual paste path — power users who minted a key on the web UI
  // (or want to bypass email entirely for CI).
  if (opts.token) {
    if (!opts.token.startsWith('slates_sk_')) {
      console.error('Token must start with slates_sk_. Aborting.')
      process.exit(1)
    }
    setCloudToken(opts.token)
    console.log('Cloud token saved. You\'re logged in.')
    return
  }

  const email = opts.email ?? (await promptInput('Slates account email: '))
  const trimmed = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    console.error('Not a valid email address. Aborting.')
    process.exit(1)
  }

  const clientName = (opts.clientName ?? 'Slates CLI').slice(0, 80)

  const reqRes = await fetch(`${CLOUD_BASE_URL}/auth/agent/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: trimmed, client_name: clientName }),
  })
  const reqBody = (await reqRes.json()) as {
    success: boolean
    challengeId?: string
    userCode?: string
    error?: string
  }
  if (!reqBody.success || !reqBody.challengeId) {
    console.error(`Failed to request sign-in: ${reqBody.error ?? 'unknown error'}`)
    process.exit(1)
  }

  console.log(`\nA sign-in link is on its way to ${trimmed}.`)
  // Newer slates-api versions return a short user code (e.g. XK4-P2N) that
  // the authorization page asks the user to verify — anti-phishing pairing.
  // Older servers omit the field; show nothing in that case.
  if (reqBody.userCode) {
    console.log(`Confirm this code on the authorization page: ${reqBody.userCode}`)
  }
  console.log('Click the link, then return here. Waiting (10 min max)...\n')

  const start = Date.now()
  const timeoutMs = 10 * 60 * 1000
  while (Date.now() - start < timeoutMs) {
    await sleep(1500)
    try {
      const pollRes = await fetch(
        `${CLOUD_BASE_URL}/auth/agent/poll?challengeId=${encodeURIComponent(reqBody.challengeId)}`
      )
      const pollBody = (await pollRes.json()) as {
        status: 'pending' | 'completed' | 'expired'
        token?: string
      }
      if (pollBody.status === 'expired') {
        console.error('Sign-in link expired. Run `slates login` again.')
        process.exit(1)
      }
      if (pollBody.status === 'completed' && pollBody.token) {
        setCloudToken(pollBody.token)
        console.log('Connected to Slates. Token saved to ~/.slates/agent-connection.json')
        return
      }
      process.stdout.write('.')
    } catch {
      // Network blip — keep polling.
    }
  }

  console.error('\nTimed out waiting for sign-in. Run `slates login` again.')
  process.exit(1)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
