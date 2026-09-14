// Version handshake for the two published entry points (@slatesvideo/mcp-server
// and @slatesvideo/cli).
//
// WHY THIS EXISTS (2026-09-13): a Discord user's agent reported "H3 isn't in
// the API tool, only Kling, Veo and Seedance are exposed" — a server older
// than 0.5.10 (2026-08-28). Nothing told him, and nothing told his agent. The
// install path is `npx -y @slatesvideo/mcp-server` with no version pinned, so
// a client RESTART is the whole update; the failure is a client that never
// restarts, a global install nobody re-runs, or skill files copied months ago.
//
// HOW IT WORKS. One small registry GET (`/<pkg>/latest`), cached on disk in
// ~/.slates/update-check.json and refreshed at most once an hour. Readers are
// SYNCHRONOUS and disk-only so the MCP server can put the notice into its
// `instructions` at construction time without delaying startup; the refresh
// runs in the background for the NEXT launch. The CLI awaits the refresh
// (bounded by FETCH_TIMEOUT_MS) because a CLI turn already pays for a network
// call. Every path is fail-silent: no network, no home dir, no registry —
// no notice, never an error.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_DIR } from './auth.js'

export const UPDATE_CACHE_FILE = join(AGENT_DIR, 'update-check.json')
const REFRESH_AFTER_MS = 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 2500

type UpdateCache = Record<string, { latest: string; checkedAt: number }>

/** Numeric semver compare on the release segments; a prerelease suffix is ignored. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v.replace(/^v/, '').split('-')[0].split('.').map((n) => Number.parseInt(n, 10) || 0)
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

function readCache(file: string): UpdateCache {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as UpdateCache) : {}
  } catch {
    return {}
  }
}

function writeCache(file: string, cache: UpdateCache): void {
  try {
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, JSON.stringify(cache, null, 2) + '\n', 'utf8')
  } catch {
    // A read-only home is not a reason to fail a generation.
  }
}

/** The newest version the last registry lookup recorded for `pkgName`. Sync, disk only. */
export function cachedLatestVersion(pkgName: string, cacheFile = UPDATE_CACHE_FILE): string | null {
  const entry = readCache(cacheFile)[pkgName]
  return entry && typeof entry.latest === 'string' ? entry.latest : null
}

/**
 * Refresh the cached latest version from the npm registry when the entry is
 * older than an hour. Bounded by FETCH_TIMEOUT_MS, never throws. Returns the
 * latest version known after the call (fresh or cached), or null.
 */
export async function refreshLatestVersion(
  pkgName: string,
  options: { cacheFile?: string; registryUrl?: string; now?: number } = {}
): Promise<string | null> {
  const cacheFile = options.cacheFile ?? UPDATE_CACHE_FILE
  const now = options.now ?? Date.now()
  const cache = readCache(cacheFile)
  const entry = cache[pkgName]
  if (entry && now - entry.checkedAt < REFRESH_AFTER_MS) return entry.latest
  const registryUrl = options.registryUrl ?? 'https://registry.npmjs.org'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  // A stdio server exits when its client closes; a pending timer must not
  // hold the process open for the rest of the timeout.
  timer.unref?.()
  try {
    const res = await fetch(`${registryUrl}/${pkgName}/latest`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return entry?.latest ?? null
    const body = (await res.json()) as { version?: unknown }
    if (typeof body.version !== 'string') return entry?.latest ?? null
    cache[pkgName] = { latest: body.version, checkedAt: now }
    writeCache(cacheFile, cache)
    return body.version
  } catch {
    return entry?.latest ?? null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * One sentence when `current` is behind `latest`, else null. `howToUpdate` is
 * the surface-specific action: the MCP server's is a client restart, the CLI's
 * is a reinstall.
 */
export function updateNotice(
  pkgName: string,
  current: string,
  latest: string | null,
  howToUpdate: string
): string | null {
  if (!latest || compareVersions(current, latest) >= 0) return null
  return `UPDATE AVAILABLE: ${pkgName} v${current} is running; v${latest} is published. ${howToUpdate}`
}
