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
//                     REFRESH_EVERY_MS. A 401 or 403 drops what that credential was served, here and in the
//                     cache it wrote; a cache another login wrote stays (the desktop app's, which a
//                     desktop-connected server goes on serving). Signing out does the same (clearServedBrain).
// With none of them, only the card and the router are here, and the guide op says why.

import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_DIR, readConnection, tokenHash } from '../auth.js'
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

/** What BRAIN_CACHE holds: the brain, and which credential fetched it (tokenHash, never the token). */
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

/** This machine's CLI login (`slates login`), as the hash a cache it received carries. */
function cliKey(): string | null {
  return tokenHash(readConnection().cloud.token)
}

/** The desktop app's local server is in the connection file, so the cache it writes is its signed-in account's. */
function desktopConnected(): boolean {
  const { desktop } = readConnection()
  return desktop.enabled && !!desktop.port && !!desktop.token
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
  const key = cliKey()
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
  /** The hash of the credential it sends (SlatesCloudClient); without one, the CLI login's is assumed. */
  readonly credentialKey?: string | null
}

/** Write what this process holds to BRAIN_CACHE, tagged with the credential that fetched it. */
function writeCache(key: string | null): void {
  const tmp = `${BRAIN_CACHE}.tmp`
  try {
    mkdirSync(AGENT_DIR, { recursive: true })
    writeFileSync(tmp, JSON.stringify({ ...state, token: key, fetchedAt: new Date().toISOString() }), { mode: 0o600 })
    // Owner-only: the brain is the account's, not every user's on the machine. `mode` applies only when the file is
    // created (a .tmp a crash left keeps its old mode), so it is set on every write. Windows has no POSIX modes;
    // there the cache relies on the user-profile folder's ACL.
    if (process.platform !== 'win32') chmodSync(tmp, 0o600)
    renameSync(tmp, BRAIN_CACHE)
  } catch {
    // A cache that cannot be written leaves this process served; the next start fetches again.
  }
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
    let key: string | null = null
    try {
      const client = cloud()
      key = client.credentialKey ?? cliKey()
      const index = await timeout(client.get<{ version: string; tiers: string[]; account?: string | null }>('/brain'))
      const same = (b: ServedBrain) => index.version === b.version && index.tiers.join() === b.tiers.join() && (index.account ?? null) === (b.account ?? null)
      if (held && same(held)) state = { ...held, source: 'server' }
      held = null
      if (!same(state)) {
        const bundle = await timeout(client.get<{ version: string; tiers: string[]; account?: string | null; files: Record<string, string>; locked: LockedGuide[] }>('/brain/bundle'))
        if (!bundle?.files || typeof bundle.files !== 'object') throw new Error('the brain bundle was malformed')
        state = { version: bundle.version, tiers: bundle.tiers, files: bundle.files, locked: bundle.locked ?? [], source: 'server', account: bundle.account ?? null }
        writeCache(key)
      } else {
        state = { ...state, source: 'server', problem: undefined }
        // A cache another login's sign-out deleted under this process is written back, so a server the desktop
        // connected finds the brain again without waiting for the next version.
        if (!existsSync(BRAIN_CACHE)) writeCache(key)
      }
      checkedAt = Date.now()
    } catch (error) {
      // Offline or signed out: the held brain stands, and the next try waits a minute, not a full interval.
      checkedAt = Date.now() - REFRESH_EVERY_MS + 60_000
      const code = (error as { code?: string; status?: number })
      if (code.status === 401 || code.status === 403) {
        // This credential is refused: what it was served goes, here and in the cache if it wrote it, and the
        // minute's wait stands. A cache another login wrote stays on disk; when it is the desktop app's (not the CLI
        // login's, with the desktop connected) this process serves it, as it does with no login here, so a revoked
        // CLI key cannot take a signed-in desktop's brain from the agent.
        state = EMPTY
        held = null
        const cached = fromCache()
        if (cached && key && cached.token === key) rmSync(BRAIN_CACHE, { force: true })
        else if (cached && cached.token !== cliKey() && desktopConnected()) state = cached
      } else if (code.code === 'CLOUD_TOKEN_MISSING') {
        // No login here: the brain is the one the desktop app last received, which may be newer than this
        // process's, and none once that cache is gone (`slates logout`, a desktop sign-out).
        state = fromCache() ?? EMPTY
      }
      state = {
        ...state,
        problem: code.code === 'CLOUD_TOKEN_MISSING' ? 'not connected to a Slates account' : error instanceof Error ? error.message : String(error),
      }
    }
    return state
  })().finally(() => {
    // Cleared after the assignment: a refresh with nothing to await (no login, so `cloud()` throws at once) used to
    // clear it inside the body, before `??=` stored the settled promise, and every later call got that first answer.
    inflight = undefined
  })
  return inflight
}

/**
 * Signing out: drop the served brain in this process, and the cache when the login signing out received it. The
 * cache has two writers. `slates logout` passes 'cli', before its token goes, and deletes a cache that login
 * received. The desktop app (the default, which the published desktop already calls) deletes any cache the CLI
 * login did not receive: its own, and one written before 2026-10-25, tagged with the CLI token's hash or none.
 */
export function clearServedBrain(signingOut: 'cli' | 'desktop' = 'desktop'): void {
  if (state.source === 'dir') return
  state = EMPTY
  held = null
  checkedAt = 0
  const cli = cliKey()
  const cliReceived = !!cli && fromCache()?.token === cli
  if (cliReceived === (signingOut === 'cli')) rmSync(BRAIN_CACHE, { force: true })
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
