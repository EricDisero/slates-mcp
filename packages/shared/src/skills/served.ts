// The Slates brain's deep layers, served by slates-api by the account's tier (second-brain
// plans/2026-10-25-slates-brain.md step 4). This public package carries only the Director card and the router
// (`slates-start-here`, SKILLS); every playbook, rule and model guide lives in the private slates-api `brain/` and
// reaches an agent from the account it is connected with (slates-api src/lib/brain.ts says who reads which).
//
// Where this process gets them:
//   SLATES_BRAIN_DIR  a folder of brain files with every tier open: builds, evals and checks. Never set on a
//                     user's machine. When set it is the only source; nothing refreshes it.
//   BRAIN_CACHE       otherwise, the last bundle this machine received (by this login, or by the desktop app when
//                     there is no login here), read at load so a cold or offline start has the brain.
//   the server        GET /brain (version, tiers, account), then /brain/bundle when any changed, through the
//                     connected account; it replaces what the cache gave and is written back to BRAIN_CACHE.
//                     refreshServedBrain runs it at server start and before a guide answer, at most every
//                     REFRESH_EVERY_MS. A 401 or 403 clears the brain and the cache, as `slates logout` does.
// With none of them, only the card and the router are here, and the guide op says why.

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_DIR, readConnection } from '../auth.js'
import { SKILLS } from './content.js'

export interface LockedGuide {
  name: string
  /** The tier that opens it: `license` or `bump`. */
  tier: string
  description: string
  /** What the agent tells the user about it, in the server's words (slates-api lib/brain.ts lockedNotice). */
  notice?: string
}

export interface ServedBrain {
  /** slates-api's approved version (`<commit>.<hash>`); null from a folder or with nothing. */
  version: string | null
  /** The tiers the account opens. */
  tiers: readonly string[]
  /** Name → markdown, every file the tiers open. */
  files: Readonly<Record<string, string>>
  /** Files past the account's tiers, by name and description only. */
  locked: readonly LockedGuide[]
  source: 'dir' | 'server' | 'cache' | 'none'
  /** The account it was served to (slates-api user id); null from a folder or with nothing. */
  account?: string | null
  /** Why the last refresh did not reach the server, for the guide op to say. */
  problem?: string
}

/** What BRAIN_CACHE holds: the brain, and which cloud token received it (a hash, never the token). */
interface CachedBrain extends ServedBrain {
  token?: string | null
  fetchedAt?: string
}

export const BRAIN_CACHE = join(AGENT_DIR, 'brain-cache.json')
const REFRESH_TIMEOUT_MS = 5_000
const REFRESH_EVERY_MS = 10 * 60_000
const EMPTY: ServedBrain = { version: null, tiers: [], files: {}, locked: [], source: 'none' }

function fromDir(dir: string): ServedBrain {
  const files: Record<string, string> = {}
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) files[f.slice(0, -3)] = readFileSync(join(dir, f), 'utf8')
  return { version: null, tiers: ['license', 'bump'], files, locked: [], source: 'dir' }
}

/** A short hash of this machine's cloud token (`slates login`), so a cache names which login received it. */
function tokenKey(): string | null {
  const token = readConnection().cloud.token
  return token ? createHash('sha256').update(token).digest('hex').slice(0, 16) : null
}

function fromCache(): CachedBrain | null {
  try {
    const c = JSON.parse(readFileSync(BRAIN_CACHE, 'utf8')) as Partial<CachedBrain>
    if (typeof c.version !== 'string' || !c.files || typeof c.files !== 'object') return null
    return { version: c.version, tiers: c.tiers ?? [], files: c.files, locked: c.locked ?? [], source: 'cache', account: c.account ?? null, token: c.token ?? null }
  } catch {
    return null
  }
}

/**
 * The cache this process may serve before the server answers. With no cloud token here (an MCP server the desktop
 * connected, which has only the desktop's port and token), it is the brain the desktop app last received for its
 * signed-in account on this machine. With one, only a cache that login received: another login's waits, as `held`,
 * until the server names the same account.
 */
function startingCache(): { state: ServedBrain; held: CachedBrain | null } {
  const cached = fromCache()
  if (!cached) return { state: EMPTY, held: null }
  const key = tokenKey()
  return !key || cached.token === key ? { state: cached, held: null } : { state: EMPTY, held: cached }
}

let state: ServedBrain = EMPTY
let held: CachedBrain | null = null
if (process.env.SLATES_BRAIN_DIR) state = fromDir(process.env.SLATES_BRAIN_DIR)
else ({ state, held } = startingCache())
let checkedAt = 0
let inflight: Promise<ServedBrain> | undefined

/** The brain this process holds now. */
export function servedBrain(): ServedBrain {
  return state
}

/** Every skill an agent can read here: the public card and router, then the served brain. */
export function brainFiles(): Readonly<Record<string, string>> {
  return state.files === EMPTY.files ? SKILLS : { ...SKILLS, ...state.files }
}

interface CloudGet {
  get<T>(path: string): Promise<T>
}

/**
 * Bring the brain up to the account's tiers and the approved version, one request in flight and at most every
 * REFRESH_EVERY_MS unless forced. A failure keeps what is held (the cache works offline) and records why; a folder
 * source never refreshes.
 */
export function refreshServedBrain(cloud: () => CloudGet, { force = false } = {}): Promise<ServedBrain> {
  if (state.source === 'dir') return Promise.resolve(state)
  if (!force && Date.now() - checkedAt < REFRESH_EVERY_MS) return Promise.resolve(state)
  inflight ??= (async () => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = <T>(p: Promise<T>) =>
      Promise.race([p, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('the brain check timed out')), REFRESH_TIMEOUT_MS) })])
        .finally(() => clearTimeout(timer))
    try {
      const index = await timeout(cloud().get<{ version: string; tiers: string[]; account?: string | null }>('/brain'))
      const same = (b: ServedBrain) => index.version === b.version && index.tiers.join() === b.tiers.join() && (index.account ?? null) === (b.account ?? null)
      if (held && same(held)) state = { ...held, source: 'server' }
      held = null
      if (!same(state)) {
        const bundle = await timeout(cloud().get<{ version: string; tiers: string[]; account?: string | null; files: Record<string, string>; locked: LockedGuide[] }>('/brain/bundle'))
        if (!bundle?.files || typeof bundle.files !== 'object') throw new Error('the brain bundle was malformed')
        state = { version: bundle.version, tiers: bundle.tiers, files: bundle.files, locked: bundle.locked ?? [], source: 'server', account: bundle.account ?? null }
        try {
          mkdirSync(AGENT_DIR, { recursive: true })
          // Owner-only: the brain is the account's, not every user's on the machine.
          writeFileSync(`${BRAIN_CACHE}.tmp`, JSON.stringify({ ...state, token: tokenKey(), fetchedAt: new Date().toISOString() }), { mode: 0o600 })
          renameSync(`${BRAIN_CACHE}.tmp`, BRAIN_CACHE)
        } catch {
          // A cache that cannot be written leaves this process served; the next start fetches again.
        }
      } else {
        state = { ...state, source: 'server', problem: undefined }
      }
      checkedAt = Date.now()
    } catch (error) {
      // Offline or signed out: the held brain stands, and the next try waits a minute, not a full interval.
      checkedAt = Date.now() - REFRESH_EVERY_MS + 60_000
      const code = (error as { code?: string; status?: number })
      if (code.status === 401 || code.status === 403) {
        // The session or key is gone: what it was served goes with it.
        clearServedBrain()
      } else if (code.code === 'CLOUD_TOKEN_MISSING' && state.source !== 'dir') {
        // No login here: the desktop app may have received this machine's brain since this process started.
        const cached = fromCache()
        if (cached && cached.version !== state.version) state = cached
      }
      state = {
        ...state,
        problem: code.code === 'CLOUD_TOKEN_MISSING' ? 'not connected to a Slates account' : error instanceof Error ? error.message : String(error),
      }
    } finally {
      inflight = undefined
    }
    return state
  })()
  return inflight
}

/** Drop the served brain and its cache: signing out (`slates logout`), or a 401/403 from the server. */
export function clearServedBrain(): void {
  if (state.source === 'dir') return
  state = EMPTY
  held = null
  checkedAt = 0
  rmSync(BRAIN_CACHE, { force: true })
}

/** Point this process at a folder of brain files (or back to the cache) without a restart: tests and evals. */
export function useBrainSource(dir?: string): ServedBrain {
  if (dir) {
    state = fromDir(dir)
    held = null
  } else {
    ;({ state, held } = startingCache())
  }
  checkedAt = 0
  return state
}
