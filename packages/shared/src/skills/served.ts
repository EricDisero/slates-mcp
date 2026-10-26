// The Slates brain's deep layers, served by slates-api by the account's tier (second-brain
// plans/2026-10-25-slates-brain.md step 4). This public package carries only the Director card and the router
// (`slates-start-here`, SKILLS); every playbook, rule and model guide lives in the private slates-api `brain/` and
// reaches an agent from the account it is connected with (slates-api src/lib/brain.ts says who reads which).
//
// Where this process gets them, first found wins:
//   SLATES_BRAIN_DIR  a folder of brain files with every tier open: builds, evals and checks. Never set on a
//                     user's machine.
//   BRAIN_CACHE       the last bundle this machine received, read at load so a cold or offline start has the brain.
//   the server        GET /brain (version and tiers), then /brain/bundle only when either changed, through the
//                     connected account; written to BRAIN_CACHE. refreshServedBrain runs it at server start and
//                     before a guide answer, at most every REFRESH_EVERY_MS.
// With none of them, only the card and the router are here, and the guide op says why.

import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_DIR } from '../auth.js'
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
  /** Why the last refresh did not reach the server, for the guide op to say. */
  problem?: string
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

function fromCache(): ServedBrain | null {
  try {
    const c = JSON.parse(readFileSync(BRAIN_CACHE, 'utf8')) as Partial<ServedBrain>
    if (typeof c.version !== 'string' || !c.files || typeof c.files !== 'object') return null
    return { version: c.version, tiers: c.tiers ?? [], files: c.files, locked: c.locked ?? [], source: 'cache' }
  } catch {
    return null
  }
}

let state: ServedBrain = process.env.SLATES_BRAIN_DIR ? fromDir(process.env.SLATES_BRAIN_DIR) : fromCache() ?? EMPTY
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
      const index = await timeout(cloud().get<{ version: string; tiers: string[] }>('/brain'))
      if (index.version !== state.version || index.tiers.join() !== state.tiers.join()) {
        const bundle = await timeout(cloud().get<{ version: string; tiers: string[]; files: Record<string, string>; locked: LockedGuide[] }>('/brain/bundle'))
        if (!bundle?.files || typeof bundle.files !== 'object') throw new Error('the brain bundle was malformed')
        state = { version: bundle.version, tiers: bundle.tiers, files: bundle.files, locked: bundle.locked ?? [], source: 'server' }
        try {
          mkdirSync(AGENT_DIR, { recursive: true })
          writeFileSync(`${BRAIN_CACHE}.tmp`, JSON.stringify({ ...state, fetchedAt: new Date().toISOString() }))
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

/** Point this process at a folder of brain files (or back to the cache) without a restart: tests and evals. */
export function useBrainSource(dir?: string): ServedBrain {
  state = dir ? fromDir(dir) : fromCache() ?? EMPTY
  checkedAt = 0
  return state
}
