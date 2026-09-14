// Proves the version handshake in src/update-check.ts against dist: the
// compare, the notice wording, the disk cache round trip, the hourly refresh
// gate, and that a dead registry yields the cached value (never a throw).
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compareVersions, cachedLatestVersion, refreshLatestVersion, updateNotice } from '../dist/update-check.js'

assert.ok(compareVersions('0.5.9', '0.5.19') < 0, '0.5.9 is behind 0.5.19 (numeric, not lexical)')
assert.ok(compareVersions('0.5.19', '0.5.9') > 0)
assert.equal(compareVersions('1.0.0', 'v1.0.0'), 0)
assert.equal(compareVersions('1.0.0-beta.1', '1.0.0'), 0, 'prerelease suffix ignored')

assert.equal(updateNotice('@x/y', '0.5.19', '0.5.19', 'do X'), null, 'current: no notice')
assert.equal(updateNotice('@x/y', '0.5.19', null, 'do X'), null, 'unknown latest: no notice')
assert.equal(updateNotice('@x/y', '0.6.0', '0.5.19', 'do X'), null, 'ahead of registry (local dev): no notice')
assert.match(updateNotice('@x/y', '0.5.9', '0.5.19', 'do X'), /^UPDATE AVAILABLE: @x\/y v0\.5\.9 is running; v0\.5\.19 is published\. do X$/)

const cacheFile = join(mkdtempSync(join(tmpdir(), 'slates-update-check-')), 'nested', 'update-check.json')
assert.equal(cachedLatestVersion('@x/y', cacheFile), null, 'missing cache reads as null')

let hits = 0
async function startRegistry() {
  const { createServer } = await import('node:http')
  const server = createServer((req, res) => {
    hits++
    if (req.url === '/@x%2Fy/latest' || req.url === '/@x/y/latest') {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ version: '0.5.19' }))
    } else {
      res.statusCode = 404
      res.end('{}')
    }
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return { server, url: `http://127.0.0.1:${server.address().port}` }
}
const { server, url } = await startRegistry()

const t0 = 1_000_000
assert.equal(await refreshLatestVersion('@x/y', { cacheFile, registryUrl: url, now: t0 }), '0.5.19', 'first call fetches')
assert.equal(hits, 1)
assert.equal(cachedLatestVersion('@x/y', cacheFile), '0.5.19', 'and persists to disk')
assert.equal(JSON.parse(readFileSync(cacheFile, 'utf8'))['@x/y'].checkedAt, t0)
assert.equal(await refreshLatestVersion('@x/y', { cacheFile, registryUrl: url, now: t0 + 60_000 }), '0.5.19', 'within the hour: cached')
assert.equal(hits, 1, 'no second request inside the hour')
assert.equal(await refreshLatestVersion('@x/y', { cacheFile, registryUrl: url, now: t0 + 2 * 60 * 60_000 }), '0.5.19', 'after an hour: refetch')
assert.equal(hits, 2)
assert.equal(await refreshLatestVersion('@nope/pkg', { cacheFile, registryUrl: url, now: t0 }), null, '404 yields null, not a throw')
server.close()
assert.equal(await refreshLatestVersion('@x/y', { cacheFile, registryUrl: url, now: t0 + 4 * 60 * 60_000 }), '0.5.19', 'dead registry yields the cached value')
assert.equal(await refreshLatestVersion('@fresh/pkg', { cacheFile, registryUrl: 'http://127.0.0.1:1', now: t0 }), null, 'dead registry with no cache yields null')

console.log('[update-check] compare, notice, cache round trip, hourly gate and offline fallback passed')
